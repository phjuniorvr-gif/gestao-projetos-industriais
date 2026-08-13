import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Card, Checkbox, FormField, Input, Select } from '../ui';
import type { ActivityTemplate, Category, CategoryEntry } from '../../types';
import type { CatalogEntryInput } from '../../hooks';

interface CatalogEntryFormProps {
  entry: ActivityTemplate | null;
  categories: CategoryEntry[];
  /** Categoria pré-selecionada ao criar uma atividade nova (ex.: filtro já aplicado na tela). */
  defaultCategory?: string;
  onSave: (input: CatalogEntryInput) => void;
  onCancel: () => void;
}

interface TaskRow {
  name: string;
  durationDays: number;
}

export function CatalogEntryForm({ entry, categories, defaultCategory, onSave, onCancel }: CatalogEntryFormProps) {
  const [name, setName] = useState(entry?.name ?? '');
  const [category, setCategory] = useState<Category>(entry?.category ?? defaultCategory ?? categories[0]?.id ?? '');
  const [tasks, setTasks] = useState<TaskRow[]>(
    entry?.tasks.map((t) => ({ name: t.name, durationDays: t.durationDays })) ?? [{ name: '', durationDays: 1 }],
  );
  const [active, setActive] = useState(entry?.active ?? true);

  function updateTask(index: number, patch: Partial<TaskRow>) {
    setTasks((current) => current.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function removeTask(index: number) {
    setTasks((current) => current.filter((_, i) => i !== index));
  }

  function handleSave() {
    const cleanTasks = tasks
      .map((t) => ({ name: t.name.trim(), durationDays: Math.max(1, t.durationDays) }))
      .filter((t) => t.name);
    if (!name.trim() || cleanTasks.length === 0) return;
    onSave({ name: name.trim(), category, tasks: cleanTasks, active });
  }

  return (
    <Card className="p-5">
      <p className="mb-4 text-sm font-semibold text-text">{entry ? 'Editar atividade' : 'Nova atividade'}</p>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Atividade" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" placeholder="Nome da atividade" />
        </FormField>
        <FormField label="Categoria" required>
          <Select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="w-full">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-text-muted">Tarefas padrão</p>
        <div className="space-y-2">
          {tasks.map((task, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={task.name}
                onChange={(e) => updateTask(index, { name: e.target.value })}
                placeholder="Nome da tarefa"
                className="flex-1"
              />
              <Input
                type="number"
                min={1}
                value={task.durationDays}
                onChange={(e) => updateTask(index, { durationDays: Math.max(1, Number(e.target.value) || 1) })}
                className="w-20"
              />
              <span className="text-xs text-text-muted">du</span>
              <button
                type="button"
                onClick={() => removeTask(index)}
                className="rounded-md p-2 text-text-muted hover:bg-status-delayed/10 hover:text-status-delayed"
                aria-label="Remover tarefa"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          icon={<Plus className="h-4 w-4" />}
          className="mt-2"
          onClick={() => setTasks((t) => [...t, { name: '', durationDays: 1 }])}
        >
          Adicionar tarefa
        </Button>
      </div>

      <div className="mt-4">
        <Checkbox label="Ativo" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Salvar
        </Button>
      </div>
    </Card>
  );
}
