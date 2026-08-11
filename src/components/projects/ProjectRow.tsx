import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Holiday, Person, ProjectView, Task } from '../../types';
import { STATUS_COLOR } from '../../types';
import { computeExpectedProgress, computeProjectTeam, computeScheduleDeviationDays } from '../../utils/portfolio';
import { StatusBadge } from '../shared/StatusBadge';
import { InlineTaskProgressEdit } from './InlineTaskProgressEdit';
import { MiniGantt } from './MiniGantt';
import { ProjectActionsMenu } from './ProjectActionsMenu';
import { PROJECTS_GRID_COLS } from './ProjectsTable';

interface ProjectRowProps {
  project: ProjectView;
  people: Person[];
  today: string;
  holidays: Holiday[];
  onEdit: (project: ProjectView) => void;
  onDelete: (project: ProjectView) => void;
  onUpdateTask: (projectId: string, taskId: string, patch: Pick<Task, 'actualStart' | 'actualEnd'>) => void;
  onDuplicate: (project: ProjectView) => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Linha da tabela de Projetos (Fase 3) — 6 colunas fixas via `PROJECTS_GRID_COLS`. */
export function ProjectRow({ project, people, today, holidays, onEdit, onDelete, onUpdateTask, onDuplicate }: ProjectRowProps) {
  const navigate = useNavigate();
  const gerente = people.find((p) => p.id === project.gerenteId);
  const team = computeProjectTeam(project, people);
  const deviationDays = computeScheduleDeviationDays(project, today, holidays);
  const allTasks = project.activities.flatMap((a) => a.tasks);
  const expected = computeExpectedProgress(allTasks, today, holidays, project.unit);
  const gap = expected - project.progress;
  const isCritical = project.status === 'delayed';
  const [progressPopoverOpen, setProgressPopoverOpen] = useState(false);

  const goToSchedule = () => navigate(`/projetos/${project.id}/cronograma`);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goToSchedule}
      onKeyDown={(e) => {
        if (e.key === 'Enter') goToSchedule();
      }}
      className="grid cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-page/60"
      style={{
        gridTemplateColumns: PROJECTS_GRID_COLS,
        boxShadow: isCritical ? 'inset 3px 0 0 var(--color-status-delayed)' : undefined,
      }}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold text-text">
          <span className="font-mono text-xs font-normal text-text-muted2">{project.code}</span> {project.name}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
          <span className="truncate">{project.unit}</span>
          {gerente && (
            <>
              <span>·</span>
              <span className="truncate">{gerente.name}</span>
              <span className="rounded border border-border px-1 text-[9.5px] uppercase text-text-muted2">gerente</span>
            </>
          )}
          {team.length > 0 && (
            <span className="ml-1 flex -space-x-1.5">
              {team.slice(0, 3).map(({ person, hasDelayedTask }) => (
                <span
                  key={person.id}
                  title={person.name}
                  className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2 border-card text-[9px] font-semibold ${
                    hasDelayedTask ? 'bg-status-delayed-bg text-status-delayed' : 'bg-border-2 text-text-muted'
                  }`}
                >
                  {initials(person.name)}
                </span>
              ))}
              {team.length > 3 && (
                <span className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border bg-card text-[9px] text-text-muted2">
                  +{team.length - 3}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <StatusBadge
          status={project.status}
          blockedCount={project.blockedCount}
          startDelayedCount={project.startDelayedCount}
          lateCompletion={project.isLateCompletion}
        />
      </div>

      <MiniGantt
        plannedStart={project.plannedStart}
        plannedEnd={project.plannedEnd}
        actualStart={project.actualStart}
        actualEnd={project.actualEnd}
        status={project.status}
        today={today}
      />

      <div className="relative">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-sm font-semibold text-text">{project.progress}%</span>
          <span className="text-[11px] text-text-muted2">prev. {expected}%</span>
        </div>
        <div className="relative mt-1 h-1.5 w-full rounded-full bg-page">
          <div
            className="h-1.5 rounded-full"
            style={{ width: `${project.progress}%`, backgroundColor: STATUS_COLOR[project.status] }}
          />
          <div className="absolute top-0 h-1.5 w-px bg-text-ink2" style={{ left: `${expected}%` }} />
        </div>
        <p className="mt-0.5 text-[10px] text-text-muted2">
          {allTasks.length === 0
            ? 'sem tarefas'
            : gap > 0
              ? `${gap} p.p. abaixo do previsto`
              : gap < 0
                ? `${-gap} p.p. acima do previsto`
                : 'em dia com o previsto'}
        </p>
        {allTasks.some((t) => t.status !== 'completed') && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setProgressPopoverOpen((o) => !o);
            }}
            className="mt-0.5 text-[10px] font-medium text-action hover:underline"
          >
            Atualizar avanço
          </button>
        )}
        <InlineTaskProgressEdit
          project={project}
          open={progressPopoverOpen}
          onClose={() => setProgressPopoverOpen(false)}
          onConfirm={(taskId, patch) => onUpdateTask(project.id, taskId, patch)}
        />
      </div>

      <div className="text-right">
        {project.status === 'delayed' ? (
          <span className="font-mono text-xs font-semibold text-status-delayed">+{deviationDays}d</span>
        ) : project.status === 'completed' ? (
          project.isLateCompletion ? (
            <span className="font-mono text-xs font-semibold text-status-delayed">+{deviationDays}d</span>
          ) : (
            <span className="text-xs font-medium text-status-done">no prazo</span>
          )
        ) : project.status === 'in_progress' ? (
          <span className="text-xs text-text-muted">{gap > 0 ? `-${gap}%` : `+${-gap}%`} vs previsto</span>
        ) : (
          <span className="text-xs text-text-muted2">— não iniciado</span>
        )}
      </div>

      <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
        <ProjectActionsMenu
          activityCount={project.activities.length}
          onEdit={() => onEdit(project)}
          onViewActivities={goToSchedule}
          onUpdateProgress={() => setProgressPopoverOpen(true)}
          onDuplicate={() => onDuplicate(project)}
          onDelete={() => onDelete(project)}
        />
      </div>
    </div>
  );
}
