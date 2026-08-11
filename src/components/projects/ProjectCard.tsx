import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import type { Person, ProjectView } from '../../types';
import { STATUS_COLOR } from '../../types';
import { formatPeriod } from '../../utils';
import { Card } from '../ui';
import { StatusBadge } from '../shared/StatusBadge';

interface ProjectCardProps {
  project: ProjectView;
  people: Person[];
  onEdit: (project: ProjectView) => void;
  onDelete: (project: ProjectView) => void;
}

export function ProjectCard({ project, people, onEdit, onDelete }: ProjectCardProps) {
  const navigate = useNavigate();
  const gerente = people.find((p) => p.id === project.gerenteId);
  const taskCount = project.activities.reduce((sum, a) => sum + a.tasks.length, 0);
  const dependencyCount = project.activities.reduce(
    (sum, a) => sum + a.tasks.reduce((s, t) => s + t.predecessorRowNumbers.length, 0),
    0,
  );

  return (
    <Card
      className="cursor-pointer p-4 transition-colors hover:border-text-muted2"
      onClick={() => navigate(`/projetos/${project.id}/cronograma`)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <p className="font-semibold text-text">
            {project.code} — {project.name}
          </p>
          <p className="text-xs text-text-muted">
            {project.unit || project.sector} · {gerente?.name || 'Sem gerente'}
          </p>
        </div>

        <div className="w-40">
          <StatusBadge
            status={project.status}
            blockedCount={project.blockedCount}
            startDelayedCount={project.startDelayedCount}
            lateCompletion={project.isLateCompletion}
          />
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-page">
            <div
              className="h-1.5 rounded-full"
              style={{ width: `${project.progress}%`, backgroundColor: STATUS_COLOR[project.status] }}
            />
          </div>
          <span className="text-[11px] text-text-muted">{project.progress}%</span>
        </div>

        <div className="w-48 text-xs text-text-muted">
          <p>Previsto: {formatPeriod(project.plannedStart, project.plannedEnd)}</p>
          <p>Real: {project.actualStart ? formatPeriod(project.actualStart, project.actualEnd) : 'Não iniciado'}</p>
        </div>

        <div className="w-32 text-xs text-text-muted">
          <p>{project.activities.length} atividade(s)</p>
          <p>{dependencyCount} dependência(s)</p>
          <p>{taskCount} tarefa(s)</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(project);
            }}
            className="rounded-md p-2 text-text-muted hover:bg-page hover:text-text"
            aria-label="Editar projeto"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(project);
            }}
            className="rounded-md p-2 text-text-muted hover:bg-status-delayed/10 hover:text-status-delayed"
            aria-label="Excluir projeto"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}
