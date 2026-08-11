import type { CSSProperties } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { CategoryEntry, Holiday, Person, TaskView } from '../../types';
import { businessDaysBetween, formatDatePtBr, formatDuration } from '../../utils';
import { Badge } from '../ui';
import { StatusBadge } from '../shared/StatusBadge';
import { getColumnRect, type GanttColumn } from './ganttColumns';
import { totalWidth, type DateRange } from './ganttMath';
import { GanttBars } from './GanttBars';
import { RowTypeBadge } from './RowTypeBadge';
import { TodayLine } from './TodayLine';

interface GanttRowProps {
  task: TaskView;
  range: DateRange;
  pxPerDay: number;
  timelineBackground: CSSProperties;
  tasksByRowNumber: Map<number, TaskView>;
  categories: CategoryEntry[];
  people: Person[];
  holidays: Holiday[];
  unit: string;
  columns: GanttColumn[];
  compact: boolean;
  onClick: () => void;
}

const cellClass = 'h-[34px] overflow-hidden truncate px-2 py-0 text-center align-middle text-xs text-text-muted';

export function GanttRow({
  task,
  range,
  pxPerDay,
  timelineBackground,
  tasksByRowNumber,
  categories,
  people,
  holidays,
  unit,
  columns,
  compact,
  onClick,
}: GanttRowProps) {
  const width = totalWidth(range, pxPerDay);
  const category = categories.find((c) => c.id === task.category);
  const responsavel = people.find((p) => p.id === task.responsavelId);
  const estrutura = getColumnRect(columns, 'estrutura');
  const avanco = getColumnRect(columns, 'avanco');

  const predecessorEnds = task.predecessorRowNumbers
    .map((rowNumber) => tasksByRowNumber.get(rowNumber)?.plannedEnd)
    .filter((date): date is string => Boolean(date));
  const connectorFromISO = predecessorEnds.length ? predecessorEnds.sort().at(-1) : undefined;

  return (
    <tr className="border-b border-border/70 bg-card hover:bg-page/60">
      <td
        className="sticky z-25 h-[34px] truncate bg-card px-2 py-0 text-center align-middle text-xs text-text-muted"
        style={{ left: getColumnRect(columns, 'linha').left, width: getColumnRect(columns, 'linha').width }}
      >
        {task.rowNumber}
      </td>
      <td
        className={`sticky z-25 h-[34px] overflow-hidden bg-card py-0 pl-14 pr-4 align-middle ${compact ? '' : 'border-r border-border'}`}
        style={{ left: estrutura.left, width: estrutura.width }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <RowTypeBadge type="task" />
          <button
            type="button"
            onClick={onClick}
            className="min-w-0 flex-1 text-left text-sm text-text hover:text-action hover:underline"
          >
            {/* Sempre trunca (não só compact) — nome sem limite quebrava em 2 linhas no modo
                completo, esticando a linha além dos 34px. Nome inteiro sempre disponível ao abrir
                a tarefa. */}
            <span className="block truncate">{task.name}</span>
          </button>
          {!!task.replanCount && (
            <span
              title={`Previsto replanejado ${task.replanCount} ${task.replanCount === 1 ? 'vez' : 'vezes'}`}
              className="inline-flex shrink-0 items-center rounded-full bg-action/10 px-2 py-0.5 text-[10px] font-semibold text-action"
            >
              R{task.replanCount}
            </span>
          )}
          {task.hasDependencyViolation && (
            <span title="Previsto em conflito com a regra de alguma dependência">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-delayed" aria-hidden="true" />
            </span>
          )}
        </div>
      </td>
      {!compact && (
        <>
          <td className={cellClass} style={{ width: getColumnRect(columns, 'categoria').width }}>
            <Badge color={category?.color}>{category?.label ?? task.category}</Badge>
          </td>
          <td className={cellClass} style={{ width: getColumnRect(columns, 'responsavel').width }}>
            {responsavel?.name ?? '—'}
          </td>
          <td className={cellClass} style={{ width: getColumnRect(columns, 'inicioPrevisto').width }}>
            {formatDatePtBr(task.plannedStart)}
          </td>
          <td className={cellClass} style={{ width: getColumnRect(columns, 'fimPrevisto').width }}>
            {formatDatePtBr(task.plannedEnd)}
          </td>
          <td className={cellClass} style={{ width: getColumnRect(columns, 'inicioReal').width }}>
            {formatDatePtBr(task.actualStart)}
          </td>
          <td className={cellClass} style={{ width: getColumnRect(columns, 'fimReal').width }}>
            {formatDatePtBr(task.actualEnd)}
          </td>
          <td className={cellClass} style={{ width: getColumnRect(columns, 'duracao').width }}>
            {formatDuration(businessDaysBetween(task.plannedStart, task.plannedEnd, holidays, unit))}
          </td>
        </>
      )}
      <td
        className={`h-[34px] overflow-hidden whitespace-nowrap px-2 py-0 text-center align-middle ${
          compact ? 'sticky z-25 border-r border-border bg-card' : ''
        }`}
        style={compact ? { left: avanco.left, width: avanco.width } : { width: avanco.width }}
      >
        <StatusBadge
          status={task.status}
          blocked={task.isBlocked}
          startDelayed={task.isStartDelayed}
          lateCompletion={task.isLateCompletion}
          lateCompletionDays={task.lateCompletionDays}
        />
      </td>
      <td className="relative h-[34px] px-4 py-0 align-middle" style={{ width, ...timelineBackground }}>
        <TodayLine range={range} pxPerDay={pxPerDay} />
        <GanttBars
          range={range}
          pxPerDay={pxPerDay}
          status={task.status}
          plannedStart={task.plannedStart}
          plannedEnd={task.plannedEnd}
          baseStart={task.baseStart}
          baseEnd={task.baseEnd}
          actualStart={task.actualStart}
          actualEnd={task.actualEnd}
          connectorFromISO={connectorFromISO}
        />
      </td>
    </tr>
  );
}
