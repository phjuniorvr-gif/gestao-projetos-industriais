import { STATUS_COLOR, type TaskStatus } from '../../types';
import { diffDays, todayISO } from '../../utils';
import { computeTaskBarSegments, offsetPx, PX_PER_DAY, type DateRange } from './ganttMath';

// Fase 4 — barra de TAREFA: previsto (cor por status) e real ficam SEMPRE os dois visíveis, um
// embaixo do outro — não um substituindo o outro (ajuste feito no checkpoint visual, o desenho
// original da spec/protótipo só tinha previsto vs. base, sem trilha de real). Linha de base fina
// abaixo dos dois (tracejada quando o previsto já não bate mais com ela).
interface GanttBarsProps {
  range: DateRange;
  status: TaskStatus;
  plannedStart: string;
  plannedEnd: string;
  baseStart: string;
  baseEnd: string;
  actualStart?: string;
  actualEnd?: string;
  /** Fim previsto da predecessora crítica (a de fim mais tardio) — conector simples até a Fase
   * 4 desenhar setas de verdade por tipo de dependência (Commit 4). */
  connectorFromISO?: string;
}

export function GanttBars({
  range,
  status,
  plannedStart,
  plannedEnd,
  baseStart,
  baseEnd,
  actualStart,
  actualEnd,
  connectorFromISO,
}: GanttBarsProps) {
  const today = todayISO();
  const { baseline, previsto, real, excesso } = computeTaskBarSegments(
    { plannedStart, plannedEnd, baseStart, baseEnd, actualStart, actualEnd },
    range,
    today,
  );

  const connectorWidth = connectorFromISO ? diffDays(connectorFromISO, plannedStart) * PX_PER_DAY : 0;
  const connector =
    connectorFromISO && connectorWidth > 0
      ? { left: offsetPx(range, connectorFromISO), width: connectorWidth }
      : null;

  return (
    <div className="relative h-full">
      {/* Previsto — cor por status, fixo, sempre visível. */}
      <div
        className="absolute h-[7px] rounded-md"
        style={{ left: previsto.left, width: previsto.width, top: 6, backgroundColor: STATUS_COLOR[status] }}
      />
      {/* Real — só existe quando a tarefa já começou. */}
      {real && (
        <div className="absolute h-[7px] rounded-md bg-action" style={{ left: real.left, width: real.width, top: 16 }} />
      )}
      {/* Excesso — trecho do Real que passou do previsto, sólido vermelho (pedido do usuário:
          "o que passou fica em vermelho", sem hachura). */}
      {excesso && (
        <div
          className="absolute h-[7px] rounded-r-md bg-status-delayed"
          style={{ left: excesso.left, width: excesso.width, top: 16 }}
        />
      )}
      {/* Linha de base — fina, embaixo dos dois. */}
      <div
        className={`absolute h-1 rounded-full ${baseline.dashed ? '' : 'bg-border-2'}`}
        style={{
          left: baseline.left,
          width: baseline.width,
          top: 27,
          backgroundImage: baseline.dashed
            ? 'repeating-linear-gradient(90deg, var(--color-border-2) 0 4px, transparent 4px 7px)'
            : undefined,
        }}
      />
      {connector && (
        <div className="pointer-events-none absolute h-px bg-text-muted2" style={{ left: connector.left, width: connector.width, top: 6 }}>
          <span className="absolute -right-px -top-[3px] h-0 w-0 border-y-[4px] border-y-transparent border-l-[5px] border-l-text-muted2" />
        </div>
      )}
    </div>
  );
}
