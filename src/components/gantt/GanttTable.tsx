import { Fragment } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { ActivityView, CategoryEntry, ProjectView, TaskView } from '../../types';
import { formatDatePtBr } from '../../utils';
import { StatusBadge } from '../shared/StatusBadge';
import {
  calculatePortfolioRange,
  getMonthTicks,
  getWeekTicks,
  getYearTicks,
  LABEL_COLUMN_WIDTH,
  totalWidth,
} from './ganttMath';
import { GanttBars } from './GanttBars';
import { GanttRow } from './GanttRow';
import { RowTypeBadge } from './RowTypeBadge';
import { TodayLine } from './TodayLine';

interface GanttTableProps {
  projects: ProjectView[];
  collapsedProjectIds: Set<string>;
  collapsedActivityIds: Set<string>;
  categories: CategoryEntry[];
  /** Quando verdadeiro, mostra só Linha / Estrutura / Status / Gantt. */
  compact: boolean;
  /** Quando verdadeiro, mostra os botões de adicionar/excluir atividade e tarefa. */
  editMode: boolean;
  onToggleProject: (projectId: string) => void;
  onToggleActivity: (activityId: string) => void;
  onOpenTask: (task: TaskView) => void;
  onAddTask: (activity: ActivityView) => void;
  onAddActivity: (project: ProjectView) => void;
  onRemoveActivity: (activity: ActivityView) => void;
}

