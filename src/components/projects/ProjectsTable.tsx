import type { Holiday, Person, ProjectView, Task } from '../../types';
import { EmptyState } from '../ui';
import { ProjectRow } from './ProjectRow';

/** Compartilhado entre cabeçalho e linhas — nunca desalinham. */
export const PROJECTS_GRID_COLS = 'minmax(230px,1.5fr) 104px minmax(210px,1.35fr) 132px 92px 60px';

interface ProjectsTableProps {
  projects: ProjectView[];
  people: Person[];
  today: string;
  holidays: Holiday[];
  /** Fase 5 — `undefined` enquanto o papel ainda não carregou, tratado como travado. */
  isAdmin: boolean | undefined;
  onEdit: (project: ProjectView) => void;
  onDelete: (project: ProjectView) => void;
  onUpdateTask: (projectId: string, taskId: string, patch: Pick<Task, 'actualStart' | 'actualEnd'>) => void;
  onDuplicate: (project: ProjectView) => void;
}

export function ProjectsTable({
  projects,
  people,
  today,
  holidays,
  isAdmin,
  onEdit,
  onDelete,
  onUpdateTask,
  onDuplicate,
}: ProjectsTableProps) {
  if (projects.length === 0) {
    return <EmptyState title="Nenhum projeto encontrado" description="Ajuste os filtros para encontrar o que procura." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div
        className="grid items-center gap-3 border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted2"
        style={{ gridTemplateColumns: PROJECTS_GRID_COLS }}
      >
        <span>Projeto</span>
        <span>Status</span>
        <span>Cronograma</span>
        <span>Avanço real x previsto</span>
        <span className="text-right">Desvio</span>
        <span />
      </div>
      <div className="divide-y divide-border-2">
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            people={people}
            today={today}
            holidays={holidays}
            isAdmin={isAdmin}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdateTask={onUpdateTask}
            onDuplicate={onDuplicate}
          />
        ))}
      </div>
    </div>
  );
}
