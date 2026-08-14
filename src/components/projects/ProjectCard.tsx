import type { Holiday, Person, ProjectView } from '../../types';
import { STATUS_COLOR } from '../../types';
import { computeExpectedProgress, computeScheduleDeviationDays } from '../../utils/portfolio';
import { Card } from '../ui';
import { StatusBadge } from '../shared/StatusBadge';
import { MiniGantt } from './MiniGantt';

interface ProjectCardProps {
  project: ProjectView;
  people: Person[];
  today: string;
  holidays: Holiday[];
  onOpen: (project: ProjectView) => void;
}

/**
 * Card empilhado (Fase 6/mobile) — larguras fixas (`w-40`/`w-48`/`w-32`) do desenho original
 * saíram, layout vertical. Toque abre o bottom sheet de detalhe (`MobileProjectSheet`); "Ver
 * atividades" fica dentro dele, não é mais a ação direta do card.
 */
export function ProjectCard({ project, people, today, holidays, onOpen }: ProjectCardProps) {
  const gerente = people.find((p) => p.id === project.gerenteId);
  const allTasks = project.activities.flatMap((a) => a.tasks);
  const expected = computeExpectedProgress(allTasks, today, holidays, project.unit);
  const deviation = computeScheduleDeviationDays(project, today, holidays);

  return (
    <Card className="min-h-11 cursor-pointer space-y-2 p-3" onClick={() => onOpen(project)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">
            {project.code} — {project.name}
          </p>
          <p className="truncate text-xs text-text-muted">
            {project.unit || project.sector} · {gerente?.name || 'Sem gerente'}
          </p>
        </div>
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
        isLateCompletion={project.isLateCompletion}
        today={today}
        size="compact"
      />

      <div className="flex items-center justify-between text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 w-20 rounded-full bg-page">
            <div
              className="h-1.5 rounded-full"
              style={{ width: `${project.progress}%`, backgroundColor: STATUS_COLOR[project.status] }}
            />
          </div>
          <span className="font-mono">
            {project.progress}% <span className="text-text-muted2">/ {expected}%</span>
          </span>
        </div>
        {deviation > 0 && <span className="font-semibold text-status-delayed">+{deviation}d</span>}
      </div>
    </Card>
  );
}
