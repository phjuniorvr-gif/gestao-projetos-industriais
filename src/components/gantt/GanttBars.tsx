import { STATUS_COLOR, type TaskStatus } from '../../types';
import { todayISO } from '../../utils';
import { computeTaskBarSegments, type DateRange } from './ganttMath';

// Fase 4 — barra de TAREFA: previsto (cor por status) e real ficam SEMPRE os dois visíveis, um
// embaixo do outro — não um substituindo o outro (ajuste feito no checkpoint visual, o desenho
// original da spec/protótipo só tinha previsto vs. base, sem trilha de real). Linha de base fina
// abaixo dos dois (tracejada quando o previsto já não bate mais com ela). O conector simples de
// predecessora que existia aqui (Commit 2) foi removido no Commit 4 — virou seta de verdade por
// tipo de dependência, desenhada uma vez para a tabela inteira em GanttTable.tsx, não por linha.
// A legenda "Prev"/"Real" das barras é uma coluna própria (GanttTable.tsx/GanttRow.tsx, "labelCol"),
// não desenhada aqui.
interface GanttBarsProps {
  range: DateRange;
  pxPerDay: number;
  status: TaskStatus;
  plannedStart: string;
  plannedEnd: string;
  baseStart: string;
  baseEnd: string;
  actualStart?: string;
  actualEnd?: string;
}

export function GanttBars({
  range,
  pxPerDay,
  status,
  plannedStart,
  plannedEnd,
  baseStart,
  baseEnd,
  actualStart,
  actualEnd,
}: GanttBarsProps) {
  const today = todayISO();
  const { baseline, previsto, real, excesso } = computeTaskBarSegments(
    { plannedStart, plannedEnd, baseStart, baseEnd, actualStart, actualEnd },
    range,
    pxPerDay,
    today,
  );

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
    </div>
  );
}
