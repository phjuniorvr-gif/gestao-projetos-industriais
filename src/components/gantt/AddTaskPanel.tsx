import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Card, Checkbox, FormField, Input, Select } from '../ui';
import { CATEGORY_LABEL, type Activity, type ActivityTemplate, type Category } from '../../types';

interface AddTaskPanelProps {
  activity: Activity | null;
  catalog: ActivityTemplate[];
  onClose: () => void;
  onAdd: (names: { name: string; category: Category }[]) => void;
}

export function AddTaskPanel({ activity, catalog, onClose, onAdd }: AddTaskPanelProps) {
  const [category, setCategory] = useState<Category>('compras');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [customName, setCustomName] = useState('');

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
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
              Nenhum modelo cadastrado para "{activity.name}" + "{CATEGORY_LABEL[category]}" no catálogo.
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
