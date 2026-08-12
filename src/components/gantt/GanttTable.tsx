import { Fragment, useState, type CSSProperties, type RefObject } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { STATUS_LABEL, type ActivityView, type CategoryEntry, type Holiday, type Person, type ProjectView, type TaskView } from '../../types';
import {
  businessDaysBetween,
  computeDependencyRuleDate,
  computeProgressRatio,
  computeScheduleDeviationDays,
  formatDatePtBr,
  formatDuration,
  formatPeriod,
  isDependencyEdgeViolated,
  todayISO,
} from '../../utils';
import {
  buildVisibleRowIndex,
  computeArrowGroups,
  computeDependencyArrowGeometry,
  resolveVisibleDependencyEndpoint,
  type DependencyEdge,
} from './dependencyArrows';
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
import { GanttTooltip, TooltipRow, TooltipTitle } from './GanttTooltip';
import { RowTypeBadge } from './RowTypeBadge';
import { TodayLine } from './TodayLine';

const ROW_HEIGHT = 34;

type HoverTarget =
  | { level: 'task'; task: TaskView }
  | { level: 'activity'; activity: ActivityView; unit: string }
  | { level: 'project'; project: ProjectView };

interface TooltipRowData {
  label: string;
  value: string;
  tone?: 'delayed';
}

interface TooltipDependencyRowData {
  label: string;
  conflict?: string;
}

interface TooltipContent {
  title: string;
  rows: TooltipRowData[];
  dependencyRows: TooltipDependencyRowData[];
}

