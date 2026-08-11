import { Fragment, type CSSProperties, type RefObject } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { ActivityView, CategoryEntry, Holiday, Person, ProjectView, TaskView } from '../../types';
import { businessDaysBetween, formatDatePtBr, formatDuration, todayISO } from '../../utils';
import { getColumnRect, getGanttColumns, getGanttLeftWidth, type GanttColumnKey } from './ganttColumns';
import { GanttProgressCell } from './GanttProgressCell';
import {
  calculatePortfolioRange,
  getDayTicks,
  getMonthTicks,
  getWeekTicks,
  getYearTicks,
  totalWidth,
  ZOOM_PX_PER_DAY,
  type GanttZoom,
} from './ganttMath';
import { GanttSummaryBar } from './GanttSummaryBar';
import { GanttRow } from './GanttRow';
import { RowTypeBadge } from './RowTypeBadge';
import { TodayLine } from './TodayLine';

interface GanttTableProps {
  projects: ProjectView[];
  collapsedProjectIds: Set<string>;
  collapsedActivityIds: Set<string>;
  categories: CategoryEntry[];
  people: Person[];
  holidays: Holiday[];
  /** Quando verdadeiro, mostra só Linha / Estrutura / Avanço. */
  compact: boolean;
  /** Quando verdadeiro, mostra os botões de adicionar/excluir atividade e tarefa. */
  editMode: boolean;
  zoom: GanttZoom;
  /** Container com scroll horizontal — exposto pro botão "Ir para hoje" da página calcular o
   * `scrollLeft`, sem duplicar o cálculo de range/colunas fora deste componente. */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  onToggleProject: (projectId: string) => void;
  onToggleActivity: (activityId: string) => void;
  onOpenTask: (task: TaskView) => void;
  onAddTask: (activity: ActivityView) => void;
  onAddActivity: (project: ProjectView) => void;
  onRemoveActivity: (activity: ActivityView) => void;
}

interface HeaderTick {
  key: string;
  label: string;
  days: number;
}

// Fase 4, Commit 3 — grade vertical + sombreamento de fim de semana, desenhados como camadas de
// `background-image` na célula do Gantt (não como overlay separado): início de cada mês sempre
// tem uma linha; início de cada semana só quando zoom==='semana'; fim de semana sombreado nos
// zooms dia/semana. `backgroundImage` (não o shorthand `background`) pra não pisar no
// `background-color` que a classe Tailwind da célula já define.
function buildTimelineBackground(
  weekTicks: { offsetDays: number }[],
  weekendOffsetDays: number[],
  pxPerDay: number,
  zoom: GanttZoom,
  monthOffsets: number[],
): CSSProperties {
  const images: string[] = [];
  const positions: string[] = [];
  const sizes: string[] = [];

  if (zoom !== 'mes') {
    for (const offsetDays of weekendOffsetDays) {
      images.push('linear-gradient(var(--color-page), var(--color-page))');
      positions.push(`${offsetDays * pxPerDay}px 0`);
      sizes.push(`${pxPerDay}px 100%`);
    }
  }

  for (const offsetDays of monthOffsets) {
    if (offsetDays === 0) continue;
    images.push('linear-gradient(var(--color-border), var(--color-border))');
    positions.push(`${offsetDays * pxPerDay}px 0`);
    sizes.push('1px 100%');
  }

  if (zoom === 'semana') {
    for (const tick of weekTicks) {
      if (tick.offsetDays === 0) continue;
      images.push('linear-gradient(var(--color-border-2), var(--color-border-2))');
      positions.push(`${tick.offsetDays * pxPerDay}px 0`);
      sizes.push('1px 100%');
    }
  }

  if (images.length === 0) return {};
  return {
    backgroundImage: images.join(', '),
    backgroundPosition: positions.join(', '),
    backgroundSize: sizes.join(', '),
    backgroundRepeat: 'no-repeat',
  };
}

