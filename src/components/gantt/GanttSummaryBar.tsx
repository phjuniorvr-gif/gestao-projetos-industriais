import { STATUS_COLOR, type ProjectStatus } from '../../types';
import { todayISO } from '../../utils';
import { barRect, type DateRange } from './ganttMath';

// Fase 4 — barra-resumo de projeto/atividade: cor por status. Cinza em qualquer status que não
// seja atraso (era navy, depois verde pra "concluído" — os dois trocados por cinza a pedido do
// usuário: "concluído" já aparece pelo selo/badge da linha, não precisa repetir na cor da barra),
// vermelho quando atrasado — esse continua sendo o único alerta na própria barra. + preenchimento
// claro do avanço derivado + pontas em cunha. Real fica embaixo, igual à tarefa — mesmo pedido:
// não esconder o real atrás só do resumo, e o trecho do Real que passa do previsto fica vermelho
// sólido (mesmo tratamento de excesso da tarefa, ver GanttBars.tsx). Sem linha de base aqui —
// projeto/atividade não têm linha de base própria.
interface GanttSummaryBarProps {
  range: DateRange;
  pxPerDay: number;
  status: ProjectStatus;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  progress: number;
}

const NEUTRAL_GRAY = '#64748B';

function summaryColor(status: ProjectStatus): string {
  return status === 'delayed' ? STATUS_COLOR.delayed : NEUTRAL_GRAY;
}

export function GanttSummaryBar({
  range,
  pxPerDay,
  status,
  plannedStart,
  plannedEnd,
  actualStart,
  actualEnd,
  progress,
}: GanttSummaryBarProps) {
  if (!plannedStart || !plannedEnd) return null;
  const bar = barRect(range, plannedStart, plannedEnd, pxPerDay);
  const color = summaryColor(status);

  const realEnd = actualEnd ?? (actualStart ? todayISO() : undefined);
  const real = actualStart && realEnd ? barRect(range, actualStart, realEnd, pxPerDay) : null;
  const excesso = real && realEnd && realEnd > plannedEnd ? barRect(range, plannedEnd, realEnd, pxPerDay) : null;

  return (
    <div className="relative h-full">
      <div
        className="absolute top-[6px] h-[9px] rounded-[2px]"
        style={{ left: bar.left, width: bar.width, backgroundColor: color }}
      >
        <span
          className="absolute -bottom-1 left-0 h-0 w-0 border-x-4 border-x-transparent border-t-[5px]"
          style={{ borderTopColor: color }}
        />
        <span
          className="absolute -bottom-1 right-0 h-0 w-0 border-x-4 border-x-transparent border-t-[5px]"
          style={{ borderTopColor: color }}
        />
        {/* Preenchimento de avanço: branco semitransparente por cima da própria cor da barra (não
            mais um azul fixo, `bg-action-2`) — com avanço alto, o azul cobria a barra inteira e
            escondia a cor de status por baixo (cinza/vermelho/verde), virando a única cor
            visível. Assim o preenchimento sempre clareia a cor que já está ali, nunca introduz
            azul numa barra que não é "Real". */}
        {progress > 0 && (
          <span className="absolute inset-y-0 left-0 rounded-l-[2px] bg-white/35" style={{ width: `${progress}%` }} />
        )}
      </div>
      {real && <div className="absolute top-[18px] h-[7px] rounded-md bg-action" style={{ left: real.left, width: real.width }} />}
      {excesso && (
        <div
          className="absolute top-[18px] h-[7px] rounded-r-md bg-status-delayed"
          style={{ left: excesso.left, width: excesso.width }}
        />
      )}
    </div>
  );
}
