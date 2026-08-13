import { STATUS_COLOR, type ProjectStatus } from '../../types';
import { diffDays } from '../../utils';

interface MiniGanttProps {
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  status: ProjectStatus;
  today: string;
  /** `compact` (Fase 6/mobile): 22px, sem linhas-guia de 25/50/75% nem linha de datas embaixo. */
  size?: 'default' | 'compact';
}

function formatShort(dateISO: string): string {
  const [, month, day] = dateISO.split('-');
  return `${day}/${month}`;
}

/**
 * Mini-gantt autoescalado no próprio período do projeto (não compartilha um eixo de tempo com
 * outras linhas, diferente do Gantt grande de `ganttMath.ts`/`GanttBars.tsx`, feito pra uma tela
 * inteira com scroll horizontal). Reusado na tabela de Projetos e no painel de detalhe (Fase 3).
 */
export function MiniGantt({
  plannedStart,
  plannedEnd,
  actualStart,
  actualEnd,
  status,
  today,
  size = 'default',
}: MiniGanttProps) {
  const compact = size === 'compact';

  if (!plannedStart || !plannedEnd) {
    return <span className="text-xs italic text-text-muted">Sem tarefas</span>;
  }

  const realEnd = actualEnd ?? (actualStart ? today : undefined);
  const rangeEnd = [plannedEnd, realEnd, status === 'completed' ? undefined : today]
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)!;
  const totalDays = Math.max(1, diffDays(plannedStart, rangeEnd) + 1);

  const leftPct = (dateISO: string) => (diffDays(plannedStart, dateISO) / totalDays) * 100;
  const widthPct = (startISO: string, endISO: string) => Math.max(2, ((diffDays(startISO, endISO) + 1) / totalDays) * 100);

  const plannedRect = { left: leftPct(plannedStart), width: widthPct(plannedStart, plannedEnd) };
  const realRect = actualStart && realEnd ? { left: leftPct(actualStart), width: widthPct(actualStart, realEnd) } : null;
  const overrunRect =
    realRect && realEnd && realEnd > plannedEnd ? { left: leftPct(plannedEnd), width: widthPct(plannedEnd, realEnd) } : null;
  const todayPct = today >= plannedStart && today <= rangeEnd ? leftPct(today) : null;

  const barHeight = compact ? 7 : 9;
  const realTop = compact ? 10 : 13;

  return (
    <div className="w-full min-w-[160px]">
      <div className={`relative ${compact ? 'h-[22px]' : 'h-[26px]'}`}>
        {!compact &&
          [25, 50, 75].map((q) => (
            <div key={q} className="absolute top-0 h-full border-l border-dashed border-border-2" style={{ left: `${q}%` }} />
          ))}
        <div
          className="absolute top-0 rounded-sm border border-dashed border-action/60 bg-white"
          style={{ left: `${plannedRect.left}%`, width: `${plannedRect.width}%`, height: `${barHeight}px` }}
          title={`Previsto: ${formatShort(plannedStart)} – ${formatShort(plannedEnd)}`}
        />
        {realRect ? (
          <div
            className="absolute rounded-sm"
            style={{
              left: `${realRect.left}%`,
              width: `${realRect.width}%`,
              top: `${realTop}px`,
              height: `${barHeight}px`,
              backgroundColor: STATUS_COLOR[status],
            }}
          />
        ) : (
          !compact && <span className="absolute top-[13px] text-[10px] italic text-text-muted">Não iniciado</span>
        )}
        {overrunRect && (
          <div
            className="absolute rounded-sm"
            style={{
              left: `${overrunRect.left}%`,
              width: `${overrunRect.width}%`,
              top: `${realTop}px`,
              height: `${barHeight}px`,
              backgroundColor: STATUS_COLOR.delayed,
            }}
          />
        )}
        {todayPct !== null && (
          <div className="pointer-events-none absolute top-0 h-full w-px bg-text-ink2" style={{ left: `${todayPct}%` }}>
            <span className="absolute -left-[3px] -top-1 h-[5px] w-[5px] rounded-full bg-text-ink2" />
          </div>
        )}
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between font-mono text-[10px] text-text-muted2">
          <span>{formatShort(plannedStart)}</span>
          <span>{formatShort(plannedEnd)}</span>
        </div>
      )}
    </div>
  );
}
