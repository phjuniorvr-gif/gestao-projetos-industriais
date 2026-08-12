import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Card, Checkbox, FormField, Input, Select } from '../ui';
import type { ActivityTemplate, Category, CategoryEntry, ProjectView } from '../../types';

interface AddTaskPanelProps {
  open: boolean;
  projects: ProjectView[];
  /** Presente quando aberto pelo "+" da linha da atividade — pula os dois seletores, igual ao
   * comportamento de sempre. Ausente quando aberto pelo "＋ Novo item" do topo da página (Fase 4,
   * Commit 6) — aí os seletores de projeto e atividade aparecem, nessa ordem. */
  initialActivityId?: string;
  catalog: ActivityTemplate[];
  categories: CategoryEntry[];
  onClose: () => void;
  onAdd: (activityId: string, names: { name: string; category: Category }[]) => void;
}

function findActivity(projects: ProjectView[], activityId: string) {
  for (const project of projects) {
    const activity = project.activities.find((a) => a.id === activityId);
    if (activity) return { project, activity };
  }
  return null;
}

export function AddTaskPanel({ open, projects, initialActivityId, catalog, categories, onClose, onAdd }: AddTaskPanelProps) {
  const [projectId, setProjectId] = useState('');
  const [activityId, setActivityId] = useState(initialActivityId ?? '');
  const [category, setCategory] = useState<Category>(categories[0]?.id ?? '');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [customName, setCustomName] = useState('');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reseta quando o painel abre/muda
    // de alvo, não a cada render (projects muda de referência o tempo todo).
  }, [open, initialActivityId]);

  useEffect(() => {
    if (!category && categories[0]) setCategory(categories[0].id);
  }, [categories, category]);

  const project = projects.find((p) => p.id === projectId);
  const activity = activityId ? findActivity(projects, activityId)?.activity : undefined;

  const suggestions = useMemo(
    () => catalog.find((entry) => entry.active && entry.name === activity?.name && entry.category === category),
    [catalog, activity, category],
  );

  if (!open) return null;

  function handleAdd() {
    if (!activityId) return;
    const fromSuggestions = (suggestions?.tasks ?? [])
      .filter((t) => checked[t.id] !== false)
      .map((t) => ({ name: t.name, category }));
    const custom = customName.trim() ? [{ name: customName.trim(), category }] : [];
    const names = [...fromSuggestions, ...custom];
    if (names.length === 0) return;
    onAdd(activityId, names);
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
            <FormField label="Categoria" required>
              <Select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="w-full">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </FormField>

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
              As datas e as predecessoras podem ser ajustadas depois, clicando na tarefa criada.
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
