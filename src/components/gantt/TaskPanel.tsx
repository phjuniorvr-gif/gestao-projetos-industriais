import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button, Card, FormField, Input, Select, Textarea } from '../ui';
import { PersonSelect } from '../shared/PersonSelect';
import type { Category, CategoryEntry, Person, Replanejamento, Task, TaskView } from '../../types';
import { formatDatePtBr } from '../../utils';
import type { DependencyValidation, ReplanValidation } from '../../utils';
import { TaskDependencyInput } from './TaskDependencyInput';

type ReplanPatch = Partial<Pick<Task, 'plannedStart' | 'plannedEnd' | 'baseStart' | 'baseEnd'>>;

const REPLAN_CAMPO_LABEL: Record<Replanejamento['campo'], string> = { previsto: 'Previsto', base: 'Linha de base' };
const REPLAN_CAMPO_DATA_LABEL: Record<Replanejamento['campoData'], string> = { inicio: 'início', fim: 'fim' };

interface TaskPanelProps {
  task: TaskView | null;
  allTasks: TaskView[];
  categories: CategoryEntry[];
  people: Person[];
  replanejamentos: Replanejamento[];
  onCreatePerson: (name: string) => Promise<Person>;
  onClose: () => void;
  onSave: (taskId: string, patch: Partial<Omit<Task, 'id' | 'rowNumber' | 'activityId' | 'status'>>) => void;
  onSetPredecessors: (taskId: string, predecessorRowNumbers: number[]) => DependencyValidation;
  onReplan: (taskId: string, patch: ReplanPatch, motivo: string) => ReplanValidation;
  onDelete: (taskId: string) => void;
}

