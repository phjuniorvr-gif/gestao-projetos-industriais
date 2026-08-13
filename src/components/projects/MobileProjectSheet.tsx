import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { Holiday, ProjectView, TaskView } from '../../types';
import { businessDaysBetween, formatPeriod, todayISO } from '../../utils';
import { computeExpectedProgress, computeScheduleDeviationDays } from '../../utils/portfolio';
import { BottomSheet, Button } from '../ui';
import { MiniGantt } from './MiniGantt';

interface MobileProjectSheetProps {
  project: ProjectView | null;
  today: string;
  holidays: Holiday[];
  onClose: () => void;
  /** Já escopado ao `project.id` por quem monta o sheet (mesmo formato de `updateTaskActualDates`). */
  onUpdateTask: (taskId: string, patch: { actualStart?: string; actualEnd?: string }) => void;
  onShowUndo: (message: string, onUndo: () => void) => void;
}

/**
 * Bottom sheet de detalhe de projeto (Fase 6/mobile) — substitui o painel lateral desktop
 * (`ProjectDetailPanel`) nas abas Projetos e Cronograma. "Tarefas em aberto" com "✓ Concluir" é a
 * única ação de escrita no mobile (reaproveita `updateTaskActualDates`, Fase 5) — sem view de
 * tarefa própria, sem criar/editar projeto (exclusivo do desktop).
 */
export function MobileProjectSheet({ project, today, holidays, onClose, onUpdateTask, onShowUndo }: MobileProjectSheetProps) {
  if (!project) return null;

  const allTasks = project.activities.flatMap((a) => a.tasks);
  const openTasks = allTasks.filter((t) => t.status !== 'completed');
  const expected = computeExpectedProgress(allTasks, today, holidays, project.unit);
  const deviation = computeScheduleDeviationDays(project, today, holidays);
  const durationDays =
    project.plannedStart && project.plannedEnd
      ? businessDaysBetween(project.plannedStart, project.plannedEnd, holidays, project.unit)
      : undefined;

  function handleComplete(task: TaskView) {
    const hoje = todayISO();
    const previousActualStart = task.actualStart;
    const previousActualEnd = task.actualEnd;
    // Grava actualStart junto quando ainda não existe (mesma data de hoje) — mesma regra de
    // InlineTaskProgressEdit.tsx (desktop): sem isso a tarefa fica concluída sem nunca ter
    // começado, e rollUpDates/MiniGantt desenhariam a trilha real sem início.
    onUpdateTask(task.id, { actualStart: task.actualStart ?? hoje, actualEnd: hoje });
    onShowUndo(`"${task.name}" marcada como concluída`, () => {
      onUpdateTask(task.id, { actualStart: previousActualStart, actualEnd: previousActualEnd });
    });
  }

  return (
    <BottomSheet open onClose={onClose}>
      <div className="flex items-start justify-between border-b border-border px-4 pb-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-text-muted2">{project.code}</p>
          <p className="truncate text-base font-semibold text-text">{project.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted hover:text-text"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-text-muted2">Avanço real</p>
            <p className="font-mono font-semibold text-text">{project.progress}%</p>
          </div>
          <div>
            <p className="text-xs text-text-muted2">Previsto pra hoje</p>
            <p className="font-mono font-semibold text-text">{expected}%</p>
          </div>
          <div>
            <p className="text-xs text-text-muted2">Desvio</p>
            <p className="font-mono font-semibold text-text">{deviation > 0 ? `+${deviation}d` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted2">Duração</p>
            <p className="font-mono font-semibold text-text">{durationDays !== undefined ? `${durationDays}d úteis` : '—'}</p>
          </div>
        </div>

        <MiniGantt
          plannedStart={project.plannedStart}
          plannedEnd={project.plannedEnd}
          actualStart={project.actualStart}
          actualEnd={project.actualEnd}
          status={project.status}
          today={today}
          size="compact"
        />

        <div className="space-y-0.5 text-xs text-text-muted">
          <p>Previsto: {formatPeriod(project.plannedStart, project.plannedEnd)}</p>
          <p>Real: {project.actualStart ? formatPeriod(project.actualStart, project.actualEnd) : 'Não iniciado'}</p>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted2">
            Tarefas em aberto {openTasks.length > 0 && `(${openTasks.length})`}
          </h3>
          {openTasks.length === 0 ? (
            <p className="text-sm text-text-muted">Todas as tarefas estão concluídas.</p>
          ) : (
            <ul className="space-y-1.5">
              {openTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm text-text">{task.name}</span>
                  <button
                    type="button"
                    onClick={() => handleComplete(task)}
                    className="flex min-h-11 shrink-0 items-center px-2 text-sm font-semibold text-action"
                  >
                    ✓ Concluir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <Link to={`/projetos/${project.id}/cronograma`} className="block">
          <Button variant="ghost" className="min-h-11 w-full">
            Ver atividades
          </Button>
        </Link>
      </div>
    </BottomSheet>
  );
}
