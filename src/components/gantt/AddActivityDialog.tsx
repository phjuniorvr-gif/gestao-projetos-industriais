import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, Checkbox, FormField, Input, Select } from '../ui';
import { PersonSelect } from '../shared/PersonSelect';
import type { NewActivityTaskInput } from '../../hooks';
import type { ActivityTemplate, Category, CategoryEntry, Person, Project } from '../../types';
import { todayISO } from '../../utils';

interface AddActivityDialogProps {
  open: boolean;
  projects: Project[];
  initialProjectId?: string;
  catalog: ActivityTemplate[];
  categories: CategoryEntry[];
  people: Person[];
  onCreatePerson: (name: string) => Promise<Person>;
  onAdd: (projectId: string, name: string, processo?: string) => void;
  onAddFromCatalog: (projectId: string, name: string, tasks: NewActivityTaskInput[], processo?: string) => void;
  onCancel: () => void;
}

type Mode = 'catalog' | 'manual';

export function AddActivityDialog({
  open,
  projects,
  initialProjectId,
  catalog,
  categories,
  people,
  onCreatePerson,
  onAdd,
  onAddFromCatalog,
  onCancel,
}: AddActivityDialogProps) {
  const [projectId, setProjectId] = useState(initialProjectId ?? '');
  const [mode, setMode] = useState<Mode>('catalog');
  const [name, setName] = useState('');
  // "Processo" (pedido do usuário, aba Importação) — texto livre, preenchido só na criação, sem
  // edição depois; some pra qualquer atividade que não seja de importação (fica `undefined`).
  const [processo, setProcesso] = useState('');
  const [responsavelId, setResponsavelId] = useState<string | undefined>(undefined);
  const [responsavelError, setResponsavelError] = useState('');

  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const technicalAreas = useMemo(
    () => Array.from(new Set(catalog.filter((t) => t.active).map((t) => t.category))),
    [catalog],
  );
  const [area, setArea] = useState<Category | ''>('');
  const currentArea = area || technicalAreas[0] || '';
  const templatesForArea = useMemo(
    () => catalog.filter((t) => t.active && t.category === currentArea),
    [catalog, currentArea],
  );
  const [templateId, setTemplateId] = useState('');
  const currentTemplate = templatesForArea.find((t) => t.id === templateId) ?? templatesForArea[0];
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [durations, setDurations] = useState<Record<string, number>>({});

  const allChecked =
    !!currentTemplate && currentTemplate.tasks.length > 0 && currentTemplate.tasks.every((t) => checked[t.id]);

  useEffect(() => {
    if (!open) return;
    setProjectId(initialProjectId ?? '');
    setMode('catalog');
    setName('');
    setProcesso('');
    setResponsavelId(undefined);
    setResponsavelError('');
    setArea('');
    setTemplateId('');
    setChecked({});
    setDurations({});
  }, [open, initialProjectId]);

  if (!open) return null;

  const project = projects.find((p) => p.id === projectId);

  function toggleAllTasks() {
    if (!currentTemplate) return;
    if (allChecked) {
      setChecked({});
    } else {
      setChecked(Object.fromEntries(currentTemplate.tasks.map((t) => [t.id, true])));
    }
  }

  function handleAddFromCatalog() {
    if (!projectId || !currentTemplate) return;
    const selectedTasks = currentTemplate.tasks.filter((t) => checked[t.id]);
    if (selectedTasks.length === 0) return;
    if (!responsavelId) {
      setResponsavelError('Selecione um responsável');
      return;
    }
    setResponsavelError('');
    onAddFromCatalog(
      projectId,
      currentTemplate.name,
      selectedTasks.map((t): NewActivityTaskInput => ({
        name: t.name,
        category: currentTemplate.category,
        responsavelId,
        durationDays: Math.max(1, durations[t.id] ?? t.durationDays),
        predecessorRowNumbers: [],
      })),
      processo.trim() || undefined,
    );
    setChecked({});
    setDurations({});
  }

  function handleAddManual() {
    if (!projectId || !name.trim()) return;
    onAdd(projectId, name.trim(), processo.trim() || undefined);
    setName('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <Card
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-sm font-semibold text-text">Nova atividade{project ? ` — ${project.code}` : ''}</p>

        {!initialProjectId && (
          <FormField label="Projeto" required>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full" autoFocus>
              <option value="">Selecione um projeto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('catalog')}
            className={`rounded-lg border p-3 text-left text-sm font-semibold transition-colors ${
              mode === 'catalog' ? 'border-action bg-action/5 text-action' : 'border-border text-text hover:bg-page'
            }`}
          >
            Selecionar do catálogo
            <p className="mt-1 text-xs font-normal text-text-muted">Puxa uma atividade padronizada e as tarefas que você marcar.</p>
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`rounded-lg border p-3 text-left text-sm font-semibold transition-colors ${
              mode === 'manual' ? 'border-action bg-action/5 text-action' : 'border-border text-text hover:bg-page'
            }`}
          >
            Criar do zero
            <p className="mt-1 text-xs font-normal text-text-muted">Cria só a atividade; as tarefas entram depois, uma a uma.</p>
          </button>
        </div>

        {mode === 'catalog' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Área técnica">
                <Select
                  value={currentArea}
                  onChange={(e) => {
                    setArea(e.target.value as Category);
                    setTemplateId('');
                    setChecked({});
                    setDurations({});
                  }}
                  className="w-full"
                >
                  {technicalAreas.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Atividade padronizada">
                <Select
                  value={currentTemplate?.id ?? ''}
                  onChange={(e) => {
                    setTemplateId(e.target.value);
                    setChecked({});
                    setDurations({});
                  }}
                  className="w-full"
                >
                  {templatesForArea.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label="Responsável" required error={responsavelError}>
              <PersonSelect
                value={responsavelId}
                onChange={setResponsavelId}
                people={people}
                onCreatePerson={onCreatePerson}
                required
                placeholder="Selecionar…"
              />
              <p className="mt-1 text-xs text-text-muted">Aplicado a todas as tarefas marcadas abaixo.</p>
            </FormField>

            <FormField label="Processo (opcional)">
              <Input
                value={processo}
                onChange={(e) => setProcesso(e.target.value)}
                className="w-full"
                placeholder="Ex.: Compra, Embarque, Desembaraço…"
              />
              <p className="mt-1 text-xs text-text-muted">
                Aparece só na aba Importação, numa coluna própria — não edita depois de criada.
              </p>
            </FormField>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-text-muted">Tarefas pré-definidas</p>
                {currentTemplate && currentTemplate.tasks.length > 0 && (
                  <Button variant="secondary" onClick={toggleAllTasks}>
                    {allChecked ? 'Desmarcar todas' : 'Selecionar todas'}
                  </Button>
                )}
              </div>
              {currentTemplate && currentTemplate.tasks.length > 0 ? (
                <div className="space-y-1.5">
                  {currentTemplate.tasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Checkbox
                          label={t.name}
                          checked={!!checked[t.id]}
                          onChange={(e) => setChecked((c) => ({ ...c, [t.id]: e.target.checked }))}
                        />
                      </div>
                      <Input
                        type="number"
                        min={1}
                        value={durations[t.id] ?? t.durationDays}
                        onChange={(e) =>
                          setDurations((d) => ({ ...d, [t.id]: Math.max(1, Number(e.target.value) || 1) }))
                        }
                        disabled={!checked[t.id]}
                        className="w-20"
                      />
                      <span className="text-xs text-text-muted">du</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  {technicalAreas.length === 0
                    ? 'Nenhuma atividade cadastrada no catálogo.'
                    : 'Nenhuma tarefa cadastrada para esta atividade no catálogo.'}
                </p>
              )}
            </div>

            <p className="text-xs text-text-muted">
              As tarefas entram com início hoje ({todayISO().split('-').reverse().join('/')}); ajuste as datas e as
              predecessoras depois, clicando na tarefa criada.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                icon={<Plus className="h-4 w-4" />}
                disabled={!projectId || !Object.values(checked).some(Boolean)}
                onClick={handleAddFromCatalog}
              >
                Adicionar atividade
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FormField label="Nome da atividade" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" autoFocus={Boolean(initialProjectId)} />
            </FormField>
            <FormField label="Processo (opcional)">
              <Input
                value={processo}
                onChange={(e) => setProcesso(e.target.value)}
                className="w-full"
                placeholder="Ex.: Compra, Embarque, Desembaraço…"
              />
              <p className="mt-1 text-xs text-text-muted">
                Aparece só na aba Importação, numa coluna própria — não edita depois de criada.
              </p>
            </FormField>
            <p className="text-xs text-text-muted">As datas da atividade são calculadas a partir das tarefas que você adicionar a ela depois.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleAddManual} disabled={!projectId || !name.trim()}>
                Adicionar
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
