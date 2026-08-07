import { diffDays, todayISO } from '../../utils';
import { barRect, LABEL_COLUMN_WIDTH, offsetPx, PX_PER_DAY, totalWidth, type DateRange } from './ganttMath';

interface GanttBarsProps {
  range: DateRange;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  /** Fim previsto da predecessora crítica (a de fim mais tardio) — desenha um pequeno
   * conector até o início desta barra, sem precisar medir posições entre linhas. */
  connectorFromISO?: string;
}

export function GanttBars({
  range,
  plannedStart,
  plannedEnd,
  actualStart,
  actualEnd,
  connectorFromISO,
}: GanttBarsProps) {
  const width = totalWidth(range);
  const today = todayISO();

  const planned = plannedStart && plannedEnd ? barRect(range, plannedStart, plannedEnd) : null;
  const realEnd = actualEnd ?? (actualStart ? today : undefined);
  const real = actualStart && realEnd ? barRect(range, actualStart, realEnd) : null;
  const overrun = real && realEnd && plannedEnd && realEnd > plannedEnd ? barRect(range, plannedEnd, realEnd) : null;

  const connectorWidth =
    connectorFromISO && plannedStart ? diffDays(connectorFromISO, plannedStart) * PX_PER_DAY : 0;
  const connector =
    connectorFromISO && plannedStart && connectorWidth > 0
      ? { left: LABEL_COLUMN_WIDTH + offsetPx(range, connectorFromISO), width: connectorWidth }
      : null;

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[11px] text-text-muted" style={{ width: LABEL_COLUMN_WIDTH - 6 }}>
          Prev.
        </span>
        <div className="relative h-3" style={{ width }}>
          {planned && (
            <div
              className="absolute top-0 h-3 rounded-md border border-action bg-blue-200"
              style={{ left: planned.left, width: planned.width }}
            />
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="shrink-0 text-[11px] text-text-muted" style={{ width: LABEL_COLUMN_WIDTH - 6 }}>
          Real
        </span>
        <div className="relative h-3" style={{ width }}>
          {real ? (
            <>
              <div
                className="absolute top-0 h-3 rounded-md bg-action"
                style={{ left: real.left, width: real.width }}
              />
              {overrun && (
                <div
                  className="absolute top-0 h-3 rounded-md bg-status-delayed"
                  style={{ left: overrun.left, width: overrun.width }}
                />
              )}
            </>
          ) : (
            <span className="absolute left-0 top-0 text-[10px] italic text-text-muted">Não iniciado</span>
          )}
        </div>
      </div>

      {connector && (
        <div className="pointer-events-none absolute h-px bg-slate-500" style={{ left: connector.left, width: connector.width, top: 19 }}>
          <span className="absolute -right-px -top-[3px] h-0 w-0 border-y-[4px] border-y-transparent border-l-[5px] border-l-slate-500" />
        </div>
      )}
    </div>
  );
}