function realValue(actualStart?: string, actualEnd?: string): string {
  if (actualEnd) return formatPeriod(actualStart, actualEnd);
  if (actualStart) return `Em curso desde ${formatDatePtBr(actualStart)}`;
  return 'Não iniciado';
}

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
  /** Fase 5 — `undefined` enquanto o papel ainda não carregou, tratado como travado. */
  isAdmin: boolean | undefined;
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
  isAdmin,
  zoom,
  scrollContainerRef,
  onToggleProject,
  onToggleActivity,
  onOpenTask,
  onAddTask,
  onAddActivity,
  onRemoveActivity,
}: GanttTableProps) {
  // Fase 5 — `undefined` (carregando) conta como travado, nunca libera por engano.
  const locked = isAdmin !== true;
  const [hover, setHover] = useState<{ target: HoverTarget; x: number; y: number } | null>(null);
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
  const allTasks = projects.flatMap((p) => p.activities.flatMap((a) => a.tasks));

  // Fase 4, Commit 4 — setas de dependência: mapas de ancestralidade (pra resolver ponta dentro
  // de atividade/projeto recolhido) e unidade por tarefa (pra violação em dias úteis, que varia
  // por projeto quando esta tabela mostra o portfólio inteiro, não um projeto só).
  const tasksById = new Map(allTasks.map((t) => [t.id, t]));
  const taskToActivityId = new Map<string, string>();
  const activityToProjectId = new Map<string, string>();
  const unitByTaskId = new Map<string, string>();
  for (const project of projects) {
    for (const activity of project.activities) {
      activityToProjectId.set(activity.id, project.id);
      for (const task of activity.tasks) {
        taskToActivityId.set(task.id, activity.id);
        unitByTaskId.set(task.id, project.unit);
      }
    }
  }

  const dependencyEdges: DependencyEdge[] = allTasks.flatMap((task) =>
    task.dependencies.map((dep) => ({
      taskId: task.id,
      predecessorTaskId: dep.predecessorId,
      tipo: dep.tipo,
      folgaDias: dep.folgaDias,
      violated: isDependencyEdgeViolated(dep, tasksById.get(dep.predecessorId), task, holidays, unitByTaskId.get(task.id) ?? ''),
    })),
  );
  const violatedEdgeCount = dependencyEdges.filter((e) => e.violated).length;

  const visibleRowIndex = buildVisibleRowIndex(projects, collapsedProjectIds, collapsedActivityIds);
  const arrowGroups = computeArrowGroups(dependencyEdges, (taskId) =>
    resolveVisibleDependencyEndpoint(taskId, taskToActivityId, activityToProjectId, collapsedActivityIds, collapsedProjectIds),
  );
  const bodyHeight = visibleRowIndex.size * ROW_HEIGHT;

  // Fase 4, Commit 5 — tooltip: monta o conteúdo (não só a posição) aqui, porque é aqui que já
  // existem os mapas de pessoas/feriados/tarefas-por-id que o cálculo precisa — GanttTooltip.tsx
  // só recebe o resultado pronto e desenha. Reaproveita computeProgressRatio (novo, status.ts),
  // computeScheduleDeviationDays/computeDependencyRuleDate/isDependencyEdgeViolated (já existentes)
  // — nenhuma regra de negócio nova, só leitura do que já está calculado.
  function buildTooltipContent(target: HoverTarget): TooltipContent {
    if (target.level === 'task') {
      const { task } = target;
      const unit = unitByTaskId.get(task.id) ?? '';
      // Mesma contagem do selo R{n} da linha (Fase 2.5: só campo='previsto') — "(R4)" ao lado do
      // previsto mostra QUANTAS vezes ele já foi replanejado, não só que já mudou uma vez.
      const replanSuffix = task.replanCount ? ` (R${task.replanCount})` : '';
      const rows: TooltipRowData[] = [
        { label: 'Base', value: formatPeriod(task.baseStart, task.baseEnd) },
        { label: 'Previsto', value: formatPeriod(task.plannedStart, task.plannedEnd) + replanSuffix },
        { label: 'Real', value: realValue(task.actualStart, task.actualEnd) },
        { label: 'Avanço', value: STATUS_LABEL[task.status] },
        { label: 'Responsável', value: people.find((p) => p.id === task.responsavelId)?.name ?? '—' },
      ];
      const deviation = computeScheduleDeviationDays(
        { status: task.status, plannedEnd: task.plannedEnd, actualEnd: task.actualEnd, unit },
        today,
        holidays,
      );
      if (deviation > 0) rows.push({ label: 'Dias além do previsto', value: `${deviation}du`, tone: 'delayed' });

      const dependencyRows: TooltipDependencyRowData[] = task.dependencies.map((dep) => {
        const predecessor = tasksById.get(dep.predecessorId);
        const label = `#${predecessor?.rowNumber ?? '?'} · ${dep.tipo}${dep.folgaDias >= 0 ? '+' : ''}${dep.folgaDias}`;
        const violated = isDependencyEdgeViolated(dep, predecessor, task, holidays, unit);
        if (!violated || !predecessor) return { label };
        const ruleDate = computeDependencyRuleDate(dep, predecessor, holidays, unit);
        const verb = dep.tipo === 'FF' || dep.tipo === 'SF' ? 'terminar' : 'começar';
        return { label, conflict: `precisa ${verb} em ${formatDatePtBr(ruleDate)}` };
      });

      return { title: task.name, rows, dependencyRows };
    }

    if (target.level === 'activity') {
      const { activity, unit } = target;
      const rows: TooltipRowData[] = [
        { label: 'Previsto', value: formatPeriod(activity.plannedStart, activity.plannedEnd) },
        { label: 'Real', value: realValue(activity.actualStart, activity.actualEnd) },
      ];
      const ratio = computeProgressRatio(activity.tasks, holidays, unit);
      rows.push({ label: 'Avanço', value: `${ratio.qtdOk}/${ratio.qtd} tarefas · ${ratio.duOk}/${ratio.du}du` });
      const deviation = computeScheduleDeviationDays(
        { status: activity.status, plannedEnd: activity.plannedEnd, actualEnd: activity.actualEnd, unit },
        today,
        holidays,
      );
      if (deviation > 0) rows.push({ label: 'Dias além do previsto', value: `${deviation}du`, tone: 'delayed' });
      return { title: activity.name, rows, dependencyRows: [] };
    }

    const { project } = target;
    const rows: TooltipRowData[] = [
      { label: 'Previsto', value: formatPeriod(project.plannedStart, project.plannedEnd) },
      { label: 'Real', value: realValue(project.actualStart, project.actualEnd) },
    ];
    const ratio = computeProgressRatio(project.activities.flatMap((a) => a.tasks), holidays, project.unit);
    rows.push({ label: 'Avanço', value: `${ratio.qtdOk}/${ratio.qtd} tarefas · ${ratio.duOk}/${ratio.du}du` });
    const deviation = computeScheduleDeviationDays(
      { status: project.status, plannedEnd: project.plannedEnd, actualEnd: project.actualEnd, unit: project.unit },
      today,
      holidays,
    );
    if (deviation > 0) rows.push({ label: 'Dias além do previsto', value: `${deviation}du`, tone: 'delayed' });
    return { title: `${project.code} — ${project.name}`, rows, dependencyRows: [] };
  }

  const tooltipContent = hover ? buildTooltipContent(hover.target) : null;

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
    <div className="space-y-2">
    <div ref={scrollContainerRef} className="max-h-[70vh] overflow-auto rounded-lg border border-border">
    <div className="relative">
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
                <tr className="group border-b border-border bg-page/70">
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
                      {/* "+" sempre existe, só fica visível no hover da linha (spec: sem gate de
                          modo Editar) — a lixeira de excluir atividade continua atrás do modo
                          Editar, é ação destrutiva, não o que esta liberação pede. Travado por
                          papel (Fase 5): criar atividade é admin-only. */}
                      <button
                        type="button"
                        onClick={() => onAddActivity(project)}
                        disabled={locked}
                        title={locked ? 'Somente administrador pode criar atividade.' : undefined}
                        className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-action opacity-0 hover:underline group-hover:opacity-100 disabled:cursor-not-allowed disabled:no-underline"
                      >
                        <Plus className="h-3.5 w-3.5" /> Atividade
                      </button>
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
                  <td
                    className="relative h-[34px] px-4 py-0 align-middle"
                    style={{ width, ...timelineBackground }}
                    onMouseMove={(e) => setHover({ target: { level: 'project', project }, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHover(null)}
                  >
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
                        <tr className="group border-b border-border bg-page/35">
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
                              {/* "+" sempre existe, só fica visível no hover da linha — a lixeira
                                  (ação destrutiva) continua atrás do modo Editar. Travado por
                                  papel (Fase 5): criar tarefa é admin-only. */}
                              <button
                                type="button"
                                onClick={() => onAddTask(activity)}
                                disabled={locked}
                                title={locked ? 'Somente administrador pode criar tarefa.' : undefined}
                                className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-action opacity-0 hover:underline group-hover:opacity-100 disabled:cursor-not-allowed disabled:no-underline"
                              >
                                <Plus className="h-3.5 w-3.5" /> Tarefa
                              </button>
                              {editMode && (
                                <button
                                  type="button"
                                  onClick={() => onRemoveActivity(activity)}
                                  className="shrink-0 text-text-muted hover:text-status-delayed"
                                  aria-label="Excluir atividade"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
                          <td
                            className="relative h-[34px] px-4 py-0 align-middle"
                            style={{ width, ...timelineBackground }}
                            onMouseMove={(e) =>
                              setHover({ target: { level: 'activity', activity, unit: project.unit }, x: e.clientX, y: e.clientY })
                            }
                            onMouseLeave={() => setHover(null)}
                          >
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
                              categories={categories}
                              people={people}
                              holidays={holidays}
                              unit={project.unit}
                              columns={columns}
                              compact={compact}
                              onClick={() => onOpenTask(task)}
                              onHover={(hoveredTask, x, y) => setHover({ target: { level: 'task', task: hoveredTask }, x, y })}
                              onHoverEnd={() => setHover(null)}
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
      {/* Overlay de setas: um SVG só, por cima da tabela inteira, não uma por linha — precisa
          cruzar múltiplas linhas (predecessora numa atividade, sucessora noutra). Alinhado à
          mesma origem de coordenadas das barras: `left: leftWidth` pousa exatamente onde a
          coluna de timeline dos `<td>` começa (posicionamento absoluto ignora o padding do
          ancestral, mesma lógica de `GanttBars`/`TodayLine`), `top` pula só a altura do
          cabeçalho. `pointer-events-none` — a seta nunca deve capturar clique. */}
      <svg
        className="pointer-events-none absolute z-10"
        style={{ left: leftWidth, top: HEADER_ROW_HEIGHT * headerLevels.length }}
        width={width}
        height={bodyHeight}
      >
        {arrowGroups.map((group, index) => {
          const origem = visibleRowIndex.get(`${group.origem.level}:${group.origem.id}`);
          const destino = visibleRowIndex.get(`${group.destino.level}:${group.destino.id}`);
          if (!origem?.plannedStart || !origem.plannedEnd || !destino?.plannedStart || !destino.plannedEnd) return null;

          const geometry = computeDependencyArrowGeometry(
            group.tipo,
            group.folgaDias,
            { rowIndex: origem.rowIndex, plannedStart: origem.plannedStart, plannedEnd: origem.plannedEnd },
            { rowIndex: destino.rowIndex, plannedStart: destino.plannedStart, plannedEnd: destino.plannedEnd },
            range,
            pxPerDay,
            ROW_HEIGHT,
          );
          const color = group.violada ? 'var(--color-status-delayed)' : 'var(--color-text-muted2)';

          return (
            <g key={index}>
              <path
                d={geometry.path}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray={group.violada ? '4 3' : undefined}
              />
              <path d={geometry.arrowheadPath} fill={color} />
              {geometry.labelText && (
                <text x={geometry.labelX} y={geometry.labelY} textAnchor="middle" fontSize={9} fill={color}>
                  {geometry.labelText}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
    </div>
    {violatedEdgeCount > 0 && (
      <p className="text-xs font-medium text-status-delayed">
        {violatedEdgeCount} {violatedEdgeCount === 1 ? 'dependência violada' : 'dependências violadas'} (previsto em
        conflito com a regra da predecessora)
      </p>
    )}
    {hover && tooltipContent && (
      <GanttTooltip x={hover.x} y={hover.y}>
        <TooltipTitle>{tooltipContent.title}</TooltipTitle>
        {tooltipContent.rows.map((row) => (
          <TooltipRow key={row.label} label={row.label} value={row.value} tone={row.tone} />
        ))}
        {tooltipContent.dependencyRows.length > 0 && (
          <div className="space-y-0.5 border-t border-border pt-1.5">
            {tooltipContent.dependencyRows.map((dep, index) => (
              <p key={index} className={`truncate ${dep.conflict ? 'text-status-delayed' : 'text-text-muted'}`}>
                {dep.label}
                {dep.conflict ? ` — ${dep.conflict}` : ''}
              </p>
            ))}
          </div>
        )}
      </GanttTooltip>
    )}
    </div>
  );
}
