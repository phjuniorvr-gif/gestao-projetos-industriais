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
  onDemoteToPipeline: (project: ProjectView) => void;
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
  onDemoteToPipeline,
}: ProjectsTableProps) {
  if (projects.length === 0) {
    return <EmptyState title="Nenhum projeto encontrado" description="Ajuste os filtros para encontrar o que procura." />;
  }

  const SortIcon = nameSort === 'asc' ? ArrowUp : nameSort === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    // SEM `overflow-x-auto` de propósito (tentativa revertida na mesma sessão, ver CLAUDE.md) —
    // `overflow-x-auto` sozinho faz o navegador computar `overflow-y` como `auto` TAMBÉM, mesmo
    // com `overflow-y-visible` escrito ao lado: a regra do spec CSS força os dois eixos a ficarem
    // não-`visible` juntos sempre que QUALQUER um dos dois não é `visible`, não tem como escapar
    // escrevendo o outro eixo explicitamente. Isso cortava o menu "⋯" (`ProjectActionsMenu.tsx`,
    // `position: absolute`) sempre que abria perto do fim da tabela. As colunas (`PROJECTS_GRID_COLS`)
    // somam bem menos que a largura de qualquer tela desktop real (~700px de mínimo), então essa
    // tabela nunca precisou de scroll horizontal de verdade — diferente do Gantt (`GanttTable.tsx`),
    // que soma bem mais que isso e mantém `overflow-auto` (sem esse problema porque não tem menu
    // `position: absolute` dentro, só o painel de dependência com posicionamento próprio).
    <div className="rounded-xl border border-border bg-card">
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
            onDemoteToPipeline={onDemoteToPipeline}
          />
        ))}
      </div>
    </div>
  );
}
