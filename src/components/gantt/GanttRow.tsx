import type { CategoryEntry, Task } from '../../types';
import { formatDatePtBr, formatPredecessors } from '../../utils';
import { Badge } from '../ui';
import { StatusBadge } from '../shared/StatusBadge';
import { totalWidth, type DateRange } from './ganttMath';
import { GanttBars } from './GanttBars';
import { RowTypeBadge } from './RowTypeBadge';
import { TodayLine } from './TodayLine';

interface GanttRowProps {
  task: Task;
  range: DateRange;
  tasksByRowNumber: Map<number, Task>;
  categories: CategoryEntry[];
  frozenColWidth: number;
  compact: boolean;
  onClick: () => void;
}

const dateTdClass = 'whitespace-nowrap px-4 py-3.5 text-xs text-text-muted';

export function GanttRow({ task, range, tasksByRowNumber, categories, frozenColWidth, compact, onClick }: GanttRowProps) {
  const width = totalWidth(range);
  const category = categories.find((c) => c.id === task.category);

  const predecessorEnds = task.predecessorRowNumbers
    .map((rowNumber) => tasksByRowNumber.get(rowNumber)?.plannedEnd)
    .filter((date): date is string => Boolean(date));
  const connectorFromISO = predecessorEnds.length ? predecessorEnds.sort().at(-1) : undefined;

  return (
    <tr className="border-b border-border/70 bg-card hover:bg-page/60">
      <td className="sticky left-0 z-10 bg-card px-4 py-3.5 text-center text-xs text-text-muted">
        {task.rowNumber}
      </td>
      <td className="sticky z-10 border-r border-border bg-card py-3.5 pl-14 pr-4" style={{ left: frozenColWidth }}>
        <div className="flex items-center gap-2">
          <RowTypeBadge type="task" />
          <button
            type="button"
            onClick={onClick}
            className="text-left text-sm text-text hover:text-action hover:underline"
          >
            {task.name}
          </button>
        </div>
      </td>
      {!compact && (
        <>
          <td className="whitespace-nowrap px-4 py-3.5">
            <Badge color={category?.color}>{category?.label ?? task.category}</Badge>
          </td>
          <td className="whitespace-nowrap px-4 py-3.5 text-xs text-text-muted">
            {task.predecessorRowNumbers.length ? formatPredecessors(task.predecessorRowNumbers) : '—'}
          </td>
          <td className={dateTdClass}>{formatDatePtBr(task.plannedStart)}</td>
          <td className={dateTdClass}>{formatDatePtBr(task.plannedEnd)}</td>
          <td className={dateTdClass}>{formatDatePtBr(task.actualStart)}</td>
          <td className={dateTdClass}>{formatDatePtBr(task.actualEnd)}</td>
        </>
      )}
      <td className="whitespace-nowrap px-4 py-3.5">
        <StatusBadge status={task.status} />
      </td>
      <td className="relative px-4 py-3.5" style={{ width }}>
        <TodayLine range={range} />
        <GanttBars
          range={range}
          plannedStart={task.plannedStart}
          plannedEnd={task.plannedEnd}
          actualStart={task.actualStart}
          actualEnd={task.actualEnd}
          connectorFromISO={connectorFromISO}
        />
      </td>
    </tr>
  );
}
