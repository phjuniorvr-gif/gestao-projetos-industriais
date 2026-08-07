import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Card, Checkbox, FormField, Input, Select } from '../ui';
import type { Activity, ActivityTemplate, Category, CategoryEntry } from '../../types';

interface AddTaskPanelProps {
  activity: Activity | null;
  catalog: ActivityTemplate[];
  categories: CategoryEntry[];
  onClose: () => void;
  onAdd: (names: { name: string; category: Category }[]) => void;
}

export function AddTaskPanel({ activity, catalog, categories, onClose, onAdd }: AddTaskPanelProps) {
  const [category, setCategory] = useState<Category>(categories[0]?.id ?? '');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (!category && categories[0]) setCategory(categories[0].id);
  }, [categories, category]);

  const suggestions = useMemo(
    () => catalog.find((entry) => entry.active && entry.name === activity?.name && entry.category === category),
    [catalog, activity, category],
  );

  if (!activity) return null;

  function handleAdd() {
    const fromSuggestions = (suggestions?.tasks ?? [])
      .filter((t) => checked[t.id] !== false)
      .map((t) => ({ name: t.name, category }));
    const custom = customName.trim() ? [{ name: customName.trim(), category }] : [];
    const names = [...fromSuggestions, ...custom];
    if (names.length === 0) return;
    onAdd(names);
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
          <p className="text-sm font-semibold text-text">Adicionar tarefa — {activity.name}</p>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

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

        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={handleAdd}>
            Adicionar
          </Button>
        </div>
      </Card>
    </div>
  );
}
