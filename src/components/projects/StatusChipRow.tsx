import type { ProjectStatus } from '../../types';
import { STATUS_COLOR, STATUS_LABEL } from '../../types';
import type { StatusDistributionEntry } from '../../utils/portfolio';

interface StatusChipRowProps {
  distribution: StatusDistributionEntry[];
  activeStatus: ProjectStatus | null;
  onToggleStatus: (status: ProjectStatus) => void;
  /** `touch` (Fase 6/mobile): garante 44px de alvo de toque. `default` preserva o chip enxuto do
   * desktop (Fase 3) — o mesmo componente não pode virar 44px lá sem alterar visual não pedido. */
  size?: 'default' | 'touch';
}

/**
 * Chips de status: legenda e filtro ao mesmo tempo (clicar filtra/desfiltra) — extraído de
 * `ProjectsHealthStrip` (Fase 3) sem alterar seu visual, pra ser reusado nas abas mobile (Fase 6).
 */
export function StatusChipRow({ distribution, activeStatus, onToggleStatus, size = 'default' }: StatusChipRowProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {distribution.map((d) => (
        <button
          key={d.status}
          type="button"
          onClick={() => onToggleStatus(d.status)}
          aria-pressed={activeStatus === d.status}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
            size === 'touch' ? 'min-h-11' : ''
          } ${
            activeStatus === d.status
              ? 'border-sidebar bg-sidebar text-white'
              : 'border-border bg-white text-text-muted hover:border-text-muted2'
          }`}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[d.status] }} />
          {STATUS_LABEL[d.status]} · {d.count}
        </button>
      ))}
    </div>
  );
}
