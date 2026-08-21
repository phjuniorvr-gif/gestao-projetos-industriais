import type { ProjectStatus } from '../../types';
import { STATUS_COLOR, STATUS_LABEL } from '../../types';
import type { StatusDistributionEntry } from '../../utils/portfolio';
import { Card } from '../ui';

interface StatusGridProps {
  distribution: StatusDistributionEntry[];
  /** Predicado em vez de um valor único — cobre tanto seleção única (`(s) => activeStatus === s`)
   * quanto múltipla (`(s) => statusFilter.includes(s)`, ver `MobileScheduleList.tsx`). */
  isActive: (status: ProjectStatus) => boolean;
  onToggleStatus: (status: ProjectStatus) => void;
  /** "Status dos projetos" (padrão) não faz sentido quando o que está sendo contado são tarefas
   * de um projeto só, não vários projetos — `MobileScheduleList.tsx` passa "Status das tarefas". */
  title?: string;
}

/**
 * Grade 2×2 de status — legenda e filtro ao mesmo tempo (clicar filtra/desfiltra), mesmo papel do
 * antigo `StatusChipRow`, trocado de chips em pílula por essa grade a pedido do usuário. Usado nas
 * abas mobile (Resumo/Projetos/Cronograma) e no filtro de tarefas por status do Cronograma de um
 * projeto único.
 */
export function StatusGrid({ distribution, isActive, onToggleStatus, title = 'Status dos projetos' }: StatusGridProps) {
  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm font-semibold text-text">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {distribution.map((d) => {
          const active = isActive(d.status);
          return (
            <button
              key={d.status}
              type="button"
              onClick={() => onToggleStatus(d.status)}
              aria-pressed={active}
              className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
                active ? 'border-action bg-action/5' : 'border-border bg-white hover:border-text-muted2'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-text">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLOR[d.status] }} />
                <span className="truncate">{STATUS_LABEL[d.status]}</span>
              </span>
              <span className="shrink-0 font-mono text-base font-bold" style={{ color: STATUS_COLOR[d.status] }}>
                {d.count}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
