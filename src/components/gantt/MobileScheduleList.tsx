import { useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { ProjectStatus, ProjectView, TaskView } from '../../types';
import { formatPeriod } from '../../utils';
import { computeStatusDistribution } from '../../utils/portfolio';
import { StatusEmoji } from '../shared/StatusEmoji';
import { Card } from '../ui';
import { StatusGrid } from '../projects';
import { RowTypeBadge } from './RowTypeBadge';

interface DatesLineProps {
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  className?: string;
}

/** "Previsto: ... / Real: ..." — mesma leitura do bottom sheet de projeto (`MobileProjectSheet`),
 * "Não iniciado" no lugar do intervalo quando ainda não existe actualStart (real parcial não faz
 * sentido mostrar como período). */
function DatesLine({ plannedStart, plannedEnd, actualStart, actualEnd, className = '' }: DatesLineProps) {
  return (
    <div className={`space-y-0.5 text-xs text-text-muted ${className}`}>
      <p>Previsto: {formatPeriod(plannedStart, plannedEnd)}</p>
      <p>Real: {actualStart ? formatPeriod(actualStart, actualEnd) : 'Não iniciado'}</p>
    </div>
  );
}

interface MobileScheduleListProps {
  projects: ProjectView[];
  collapsedActivityIds: Set<string>;
  onToggleActivity: (activityId: string) => void;
  onOpenTask: (task: TaskView) => void;
}

/** Lista em cards (atividade → tarefas) pro Cronograma no mobile — a tabela do Gantt desktop
 * (linhas de 34px, várias colunas fixas) não cabe numa tela estreita. Aqui nome + emoticon de
 * status + previsto/real por extenso; ver a barra do Gantt continua exclusivo do desktop
 * (decisão da Fase 6). Filtro de status é por TAREFA (o nível mais granular que tem emoticon) —
 * multi-seleção direta por toque, sem precisar de Ctrl (diferente dos cards de saúde do desktop,
 * que reservam o toque simples pra trocar a seleção inteira).
 */
export function MobileScheduleList({ projects, collapsedActivityIds, onToggleActivity, onOpenTask }: MobileScheduleListProps) {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus[]>([]);
  // Tarefa concluída fica escondida por padrão (a pedido do usuário, mesmo raciocínio do "Ocultar
  // concluídos" da lista de projetos em MobileSchedulePage.tsx) — só some quando NENHUM chip de
  // status está selecionado; tocar em "Concluído" (ou qualquer combinação de chips) sempre
  // sobrepõe esse padrão, porque nesse caso o filtro explícito já decide sozinho quem aparece.
  const hideCompletedByDefault = statusFilter.length === 0;

  function toggleStatusFilter(status: ProjectStatus) {
    setStatusFilter((current) => (current.includes(status) ? current.filter((s) => s !== status) : [...current, status]));
  }

  // Sempre conta TODAS as tarefas (não só as visíveis) — senão selecionar "Atrasado" zeraria a
  // contagem dos outros cards em vez de só filtrar a lista abaixo (mesmo raciocínio dos cards de
  // saúde do desktop). TaskStatus === ProjectStatus (mesmo union), então computeStatusDistribution
  // (feito pra projeto) já serve pra contar tarefa sem duplicar lógica.
  const allTasks = projects.flatMap((p) => p.activities.flatMap((a) => a.tasks));
  const distribution = computeStatusDistribution(allTasks);

  return (
    <div className="space-y-4">
      <StatusGrid
        distribution={distribution}
        isActive={(status) => statusFilter.includes(status)}
        onToggleStatus={toggleStatusFilter}
        title="Status das tarefas"
      />
      {statusFilter.length > 0 && (
        <button
          type="button"
          onClick={() => setStatusFilter([])}
          className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-semibold text-action"
        >
          <X className="h-3.5 w-3.5" /> Limpar filtro
        </button>
      )}

      {projects.map((project) => {
        const activitiesWithVisibleTasks = project.activities
          .map((activity) => ({
            activity,
            visibleTasks: activity.tasks.filter((t) =>
              statusFilter.length > 0 ? statusFilter.includes(t.status) : !hideCompletedByDefault || t.status !== 'completed',
            ),
          }))
          // Atividade sem NENHUMA tarefa cadastrada continua aparecendo (não tem o que esconder);
          // atividade com tarefa mas tudo escondido (ex.: todas concluídas, ocultas por padrão)
          // some da lista — é exatamente o "mais fácil de visualizar" que o usuário pediu.
          .filter(({ activity, visibleTasks }) => activity.tasks.length === 0 || visibleTasks.length > 0);

        return (
          <div key={project.id} className="space-y-2">
            {projects.length > 1 && (
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted2">
                {project.code} — {project.name}
              </p>
            )}

            {project.activities.length === 0 ? (
              <p className="px-1 text-sm text-text-muted">Nenhuma atividade cadastrada.</p>
            ) : activitiesWithVisibleTasks.length === 0 ? (
              <p className="px-1 text-sm text-text-muted">Nenhuma tarefa com esse status.</p>
            ) : (
              activitiesWithVisibleTasks.map(({ activity, visibleTasks }) => {
                const collapsed = collapsedActivityIds.has(activity.id);
                return (
                  <Card key={activity.id} className="overflow-hidden p-0">
                    <button
                      type="button"
                      onClick={() => onToggleActivity(activity.id)}
                      className="flex min-h-11 w-full flex-col gap-1 px-3 py-2.5 text-left"
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          {collapsed ? (
                            <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
                          )}
                          <RowTypeBadge type="activity" />
                          <span className="truncate text-sm font-medium text-text">{activity.name}</span>
                        </span>
                        <StatusEmoji status={activity.status} className="h-5 w-5 shrink-0" />
                      </span>
                      <DatesLine
                        plannedStart={activity.plannedStart}
                        plannedEnd={activity.plannedEnd}
                        actualStart={activity.actualStart}
                        actualEnd={activity.actualEnd}
                        className="pl-6"
                      />
                    </button>

                    {!collapsed && (
                      <ul className="divide-y divide-border border-t border-border">
                        {visibleTasks.length === 0 ? (
                          <li className="px-3 py-2 pl-9 text-xs text-text-muted">Nenhuma tarefa com esse status.</li>
                        ) : (
                          visibleTasks.map((task) => (
                            <li key={task.id}>
                              <button
                                type="button"
                                onClick={() => onOpenTask(task)}
                                className="flex min-h-11 w-full flex-col gap-1 py-2 pl-9 pr-3 text-left hover:bg-page"
                              >
                                <span className="flex w-full items-center justify-between gap-2">
                                  <span className="flex min-w-0 items-center gap-2">
                                    <RowTypeBadge type="task" />
                                    <span className="truncate text-sm text-text">{task.name}</span>
                                  </span>
                                  <StatusEmoji status={task.status} />
                                </span>
                                <DatesLine
                                  plannedStart={task.plannedStart}
                                  plannedEnd={task.plannedEnd}
                                  actualStart={task.actualStart}
                                  actualEnd={task.actualEnd}
                                />
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}
