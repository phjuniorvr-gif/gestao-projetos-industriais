import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button, Card, FormField, Input, Select } from '../ui';
import { PersonSelect } from '../shared/PersonSelect';
import type { Category, CategoryEntry, Person, Task } from '../../types';
import { TaskDependencyInput } from './TaskDependencyInput';

interface TaskPanelProps {
  task: Task | null;
  allTasks: Task[];
  categories: CategoryEntry[];
  people: Person[];
  onCreatePerson: (name: string) => Promise<Person>;
  onClose: () => void;
  onSave: (taskId: string, patch: Partial<Omit<Task, 'id' | 'rowNumber' | 'activityId' | 'status'>>) => void;
  onDelete: (taskId: string) => void;
}

export function TaskPanel({ task, allTasks, categories, people, onCreatePerson, onClose, onSave, onDelete }: TaskPanelProps) {
  const [dependencyError, setDependencyError] = useState(false);

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <Card
        className="h-full w-full max-w-md overflow-y-auto rounded-none rounded-l-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-text">Tarefa {task.rowNumber}</p>
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
                defaultValue={task.plannedStart}
                onBlur={(e) => onSave(task.id, { plannedStart: e.target.value })}
                className="w-full"
              />
            </FormField>
            <FormField label="Fim previsto">
              <Input
                type="date"
                defaultValue={task.plannedEnd}
                onBlur={(e) => onSave(task.id, { plannedEnd: e.target.value })}
                className="w-full"
              />
            </FormField>
          </div>

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
                if (validation.valid) onSave(task.id, { predecessorRowNumbers: numbers });
              }}
            />
          </FormField>
        </div>

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