export function GanttTable({
  projects,
  collapsedProjectIds,
  collapsedActivityIds,
  categories,
  people,
  holidays,
  compact,
  editMode,
  zoom,
  scrollContainerRef,
  onToggleProject,
  onToggleActivity,
  onOpenTask,
  onAddTask,
  onAddActivity,
  onRemoveActivity,
}: GanttTableProps) {
  const pxPerDay = ZOOM_PX_PER_DAY[zoom];
  const today = todayISO();
  const range = calculatePortfolioRange(projects);
  const width = totalWidth(range, pxPerDay);
  const monthTicks = getMonthTicks(range);
  const yearTicks = getYearTicks(range);
  const weekTicks = getWeekTicks(range);
  const dayTicks = zoom === 'dia' ? getDayTicks(range, today) : [];
  const weekendOffsetDays =
    zoom === 'mes' ? [] : getDayTicks(range, today).filter((d) => d.isWeekend).map((d) => d.offsetDays);
  const tasksByRowNumber = new Map(
    projects.flatMap((p) => p.activities.flatMap((a) => a.tasks)).map((t) => [t.rowNumber, t]),
  );

  // Fase 4: largura do painel esquerdo somada de uma lista única de colunas (ganttColumns.ts) —
  // nunca mais escrita à mão (era o bug que a spec avisa: LINHA_COL_WIDTH/ESTRUTURA_COL_WIDTH/
  // STATUS_COL_LEFT hardcoded, cada um separado, sem garantia de bater com o que é renderizado).
  const columns = getGanttColumns(!compact);
  const leftWidth = getGanttLeftWidth(columns);
  const lastColumnKey = columns[columns.length - 1].key;

  const timelineBackground = buildTimelineBackground(
    weekTicks,
    weekendOffsetDays,
    pxPerDay,
    zoom,
    monthTicks.map((t) => t.offsetDays),
  );

  // Cabeçalho de 2 níveis (zoom mês/dia) ou 3 (zoom semana, comportamento anterior ao zoom
  // existir) — nível 1 é sempre o mais "grosso" (ano ou mês), o último nível é o mais fino
  // (mês, semana ou dia) e ganha a borda mais leve.
  const headerLevels: HeaderTick[][] =
    zoom === 'mes'
      ? [yearTicks, monthTicks]
      : zoom === 'semana'
        ? [yearTicks, monthTicks, weekTicks]
        : [monthTicks, dayTicks.map((d) => ({ key: d.key, label: d.label, days: 1 }))];

  // px-2 (não px-4): colunas como Linha/Dur. têm só 40-46px — com px-4 (16px de cada lado) sobra
  // pouco mais de 8px de área útil de texto, cortando "Linha" pra "LINH" mesmo cabendo de sobra
  // em largura de coluna. px-2 (8px cada lado) é o mesmo respiro que o protótipo usa nas colunas
  // do painel esquerdo.
  const thClass = 'truncate bg-page px-2 align-middle sticky z-30';
  const HEADER_ROW_HEIGHT = 30;
  // Painel inteiro (todas as colunas, não só Linha/Estrutura) é sticky — é o que "painel
  // esquerdo" quer dizer: fica fixo enquanto o Gantt rola por baixo. `truncate` aqui (não só na
  // Estrutura) — sem isso "26/08/2026 até 17/01/2027" quebra em 3 linhas dentro dos 104px da
  // coluna Previsto/Real e a linha de Projeto/Atividade cresce bem além dos 34px (era exatamente
  // esse o efeito visto no checkpoint).
  const frozenTdClass = 'sticky z-25 h-[34px] truncate bg-card px-2 py-0 align-middle';

  function columnStyle(key: GanttColumnKey) {
    return getColumnRect(columns, key);
  }

  return (
    <div ref={scrollContainerRef} className="max-h-[70vh] overflow-auto rounded-lg border border-border">
      {/* table-layout: fixed + largura total explícita — sem isso, o layout automático deixa
          conteúdo mais largo que a coluna declarada esticar a coluna de verdade, o `left` das
          colunas sticky seguintes fica errado, e o Gantt (que não é sticky, só flui depois) passa
          por cima do painel esquerdo. Largura vem inteira de getGanttLeftWidth/totalWidth — mesma
          fonte única das colunas, nunca dois números que podem divergir. */}
      <table className="table-fixed border-collapse text-sm" style={{ width: leftWidth + width }}>
        <thead className="border-b border-border">
          {headerLevels.map((level, levelIndex) => (
            <tr key={levelIndex} className="text-left text-xs font-medium uppercase tracking-wide text-text-muted">
              {levelIndex === 0 &&
                columns.map((column) => (
                  <th
                    key={column.key}
                    rowSpan={headerLevels.length}
                    className={`${thClass} top-0 ${column.align === 'right' || column.key === 'linha' ? 'text-right' : column.key === 'estrutura' ? 'text-left' : 'text-center'} ${column.key === lastColumnKey ? 'border-r border-border' : ''}`}
                    style={columnStyle(column.key)}
                  >
                    {column.label}
                  </th>
                ))}
              <th
                className={`relative ${thClass} ${levelIndex === headerLevels.length - 1 ? '' : 'border-b border-border/70'}`}
                style={{ width, height: HEADER_ROW_HEIGHT, top: HEADER_ROW_HEIGHT * levelIndex }}
              >
                {levelIndex === 0 && <TodayLine range={range} pxPerDay={pxPerDay} showLabel />}
                <div className="relative flex h-full" style={{ width }}>
                  {level.map((tick) => (
                    <div
                      key={tick.key}
                      className={`flex shrink-0 items-center justify-center border-l-2 border-border normal-case ${
                        levelIndex === 0
                          ? 'text-[11px] font-semibold text-text'
                          : levelIndex === headerLevels.length - 1
                            ? 'border-l border-l-border/60 text-[9px] font-normal text-text-muted/80'
                            : 'text-[10px] font-semibold text-text-muted'
                      }`}
                      style={{ width: tick.days * pxPerDay }}
                    >
                      {tick.label}
                    </div>
                  ))}
                </div>
              </th>
            </tr>
          ))}
        </thead>
        <tbody>
          {projects.map((project) => {
            const projectCollapsed = collapsedProjectIds.has(project.id);
            return (
              <Fragment key={project.id}>
                <tr className="border-b border-border bg-page/70">
                  <td className={`${frozenTdClass} text-center text-xs text-text-muted`} style={columnStyle('linha')}>
                    —
                  </td>
                  <td className={`${frozenTdClass} overflow-hidden`} style={columnStyle('estrutura')}>
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
                        <span className="truncate">
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
                      <td className={frozenTdClass} style={columnStyle('categoria')} />
                      <td className={frozenTdClass} style={columnStyle('responsavel')} />
                      <td
                        className={`${frozenTdClass} text-center text-xs text-text-muted`}
                        style={columnStyle('inicioPrevisto')}
                      >
                        {formatDatePtBr(project.plannedStart)}
                      </td>
                      <td
                        className={`${frozenTdClass} text-center text-xs text-text-muted`}
                        style={columnStyle('fimPrevisto')}
                      >
                        {formatDatePtBr(project.plannedEnd)}
                      </td>
                      <td
                        className={`${frozenTdClass} text-center text-xs text-text-muted`}
                        style={columnStyle('inicioReal')}
                      >
                        {formatDatePtBr(project.actualStart)}
                      </td>
                      <td className={`${frozenTdClass} text-center text-xs text-text-muted`} style={columnStyle('fimReal')}>
                        {formatDatePtBr(project.actualEnd)}
                      </td>
                      <td className={`${frozenTdClass} text-center text-xs text-text-muted`} style={columnStyle('duracao')}>
                        {formatDuration(
                          project.activities
                            .flatMap((a) => a.tasks)
                            .reduce((sum, t) => sum + businessDaysBetween(t.plannedStart, t.plannedEnd, holidays, project.unit), 0),
                        )}
                      </td>
                    </>
                  )}
                  <td
                    className={`${frozenTdClass} text-center ${compact ? 'border-r border-border' : ''}`}
                    style={columnStyle('avanco')}
                  >
                    <GanttProgressCell progress={project.progress} />
                  </td>
                  <td className="relative h-[34px] px-4 py-0 align-middle" style={{ width, ...timelineBackground }}>
                    <TodayLine range={range} pxPerDay={pxPerDay} />
                    <GanttSummaryBar
                      range={range}
                      pxPerDay={pxPerDay}
                      status={project.status}
                      plannedStart={project.plannedStart}
                      plannedEnd={project.plannedEnd}
                      actualStart={project.actualStart}
                      actualEnd={project.actualEnd}
                      progress={project.progress}
                    />
                  </td>
                </tr>

                {!projectCollapsed &&
                  project.activities.map((activity) => {
                    const collapsed = collapsedActivityIds.has(activity.id);
                    return (
                      <Fragment key={activity.id}>
                        <tr className="border-b border-border bg-page/35">
                          <td className={frozenTdClass} style={columnStyle('linha')} />
                          <td className={`${frozenTdClass} overflow-hidden !pl-7`} style={columnStyle('estrutura')}>
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
                                <span className="truncate">{activity.name}</span>
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
                              <td className={frozenTdClass} style={columnStyle('categoria')} />
                              <td className={frozenTdClass} style={columnStyle('responsavel')} />
                              <td
                                className={`${frozenTdClass} text-center text-xs text-text-muted`}
                                style={columnStyle('inicioPrevisto')}
                              >
                                {formatDatePtBr(activity.plannedStart)}
                              </td>
                              <td
                                className={`${frozenTdClass} text-center text-xs text-text-muted`}
                                style={columnStyle('fimPrevisto')}
                              >
                                {formatDatePtBr(activity.plannedEnd)}
                              </td>
                              <td
                                className={`${frozenTdClass} text-center text-xs text-text-muted`}
                                style={columnStyle('inicioReal')}
                              >
                                {formatDatePtBr(activity.actualStart)}
                              </td>
                              <td
                                className={`${frozenTdClass} text-center text-xs text-text-muted`}
                                style={columnStyle('fimReal')}
                              >
                                {formatDatePtBr(activity.actualEnd)}
                              </td>
                              <td
                                className={`${frozenTdClass} text-center text-xs text-text-muted`}
                                style={columnStyle('duracao')}
                              >
                                {formatDuration(
                                  activity.tasks.reduce(
                                    (sum, t) => sum + businessDaysBetween(t.plannedStart, t.plannedEnd, holidays, project.unit),
                                    0,
                                  ),
                                )}
                              </td>
                            </>
                          )}
                          <td
                            className={`${frozenTdClass} text-center ${compact ? 'border-r border-border' : ''}`}
                            style={columnStyle('avanco')}
                          >
                            <GanttProgressCell progress={activity.progress} />
                          </td>
                          <td className="relative h-[34px] px-4 py-0 align-middle" style={{ width, ...timelineBackground }}>
                            <TodayLine range={range} pxPerDay={pxPerDay} />
                            <GanttSummaryBar
                              range={range}
                              pxPerDay={pxPerDay}
                              status={activity.status}
                              plannedStart={activity.plannedStart}
                              plannedEnd={activity.plannedEnd}
                              actualStart={activity.actualStart}
                              actualEnd={activity.actualEnd}
                              progress={activity.progress}
                            />
                          </td>
                        </tr>
                        {!collapsed &&
                          activity.tasks.map((task) => (
                            <GanttRow
                              key={task.id}
                              task={task}
                              range={range}
                              pxPerDay={pxPerDay}
                              timelineBackground={timelineBackground}
                              tasksByRowNumber={tasksByRowNumber}
                              categories={categories}
                              people={people}
                              holidays={holidays}
                              unit={project.unit}
                              columns={columns}
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
