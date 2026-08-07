import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { Button, Card, FormField, Input, Select, Textarea, Badge } from '../components/ui';
import { STANDARD_ACTIVITY_NAMES } from '../data/seed';
import { useProjects } from '../hooks';
import { nextProjectCode } from '../utils';

const UNIT_OPTIONS = ['Matriz', 'MEC', 'Feira', 'Amélia'];

interface AppliedActivity {
  tempId: string;
  name: string;
}

export function NewProjectPage() {
  const navigate = useNavigate();
  const { projects, createProject } = useProjects();
  const [step, setStep] = useState<0 | 1>(0);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState(UNIT_OPTIONS[0]);
  const [nameError, setNameError] = useState('');

  const [applied, setApplied] = useState<AppliedActivity[]>([]);

  const code = useMemo(() => nextProjectCode(projects.map((p) => p.code)), [projects]);

  function handleAdvance() {
    if (!name.trim()) {
      setNameError('Informe o nome do projeto');
      return;
    }
    setNameError('');
    setStep(1);
  }

  function handleAddActivity(templateName: string) {
    setApplied((current) => [...current, { tempId: crypto.randomUUID(), name: templateName }]);
  }

  function handleRenameActivity(tempId: string, value: string) {
    setApplied((current) => current.map((a) => (a.tempId === tempId ? { ...a, name: value } : a)));
  }

  function handleRemoveActivity(tempId: string) {
    setApplied((current) => current.filter((a) => a.tempId !== tempId));
  }

  function handleCreate() {
    const project = createProject({
      name: name.trim(),
      description: description.trim() || undefined,
      unit,
      activities: applied.map((a) => ({ name: a.name.trim() || a.name })),
    });
    navigate(`/projetos/${project.id}/cronograma`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Novo Projeto" subtitle={step === 0 ? 'Informações gerais' : 'Seleção das atividades'} />

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
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium text-text-muted">Atividades padronizadas</p>
              <div className="flex flex-wrap gap-2">
                {STANDARD_ACTIVITY_NAMES.map((templateName) => (
                  <Button
                    key={templateName}
                    variant="secondary"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => handleAddActivity(templateName)}
                  >
                    {templateName}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-text-muted">
                Atividades aplicadas ao projeto ({applied.length})
              </p>
              {applied.length === 0 ? (
                <p className="text-sm text-text-muted">Selecione atividades acima para adicionar ao projeto.</p>
              ) : (
                <ul className="space-y-2">
                  {applied.map((activity) => (
                    <li key={activity.tempId} className="flex items-center gap-2">
                      <Input
                        value={activity.name}
                        onChange={(e) => handleRenameActivity(activity.tempId, e.target.value)}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveActivity(activity.tempId)}
                        className="rounded-md p-2 text-text-muted hover:bg-status-delayed/10 hover:text-status-delayed"
                        aria-label={`Remover ${activity.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Voltar
              </Button>
              <Button variant="primary" onClick={handleCreate} disabled={applied.length === 0}>
                Criar Projeto
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
