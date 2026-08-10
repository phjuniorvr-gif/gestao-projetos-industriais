import { todayISO } from '../../utils';
import { LABEL_COLUMN_WIDTH, offsetPx, type DateRange } from './ganttMath';

export function TodayLine({ range }: { range: DateRange }) {
  const today = todayISO();
  if (today < range.start || today > range.end) return null;
  const left = LABEL_COLUMN_WIDTH + offsetPx(range, today);
  return (
    <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left }}>
      <div className="h-full w-0.5 bg-action" />
    </div>
  );
}
