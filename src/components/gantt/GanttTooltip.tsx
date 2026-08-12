import type { ReactNode } from 'react';

// Fase 4, Commit 5 — cartão de tooltip puramente presentational: quem chama já resolveu todo o
// conteúdo (buildTooltipRows em GanttTable.tsx, que tem os mapas de pessoas/feriados/tarefas por
// id à mão). `x`/`y` são coordenadas de viewport (clientX/clientY do mouse) — `position: fixed`
// segue o cursor; sem medir o card (sem ResizeObserver), então o "não sair da viewport" é uma
// estimativa por largura/altura máxima fixa, suficiente pro tamanho de conteúdo deste tooltip.
const TOOLTIP_WIDTH = 260;
const ESTIMATED_MAX_HEIGHT = 220;
const CURSOR_OFFSET = 14;

interface GanttTooltipProps {
  x: number;
  y: number;
  children: ReactNode;
}

export function GanttTooltip({ x, y, children }: GanttTooltipProps) {
  const flipLeft = x + CURSOR_OFFSET + TOOLTIP_WIDTH > window.innerWidth;
  const flipUp = y + CURSOR_OFFSET + ESTIMATED_MAX_HEIGHT > window.innerHeight;
  const left = flipLeft ? x - CURSOR_OFFSET - TOOLTIP_WIDTH : x + CURSOR_OFFSET;
  const top = flipUp ? y - CURSOR_OFFSET : y + CURSOR_OFFSET;

  return (
    <div
      className="pointer-events-none fixed z-50 space-y-1.5 rounded-lg border border-border bg-card p-3 text-xs shadow-lg"
      style={{ left, top, width: TOOLTIP_WIDTH, transform: flipUp ? 'translateY(-100%)' : undefined }}
    >
      {children}
    </div>
  );
}

export function TooltipTitle({ children }: { children: ReactNode }) {
  return <p className="truncate text-sm font-semibold text-text">{children}</p>;
}

export function TooltipRow({ label, value, tone }: { label: string; value: string; tone?: 'delayed' }) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className={`truncate text-right font-medium ${tone === 'delayed' ? 'text-status-delayed' : 'text-text'}`}>
        {value}
      </span>
    </p>
  );
}
