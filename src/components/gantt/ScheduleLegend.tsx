import { STATUS_COLOR } from '../../types';

// Fase 4 — legenda reflete o que a Fase 4 já desenha (bug #2 da spec: a versão antiga prometia
// "Previsto · Real · Dependência" e não desenhava nenhum dos três). "Dependência"/"Dependência
// violada" entraram no Commit 4, junto com as setas de verdade.
export function ScheduleLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-[9px] w-4 rounded-[2px] bg-sidebar" />
        Resumo
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-4 rounded-md" style={{ backgroundColor: STATUS_COLOR.in_progress }} />
        Em andamento
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-4 rounded-md" style={{ backgroundColor: STATUS_COLOR.completed }} />
        Concluído
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-4 rounded-md" style={{ backgroundColor: STATUS_COLOR.planned }} />
        Planejado
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-4 rounded-md bg-action" />
        Real
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-4 rounded-md bg-status-delayed" />
        Além do previsto
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1 w-4 rounded-full bg-border-2" />
        Linha de base
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-4 rounded-full bg-action-2" />
        Avanço
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="16" height="9" className="shrink-0">
          <line x1="0" y1="4.5" x2="16" y2="4.5" stroke="var(--color-text-muted2)" strokeWidth="1.5" />
        </svg>
        Dependência
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="16" height="9" className="shrink-0">
          <line x1="0" y1="4.5" x2="16" y2="4.5" stroke="var(--color-status-delayed)" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
        Dependência violada
      </span>
    </div>
  );
}
