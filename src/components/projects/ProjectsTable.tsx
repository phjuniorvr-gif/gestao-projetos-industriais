import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { Holiday, Person, ProjectView, Task } from '../../types';
import { EmptyState } from '../ui';
import { ProjectRow } from './ProjectRow';

/** Compartilhado entre cabeçalho e linhas — nunca desalinham. Coluna "Avanço real x previsto"
 * tirada por enquanto, a pedido do usuário (não removida do código, só escondida — ver
 * `ProjectRow.tsx`, o popover `InlineTaskProgressEdit` continua acessível pelo menu "⋯"). */
export const PROJECTS_GRID_COLS = 'minmax(230px,1.5fr) 104px minmax(210px,1.35fr) 92px 60px';

interface ProjectsTableProps {
  projects: ProjectView[];
  people: Person[];
  today: string;
  holidays: Holiday[];
  /** Fase 5 — `undefined` enquanto o papel ainda não carregou, tratado como travado. */
  isAdmin: boolean | undefined;
  /** `null` = ordenação padrão (criticidade, ProjectsPage.tsx/sortProjectsByCriticality). */
  nameSort: 'asc' | 'desc' | null;
  /** Clique no cabeçalho "Projeto" — cicla null → asc → desc → null (ProjectsPage.tsx). */
  onToggleNameSort: () => void;
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
  nameSort,
  onToggleNameSort,
  onEdit,
  onDelete,
  onUpdateTask,
  onDuplicate,
}: ProjectsTableProps) {
  if (projects.length === 0) {
    return <EmptyState title="Nenhum projeto encontrado" description="Ajuste os filtros para encontrar o que procura." />;
  }

  const SortIcon = nameSort === 'asc' ? ArrowUp : nameSort === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div
        className="grid items-center gap-3 border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted2"
        style={{ gridTemplateColumns: PROJECTS_GRID_COLS }}
      >
        <button
          type="button"
          onClick={onToggleNameSort}
          className={`flex items-center gap-1 uppercase tracking-wide hover:text-text-muted ${nameSort ? 'text-text-muted' : ''}`}
          title={nameSort === 'asc' ? 'Ordenado por código, crescente' : nameSort === 'desc' ? 'Ordenado por código, decrescente' : 'Ordenar por código'}
        >
          Projeto
          <SortIcon className="h-3 w-3" />
        </button>
        <span>Status</span>
        <span>Cronograma</span>
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
