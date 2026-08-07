import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout';
import { Button, Card, FormField, Input, Select, Textarea, Badge } from '../components/ui';
import { ActivitySourceForm, SelectedActivitiesList } from '../components/wizard';
import type { DraftActivity } from '../components/wizard';
import { useCatalog, useProjects } from '../hooks';
import { computeDatesFromDuration, nextProjectCode, todayISO } from '../utils';
import type { NewActivityInput } from '../hooks';

const UNIT_OPTIONS = ['Matriz', 'MEC', 'Feira', 'Amélia'];

export function NewProjectPage() {
  const navigate = useNavigate();
  const { projects, createProject } = useProjects();
  const { catalog } = useCatalog();
  const [step, setStep] = useState<0 | 1>(0);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState(UNIT_OPTIONS[0]);
  const [nameError, setNameError] = useState('');

  const [scheduleStart, setScheduleStart] = useState(todayISO());
  const [draftActivities, setDraftActivities] = useState<DraftActivity[]>([]);
  const [advanceError, setAdvanceError] = useState('');

  const code = useMemo(() => nextProjectCode(projects.map((p) => p.code)), [projects]);

  function handleAdvance() {
    if (!name.trim()) {
      setNameError('Informe o nome do projeto');
      return;
    }
    setNameError('');
    setStep(1);
  }

  function handleAddActivity(draft: DraftActivity) {
    setDraftActivities((current) => [...current, draft]);
    setAdvanceError('');
  }

  function handleToggleExpand(activityKey: string) {
    setDraftActivities((current) =>
      current.map((a) => (a.key === activityKey ? { ...a, expanded: !a.expanded } : a)),
    );
  }

  function handleRemoveActivity(activityKey: string) {
    setDraftActivities((current) => current.filter((a) => a.key !== activityKey));
  }

  function handleChangeDuration(activityKey: string, taskKey: string, durationDays: number) {
    setDraftActivities((current) =>
      current.map((a) =>
        a.key === activityKey
          ? { ...a, tasks: a.tasks.map((t) => (t.key === taskKey ? { ...t, durationDays } : t)) }
          : a,
      ),
    );
  }

  function handleChangePredecessors(activityKey: string, taskKey: string, predecessorRowNumbers: number[]) {
    setDraftActivities((current) =>
      current.map((a) =>
        a.key === activityKey
          ? { ...a, tasks: a.tasks.map((t) => (t.key === taskKey ? { ...t, predecessorRowNumbers } : t)) }
          : a,
      ),
    );
  }

  function handleCreate() {
    if (!scheduleStart) {
      setAdvanceError('Informe a data inicial do cronograma.');
      return;
    }
    if (draftActivities.length === 0) {
      setAdvanceError('Adicione pelo menos uma atividade.');
      return;
    }
    if (draftActivities.some((a) => a.tasks.length === 0)) {
      setAdvanceError('Toda atividade precisa ter pelo menos uma tarefa.');
      return;
    }

    const flatTasks = draftActivities.flatMap((a) => a.tasks);
    const totalTasks = flatTasks.length;

    for (let index = 0; index < flatTasks.length; index += 1) {
      const line = index + 1;
      const task = flatTasks[index];
      if (task.durationDays < 1) {
        setAdvanceError(`A tarefa da linha ${line} precisa ter duração de pelo menos 1 dia.`);
        return;
      }
      for (const predecessor of task.predecessorRowNumbers) {
        if (predecessor < 1 || predecessor > totalTasks) {
          setAdvanceError(`A tarefa ${predecessor} (predecessora da linha ${line}) não existe.`);
          return;
        }
        if (predecessor >= line) {
          setAdvanceError(`A predecessora da linha ${line} deve ser uma tarefa de linha anterior.`);
          return;
        }
      }
    }

    setAdvanceError('');

    const datesByKey = computeDatesFromDuration(
      flatTasks.map((t) => ({
        key: t.key,
        durationDays: t.durationDays,
        predecessorRowNumbers: t.predecessorRowNumbers,
      })),
      scheduleStart,
    );

    const activities: NewActivityInput[] = draftActivities.map((a) => ({
      name: a.name,
      tasks: a.tasks.map((t) => {
        const dates = datesByKey.get(t.key)!;
        return {
          name: t.name,
          category: t.category,
          plannedStart: dates.plannedStart,
          plannedEnd: dates.plannedEnd,
          predecessorRowNumbers: t.predecessorRowNumbers,
        };
      }),
    }));

    const project = createProject({
      name: name.trim(),
      description: description.trim() || undefined,
      unit,
      activities,
    });
    navigate(`/projetos/${project.id}/cronograma`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Novo Projeto" subtitle={step === 0 ? 'Informações gerais' : 'Seleção de atividades'} />

      <Card className="max-w-3xl p-6">
        {step === 0 ? (
          <div className="space-y-4">
            <Badge color="#2563EB">Código do projeto: {code}</Badge>

            <FormField label="Nome do projeto" required error={nameError}>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" placeholder="Nome do projeto" />
            </FormField>

            <FormField label="Descrição ou observação">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full"
                placeholder="Descreva o objetivo, escopo ou observações do projeto"
              />
            </FormField>

            <FormField label="Unidade" required>
              <Select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full">
                {UNIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => navigate('/projetos')}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleAdvance}>
                Avançar para seleção de atividades
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <FormField label="Data inicial" required>
              <Input type="date" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} className="w-full max-w-xs" />
              <p className="mt-1 text-xs text-text-muted">
                Esta será a data-base para calcular o planejamento das tarefas do projeto.
              </p>
            </FormField>

            <div className="rounded-md border border-action/30 bg-action/5 p-3 text-xs text-text-muted">
              Tarefas sem predecessora começam na data inicial do projeto. Tarefas com predecessora começam após a
              conclusão da tarefa indicada.
            </div>

            <ActivitySourceForm catalog={catalog} onAddActivity={handleAddActivity} />

            <div>
              <p className="mb-2 text-xs font-medium text-text-muted">Atividades selecionadas para o projeto</p>
              <SelectedActivitiesList
                activities={draftActivities}
                onToggleExpand={handleToggleExpand}
                onRemove={handleRemoveActivity}
                onChangeDuration={handleChangeDuration}
                onChangePredecessors={handleChangePredecessors}
              />
            </div>

            {advanceError && <p className="text-xs text-status-delayed">{advanceError}</p>}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Voltar
              </Button>
              <Button variant="primary" onClick={handleCreate}>
                Criar Projeto
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
