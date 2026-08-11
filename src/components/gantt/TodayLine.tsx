import { todayISO } from '../../utils';
import { offsetPx, type DateRange } from './ganttMath';

// Fase 4, Commit 3 — corrige desalinhamento real: a barra de tarefa (GanttBars.tsx) não reserva
// mais 40px de rótulo desde a reescrita do Commit 2 (era do antigo prefixo de texto "Prev."/
// "Real"), mas esta linha ainda somava esse offset — ficava ~5 dias (40px / 8px por dia) à
// direita de onde as barras realmente terminam. Removido.
interface TodayLineProps {
  range: DateRange;
  pxPerDay: number;
  /** Rótulo dd/mm fixo — só na régua do cabeçalho (Commit 3); nas linhas do corpo a linha se
   * repete em cada `<tr>` e o rótulo repetido em toda linha só faria ruído visual. */
  showLabel?: boolean;
}

export function TodayLine({ range, pxPerDay, showLabel }: TodayLineProps) {
  const today = todayISO();
  if (today < range.start || today > range.end) return null;
  const left = offsetPx(range, today, pxPerDay);
  const [, month, day] = today.split('-');
  return (
    <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left }}>
      <div className="h-full w-0.5 bg-action" />
      {showLabel && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[4px] bg-action px-1 text-[9px] font-semibold text-white">
          {day}/{month}
        </span>
      )}
    </div>
  );
}