export function GanttTable({
  projects,
  collapsedProjectIds,
  collapsedActivityIds,
  categories,
  compact,
  editMode,
  onToggleProject,
  onToggleActivity,
  onOpenTask,
  onAddTask,
  onAddActivity,
  onRemoveActivity,
}: GanttTableProps) {
  const range = calculatePortfolioRange(projects);
  const width = totalWidth(range);
  const monthTicks = getMonthTicks(range);
  const yearTicks = getYearTicks(range);
  const weekTicks = getWeekTicks(range);
  const tasksByRowNumber = new Map(
    projects.flatMap((p) => p.activities.flatMap((a) => a.tasks)).map((t) => [t.rowNumber, t]),
  );

  const thClass = 'whitespace-nowrap bg-page px-4 align-middle sticky z-20';
  const dateTdClass = 'whitespace-nowrap px-4 py-3.5 text-center text-xs text-text-muted';
  const HEADER_ROW_HEIGHT = 30;
  // Larguras fixas das colunas congeladas (Linha/Estrutura/Status na visão compacta), usadas para alinhar o `left` do sticky.
  const LINHA_COL_WIDTH = 64; // w-16
  const ESTRUTURA_COL_WIDTH = 340;
  const STATUS_COL_LEFT = LINHA_COL_WIDTH + ESTRUTURA_COL_WIDTH;
  const frozenTdClass = 'sticky z-25';
  const estruturaThClass = compact ? 'w-[340px] truncate' : 'min-w-[340px]';

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-border">
      <table className="min-w-full border-collapse text-sm">
        <thead className="border-b border-border">
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-text-muted">
            <th rowSpan={3} className={`${thClass} top-0 left-0 z-30 w-16 text-center`}>
              Linha
            </th>
            <th
              rowSpan={3}
              className={`${thClass} top-0 z-30 ${estruturaThClass} ${!compact ? 'border-r border-border' : ''}`}
              style={{ left: LINHA_COL_WIDTH }}
            >
              Estrutura
            </th>
            {!compact && (
              <>
                <th rowSpan={3} className={`${thClass} top-0 min-w-[120px] text-center`}>
                  Categoria
                </th>
                <th rowSpan={3} className={`${thClass} top-0 min-w-[120px] text-center`}>
                  Predecessora(s)
                </th>
                <th rowSpan={3} className={`${thClass} top-0 min-w-[120px] text-center`}>
                  Início prev.
                </th>
                <th rowSpan={3} className={`${thClass} top-0 min-w-[120px] text-center`}>
                  Fim prev.
                </th>
                <th rowSpan={3} className={`${thClass} top-0 min-w-[120px] text-center`}>
                  Início real
                </th>
                <th rowSpan={3} className={`${thClass} top-0 min-w-[120px] text-center`}>
                  Fim real
                </th>
              </>
            )}
            <th
              rowSpan={3}
              className={`${thClass} top-0 min-w-[120px] text-center ${compact ? 'z-30 border-r border-border' : ''}`}
              style={compact ? { left: STATUS_COL_LEFT } : undefined}
            >
              Status
            </th>
            <th
              className={`relative ${thClass} top-0 border-b border-border/70`}
              style={{ width, height: HEADER_ROW_HEIGHT }}
            >
              <TodayLine range={range} />
              <div className="relative flex h-full" style={{ width, paddingLeft: LABEL_COLUMN_WIDTH }}>
                {yearTicks.map((tick) => (
                  <div
                    key={tick.key}
                    className="flex shrink-0 items-center justify-center border-l-2 border-border text-[11px] font-semibold normal-case text-text"
                    style={{ width: tick.days * 8 }}
                  >
                    {tick.label}
                  </div>
                ))}
              </div>
            </th>
          </tr>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-text-muted">
            <th
              className={`relative ${thClass} border-b border-border/70`}
              style={{ width, height: HEADER_ROW_HEIGHT, top: HEADER_ROW_HEIGHT }}
            >
              <div className="relative flex h-full" style={{ width, paddingLeft: LABEL_COLUMN_WIDTH }}>
                {monthTicks.map((tick) => (
                  <div
                    key={tick.key}
                    className="flex shrink-0 items-center justify-center border-l-2 border-border text-[10px] font-semibold normal-case text-text-muted"
                    style={{ width: tick.days * 8 }}
                  >
                    {tick.label}
                  </div>
                ))}
              </div>
            </th>
          </tr>
          <tr className="text-left text-xs font-medium text-text-muted">
            <th className={`relative ${thClass}`} style={{ width, height: HEADER_ROW_HEIGHT, top: HEADER_ROW_HEIGHT * 2 }}>
              <div className="relative flex h-full" style={{ width, paddingLeft: LABEL_COLUMN_WIDTH }}>
                {weekTicks.map((tick) => (
                  <div
                    key={tick.key}
                    className="flex shrink-0 items-center justify-center border-l border-border/60 text-[9px] normal-case text-text-muted/80"
                    style={{ width: tick.days * 8 }}
                  >
                    {tick.label}
                  </div>
                ))}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const projectCollapsed = collapsedProjectIds.has(project.id);
            return (
              <Fragment key={project.id}>
                <tr className="border-b border-border bg-page/70">
                  <td className={`${frozenTdClass} left-0 bg-card px-4 py-3.5 text-center text-xs text-text-muted`}>
                    —
                  </td>
                  <td
                    className={`${frozenTdClass} bg-card px-4 py-3.5 ${
                      compact ? 'w-[340px] overflow-hidden' : 'border-r border-border'
                    }`}
                    style={{ left: LINHA_COL_WIDTH }}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleProject(project.id)}
                        className="flex min-w-0 items-center gap-2 font-semibold text-text hover:text-action"
                      >
                        {projectCollapsed ? (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        )}
                        <RowTypeBadge type="project" />
                        <span className={compact ? 'truncate' : 'whitespace-nowrap'}>
                          {project.code} — {project.name}
                        </span>
                      </button>
                      {editMode && (
                        <button
                          type="button"
                          onClick={() => onAddActivity(project)}
                          className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-action hover:underline"
                        >
                          <Plus className="h-3.5 w-3.5" /> Atividade
                        </button>
                      )}
                    </div>
                  </td>
                  {!compact && (
                    <>
                      <td className="px-4 py-3.5 text-center text-xs text-text-muted">—</td>
                      <td className="px-4 py-3.5 text-center text-xs text-text-muted">—</td>
                      <td className={dateTdClass}>{formatDatePtBr(project.plannedStart)}</td>
                      <td className={dateTdClass}>{formatDatePtBr(project.plannedEnd)}</td>
                      <td className={dateTdClass}>{formatDatePtBr(project.actualStart)}</td>
                      <td className={dateTdClass}>{formatDatePtBr(project.actualEnd)}</td>
                    </>
                  )}
                  <td
                    className={`px-4 py-3.5 text-center ${
                      compact ? `${frozenTdClass} border-r border-border bg-card` : ''
                    }`}
                    style={compact ? { left: STATUS_COL_LEFT } : undefined}
                  >
                    <StatusBadge status={project.status} />
                  </td>
                  <td className="relative px-4 py-3.5" style={{ width }}>
                    <TodayLine range={range} />
                    <GanttBars
                      range={range}
                      plannedStart={project.plannedStart}
                      plannedEnd={project.plannedEnd}
                      actualStart={project.actualStart}
                      actualEnd={project.actualEnd}
                    />
                  </td>
                </tr>

                {!projectCollapsed &&
                  project.activities.map((activity) => {
                    const collapsed = collapsedActivityIds.has(activity.id);
                    return (
                      <Fragment key={activity.id}>
                        <tr className="border-b border-border bg-page/35">
                          <td className={`${frozenTdClass} left-0 bg-card px-4 py-3.5`} />
                          <td
                            className={`${frozenTdClass} bg-card py-3.5 pl-7 pr-4 ${
                              compact ? 'w-[340px] overflow-hidden' : 'border-r border-border'
                            }`}
                            style={{ left: LINHA_COL_WIDTH }}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <button
                                type="button"
                                onClick={() => onToggleActivity(activity.id)}
                                className="flex min-w-0 items-center gap-2 font-medium text-text hover:text-action"
                              >
                                {collapsed ? (
                                  <ChevronRight className="h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 shrink-0" />
                                )}
                                <RowTypeBadge type="activity" />
                                <span className={compact ? 'truncate' : 'whitespace-nowrap'}>{activity.name}</span>
                              </button>
                              {editMode && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onAddTask(activity)}
                                    className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-action hover:underline"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Tarefa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRemoveActivity(activity)}
                                    className="shrink-0 text-text-muted hover:text-status-delayed"
                                    aria-label="Excluir atividade"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          {!compact && (
                            <>
                              <td className="px-4 py-3.5" />
                              <td className="px-4 py-3.5" />
                              <td className={dateTdClass}>{formatDatePtBr(activity.plannedStart)}</td>
                              <td className={dateTdClass}>{formatDatePtBr(activity.plannedEnd)}</td>
                              <td className={dateTdClass}>{formatDatePtBr(activity.actualStart)}</td>
                              <td className={dateTdClass}>{formatDatePtBr(activity.actualEnd)}</td>
                            </>
                          )}
                          <td
                            className={`px-4 py-3.5 text-center ${
                              compact ? `${frozenTdClass} border-r border-border bg-card` : ''
                            }`}
                            style={compact ? { left: STATUS_COL_LEFT } : undefined}
                          >
                            <StatusBadge status={activity.status} />
                          </td>
                          <td className="relative px-4 py-3.5" style={{ width }}>
                            <TodayLine range={range} />
                            <GanttBars
                              range={range}
                              plannedStart={activity.plannedStart}
                              plannedEnd={activity.plannedEnd}
                              actualStart={activity.actualStart}
                              actualEnd={activity.actualEnd}
                            />
                          </td>
                        </tr>
                        {!collapsed &&
                          activity.tasks.map((task) => (
                            <GanttRow
                              key={task.id}
                              task={task}
                              range={range}
                              tasksByRowNumber={tasksByRowNumber}
                              categories={categories}
                              frozenColWidth={LINHA_COL_WIDTH}
                              statusColLeft={STATUS_COL_LEFT}
                              compact={compact}
                              onClick={() => onOpenTask(task)}
                            />
                          ))}
                      </Fragment>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
