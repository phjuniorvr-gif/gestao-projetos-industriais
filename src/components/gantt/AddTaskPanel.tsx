import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Card, Checkbox, FormField, Input, Select } from '../ui';
import { PersonSelect } from '../shared/PersonSelect';
import { addDays, todayISO, validateDateOrder } from '../../utils';
import type { ActivityTemplate, Category, CategoryEntry, Person, ProjectView } from '../../types';

interface AddTaskPanelProps {
  open: boolean;
  projects: ProjectView[];
  /** Presente quando aberto pelo "+" da linha da atividade — pula os dois seletores, igual ao
   * comportamento de sempre. Ausente quando aberto pelo "＋ Novo item" do topo da página (Fase 4,
   * Commit 6) — aí os seletores de projeto e atividade aparecem, nessa ordem. */
  initialActivityId?: string;
  catalog: ActivityTemplate[];
  categories: CategoryEntry[];
  people: Person[];
  onCreatePerson: (name: string) => Promise<Person>;
  onClose: () => void;
  /** Fase 7 (Parte B) — responsável é obrigatório e é UM só, aplicado a todas as tarefas deste
   * lote (o painel adiciona várias de uma vez a partir do catálogo; não tem campo por tarefa).
   * `plannedStart`/`plannedEnd` também são um só par, é o período da primeira tarefa do lote —
   * as demais (quando mais de uma é adicionada de uma vez) encadeiam uma após a outra usando essa
   * mesma duração, quem monta a sequência é `onAdd`. */
  onAdd: (
    activityId: string,
    names: { name: string; category: Category }[],
    responsavelId: string,
    plannedStart: string,
    plannedEnd: string,
  ) => void;
}

function findActivity(projects: ProjectView[], activityId: string) {
  for (const project of projects) {
    const activity = project.activities.find((a) => a.id === activityId);
    if (activity) return { project, activity };
  }
  return null;
}

export function AddTaskPanel({
  open,
  projects,
  initialActivityId,
  catalog,
  categories,
  people,
  onCreatePerson,
  onClose,
  onAdd,
}: AddTaskPanelProps) {
  const [projectId, setProjectId] = useState('');
  const [activityId, setActivityId] = useState(initialActivityId ?? '');
  const [category, setCategory] = useState<Category>(categories[0]?.id ?? '');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [customName, setCustomName] = useState('');
  const [responsavelId, setResponsavelId] = useState<string | undefined>(undefined);
  const [responsavelError, setResponsavelError] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (initialActivityId) {
      const found = findActivity(projects, initialActivityId);
      setProjectId(found?.project.id ?? '');
      setActivityId(initialActivityId);
    } else {
      setProjectId('');
      setActivityId('');
    }
    setResponsavelId(undefined);
    setResponsavelError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reseta quando o painel abre/muda
    // de alvo, não a cada render (projects muda de referência o tempo todo).
  }, [open, initialActivityId]);

  useEffect(() => {
    if (!category && categories[0]) setCategory(categories[0].id);
  }, [categories, category]);

  const project = projects.find((p) => p.id === projectId);
  const activity = activityId ? findActivity(projects, activityId)?.activity : undefined;

  // Sugestão de período: começa depois da última tarefa da atividade (ou do início previsto da
  // atividade, ou hoje), 7 dias corridos de duração — mesmo default que já existia calculado
  // silenciosamente em ProjectSchedulePage.tsx, só que agora visível e editável antes de
  // adicionar, em vez de só ajustável depois abrindo a tarefa criada.
  useEffect(() => {
    if (!activity) return;
    const start = activity.tasks.at(-1)?.plannedEnd ?? activity.plannedStart ?? todayISO();
    setPlannedStart(start);
    setPlannedEnd(addDays(start, 7));
    setDateError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recalcula quando a atividade-alvo
    // muda, não a cada render (activity.tasks muda de referência a cada tarefa nova).
  }, [activity?.id]);

  const suggestions = useMemo(
    () => catalog.find((entry) => entry.active && entry.name === activity?.name && entry.category === category),
    [catalog, activity, category],
  );

  if (!open) return null;

  function handleAdd() {
    if (!activityId) return;
    if (!responsavelId) {
      setResponsavelError('Selecione um responsável');
      return;
    }
    setResponsavelError('');
    const orderCheck = validateDateOrder(plannedStart, plannedEnd);
    if (!orderCheck.valid) {
      setDateError(orderCheck.errors[0]);
      return;
    }
    setDateError('');
    const fromSuggestions = (suggestions?.tasks ?? [])
      .filter((t) => checked[t.id] !== false)
      .map((t) => ({ name: t.name, category }));
    const custom = customName.trim() ? [{ name: customName.trim(), category }] : [];
    const names = [...fromSuggestions, ...custom];
    if (names.length === 0) return;
    onAdd(activityId, names, responsavelId, plannedStart, plannedEnd);
    setChecked({});
    setCustomName('');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <Card
        className="h-full w-full max-w-md overflow-y-auto rounded-none rounded-l-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-text">Adicionar tarefa{activity ? ` — ${activity.name}` : ''}</p>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!initialActivityId && (
          <div className="mb-4 space-y-3">
            <FormField label="Projeto" required>
              <Select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setActivityId('');
                }}
                className="w-full"
                autoFocus
              >
                <option value="">Selecione um projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </FormField>
            {project && (
              <FormField label="Atividade" required>
                <Select value={activityId} onChange={(e) => setActivityId(e.target.value)} className="w-full">
                  <option value="">Selecione uma atividade</option>
                  {project.activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
          </div>
        )}

        {activity && (
          <>
            <FormField label="Responsável" required error={responsavelError}>
              <PersonSelect
                value={responsavelId}
                onChange={setResponsavelId}
                people={people}
                onCreatePerson={onCreatePerson}
                placeholder="Selecionar…"
                required
              />
            </FormField>

            <FormField label="Categoria" required className="mt-4">
              <Select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="w-full">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <FormField label="Início previsto" required>
                <Input
                  type="date"
                  value={plannedStart}
                  onChange={(e) => setPlannedStart(e.target.value)}
                  className="w-full"
                />
              </FormField>
              <FormField label="Fim previsto" required error={dateError}>
                <Input
                  type="date"
                  value={plannedEnd}
                  onChange={(e) => setPlannedEnd(e.target.value)}
                  className="w-full"
                />
              </FormField>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-text-muted">Tarefas sugeridas</p>
              {suggestions ? (
                <ul className="space-y-1.5">
                  {suggestions.tasks.map((t) => (
                    <li key={t.id}>
                      <Checkbox
                        label={t.name}
                        checked={checked[t.id] !== false}
                        onChange={(e) => setChecked((c) => ({ ...c, [t.id]: e.target.checked }))}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">
                  Nenhum modelo cadastrado para "{activity.name}" + "
                  {categories.find((c) => c.id === category)?.label ?? category}" no catálogo.
                </p>
              )}
            </div>

            <FormField label="Adicionar tarefa personalizada" className="mt-4">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nome da tarefa"
                className="w-full"
              />
            </FormField>

            <p className="mt-3 text-xs text-text-muted">
              Se mais de uma tarefa for adicionada de uma vez, cada uma começa após o fim da
              anterior, usando essa mesma duração. Predecessoras podem ser ajustadas depois,
              clicando na tarefa criada.
            </p>
          </>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={handleAdd} disabled={!activityId}>
            Adicionar
          </Button>
        </div>
      </Card>
    </div>
  );
}
