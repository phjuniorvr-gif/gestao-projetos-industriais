import { useState } from 'react';
import type { ProjectView, Task } from '../../types';
import { todayISO } from '../../utils';
import { computeFocusTask } from '../../utils/portfolio';
import { Button } from '../ui';

interface InlineTaskProgressEditProps {
  project: ProjectView;
  open: boolean;
  onClose: () => void;
  onConfirm: (taskId: string, patch: Pick<Task, 'actualStart' | 'actualEnd'>) => void;
}

/**
 * Popover do "caminho 1" de edição (spec Fase 3: campo que muda toda semana, editável direto,
 * sem abrir tela) — controlado (`open`/`onClose`) pra poder ser disparado tanto pelo link na
 * coluna Avanço quanto pelo item "Atualizar avanço" do menu `⋯`, sem duplicar UI.
 *
 * Não existe `%` bruto pra editar (avanço é sempre derivado — regra de ouro). O que existe é
 * marcar uma tarefa como concluída: a tarefa-foco (`computeFocusTask`) é só a SUGESTÃO inicial,
 * sempre trocável no `<select>` — sem isso o usuário concluiria a tarefa errada sem perceber
 * qual está gravando.
 */
export function InlineTaskProgressEdit({ project, open, onClose, onConfirm }: InlineTaskProgressEditProps) {
  const allTasks = project.activities.flatMap((a) => a.tasks);
  const incompleteTasks = allTasks.filter((t) => t.status !== 'completed');
  const focusTask = computeFocusTask(allTasks);

  const [taskId, setTaskId] = useState<string | undefined>(focusTask?.id);
  const [date, setDate] = useState(todayISO());

  if (!open || !focusTask) return null;

  const selectedTask = incompleteTasks.find((t) => t.id === taskId) ?? focusTask;

  return (
    <div
      className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-border bg-card p-3 text-left shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-semibold text-text">
        Marcar tarefa como concluída: <span className="text-action">{selectedTask.name}</span>
      </p>
      <label className="mt-2 block text-[11px] text-text-muted">
        Tarefa
        <select
          value={selectedTask.id}
          onChange={(e) => setTaskId(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-white px-2 py-1.5 text-xs text-text"
        >
          {incompleteTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-[11px] text-text-muted">
        Concluída em
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-white px-2 py-1.5 text-xs text-text"
        />
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            onConfirm(selectedTask.id, { actualStart: selectedTask.actualStart ?? date, actualEnd: date });
            onClose();
          }}
        >
          Confirmar
        </Button>
      </div>
    </div>
  );
}