export function TaskPanel({
  task,
  allTasks,
  categories,
  people,
  replanejamentos,
  onCreatePerson,
  onClose,
  onSave,
  onSetPredecessors,
  onReplan,
  onDelete,
}: TaskPanelProps) {
  const [dependencyError, setDependencyError] = useState(false);
  const [draftPlannedStart, setDraftPlannedStart] = useState('');
  const [draftPlannedEnd, setDraftPlannedEnd] = useState('');
  const [draftBaseStart, setDraftBaseStart] = useState('');
  const [draftBaseEnd, setDraftBaseEnd] = useState('');
  const [motivo, setMotivo] = useState('');
  const [replanErrors, setReplanErrors] = useState<string[]>([]);

  // Rascunho reseta sempre que a tarefa selecionada muda — o painel não desmonta ao trocar de
  // tarefa (só ao fechar), então sem isso o rascunho da tarefa anterior vazaria pra próxima.
  useEffect(() => {
    if (!task) return;
    setDraftPlannedStart(task.plannedStart);
    setDraftPlannedEnd(task.plannedEnd);
    setDraftBaseStart(task.baseStart);
    setDraftBaseEnd(task.baseEnd);
    setMotivo('');
    setReplanErrors([]);
  }, [task?.id]);

  if (!task) return null;

  const hasReplanChanges =
    draftPlannedStart !== task.plannedStart ||
    draftPlannedEnd !== task.plannedEnd ||
    draftBaseStart !== task.baseStart ||
    draftBaseEnd !== task.baseEnd;

  function resetReplanDraft() {
    if (!task) return;
    setDraftPlannedStart(task.plannedStart);
    setDraftPlannedEnd(task.plannedEnd);
    setDraftBaseStart(task.baseStart);
    setDraftBaseEnd(task.baseEnd);
    setMotivo('');
    setReplanErrors([]);
  }

  function handleConfirmReplan() {
    if (!task) return;
    const patch: ReplanPatch = {};
    if (draftPlannedStart !== task.plannedStart) patch.plannedStart = draftPlannedStart;
    if (draftPlannedEnd !== task.plannedEnd) patch.plannedEnd = draftPlannedEnd;
    if (draftBaseStart !== task.baseStart) patch.baseStart = draftBaseStart;
    if (draftBaseEnd !== task.baseEnd) patch.baseEnd = draftBaseEnd;
    const result = onReplan(task.id, patch, motivo);
    if (result.valid) {
      setMotivo('');
      setReplanErrors([]);
    } else {
      setReplanErrors(result.errors);
    }
  }

  const taskReplanHistory = replanejamentos
    .filter((r) => r.tarefaId === task.id)
    .sort((a, b) => b.quando.localeCompare(a.quando));

  function resolveQuemName(quemUserId: string): string {
    return people.find((p) => p.userId === quemUserId)?.name ?? 'Usuário';
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <Card
        className="h-full w-full max-w-md overflow-y-auto rounded-none rounded-l-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-text">Tarefa {task.rowNumber}</p>
            {!!task.replanCount && (
              <span
                title={`Previsto replanejado ${task.replanCount} ${task.replanCount === 1 ? 'vez' : 'vezes'}`}
                className="inline-flex items-center rounded-full bg-action/10 px-2.5 py-1 text-xs font-semibold text-action"
              >
                R{task.replanCount}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <FormField label="Nome">
            <Input defaultValue={task.name} onBlur={(e) => onSave(task.id, { name: e.target.value })} className="w-full" />
          </FormField>

          <FormField label="Categoria">
            <Select
              defaultValue={task.category}
              onChange={(e) => onSave(task.id, { category: e.target.value as Category })}
              className="w-full"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Responsável">
            <PersonSelect
              value={task.responsavelId}
              onChange={(id) => onSave(task.id, { responsavelId: id })}
              people={people}
              onCreatePerson={onCreatePerson}
              placeholder="Sem responsável"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Início previsto">
              <Input
                type="date"
                value={draftPlannedStart}
                onChange={(e) => setDraftPlannedStart(e.target.value)}
                className="w-full"
              />
            </FormField>
            <FormField label="Fim previsto">
              <Input
                type="date"
                value={draftPlannedEnd}
                onChange={(e) => setDraftPlannedEnd(e.target.value)}
                className="w-full"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Início linha de base">
              <Input
                type="date"
                value={draftBaseStart}
                onChange={(e) => setDraftBaseStart(e.target.value)}
                className="w-full"
              />
            </FormField>
            <FormField label="Fim linha de base">
              <Input
                type="date"
                value={draftBaseEnd}
                onChange={(e) => setDraftBaseEnd(e.target.value)}
                className="w-full"
              />
            </FormField>
          </div>

          {hasReplanChanges && (
            <div className="space-y-2 rounded-md border border-action/30 bg-action/5 p-3">
              <FormField label="Motivo do replanejamento" required error={replanErrors[0]}>
                <Textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                  className="w-full"
                  placeholder="Por que essa data mudou?"
                />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={resetReplanDraft}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={handleConfirmReplan}>
                  Confirmar alteração
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Início real">
              <Input
                type="date"
                defaultValue={task.actualStart ?? ''}
                onBlur={(e) => onSave(task.id, { actualStart: e.target.value || undefined })}
                className="w-full"
              />
            </FormField>
            <FormField label="Fim real">
              <Input
                type="date"
                defaultValue={task.actualEnd ?? ''}
                onBlur={(e) => onSave(task.id, { actualEnd: e.target.value || undefined })}
                className="w-full"
              />
            </FormField>
          </div>

          <FormField label="Predecessora(s)" error={dependencyError ? 'Verifique os números informados.' : undefined}>
            <TaskDependencyInput
              value={task.predecessorRowNumbers}
              allTasks={allTasks}
              taskRowNumber={task.rowNumber}
              onChange={(numbers, validation) => {
                setDependencyError(!validation.valid);
                if (validation.valid) onSetPredecessors(task.id, numbers);
              }}
            />
          </FormField>
        </div>

        {!!task.replanCount && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold text-text-muted">Histórico de replanejamento</p>
            <ul className="space-y-2">
              {taskReplanHistory.map((r) => (
                <li key={r.id} className="rounded-md border border-border p-2 text-xs">
                  <p className="font-medium text-text">
                    {REPLAN_CAMPO_LABEL[r.campo]} · {REPLAN_CAMPO_DATA_LABEL[r.campoData]}: {formatDatePtBr(r.de)} →{' '}
                    {formatDatePtBr(r.para)}
                  </p>
                  <p className="mt-0.5 text-text-muted">
                    {new Date(r.quando).toLocaleString('pt-BR')} — {resolveQuemName(r.quemUserId)}
                  </p>
                  <p className="mt-0.5 italic text-text-muted">“{r.motivo}”</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-between border-t border-border pt-4">
          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              onDelete(task.id);
              onClose();
            }}
          >
            Excluir tarefa
          </Button>
          <Button variant="primary" onClick={onClose}>
            Concluído
          </Button>
        </div>
      </Card>
    </div>
  );
}
