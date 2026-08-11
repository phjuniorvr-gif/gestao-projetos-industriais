import { STATUS_COLOR, type ProjectStatus } from '../../types';
import { todayISO } from '../../utils';
import { barRect, type DateRange } from './ganttMath';

// Fase 4 — barra-resumo de projeto/atividade: cor por status (navy neutro em planejado/andamento,
// vermelho quando atrasado, verde quando concluído — pedido do usuário no checkpoint visual) +
// preenchimento claro do avanço derivado + pontas em cunha. Real fica embaixo, igual à tarefa —
// mesmo pedido: não esconder o real atrás só do resumo, e o trecho do Real que passa do previsto
// fica vermelho sólido (mesmo tratamento de excesso da tarefa, ver GanttBars.tsx). Sem linha de
// base aqui — projeto/atividade não têm linha de base própria.
interface GanttSummaryBarProps {
  range: DateRange;
  status: ProjectStatus;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  progress: number;
}

const NAVY = '#0D2A4F';

function summaryColor(status: ProjectStatus): string {
  if (status === 'delayed') return STATUS_COLOR.delayed;
  if (status === 'completed') return STATUS_COLOR.completed;
  return NAVY;
}

export function GanttSummaryBar({
  range,
  status,
  plannedStart,
  plannedEnd,
  actualStart,
  actualEnd,
  progress,
}: GanttSummaryBarProps) {
  if (!plannedStart || !plannedEnd) return null;
  const bar = barRect(range, plannedStart, plannedEnd);
  const color = summaryColor(status);

  const realEnd = actualEnd ?? (actualStart ? todayISO() : undefined);
  const real = actualStart && realEnd ? barRect(range, actualStart, realEnd) : null;
  const excesso = real && realEnd && realEnd > plannedEnd ? barRect(range, plannedEnd, realEnd) : null;

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
        {progress > 0 && (
          <span className="absolute inset-y-0 left-0 rounded-l-[2px] bg-action-2" style={{ width: `${progress}%` }} />
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
