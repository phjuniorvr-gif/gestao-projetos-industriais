export const LABEL_COLUMN_WIDTH = 40;

/** Coluna "Prev"/"Real" — reabre uma legenda que existia antes da Fase 4 (removida na reescrita
 * do Commit 2, ver CLAUDE.md), a pedido do usuário. Fica entre o painel esquerdo (Linha/
 * Estrutura/.../Avanço) e a área de timeline, sticky como o resto do painel — não é uma legenda
 * flutuante grudada na barra, é uma coluna de verdade, sempre na mesma posição.
 * `realTop` difere entre linha de tarefa (`GanttBars.tsx`, real em top:16) e linha de projeto/
 * atividade (`GanttSummaryBar.tsx`, real em top:18) — mantém as duas palavras alinhadas com a
 * barra que rotulam em cada contexto. */
export function LabelColumn({ left, showReal, realTop = 16 }: { left: number; showReal: boolean; realTop?: number }) {
  return (
    <td
      className="sticky z-25 h-[34px] border-l border-border/70 bg-card px-1 align-middle text-[8px] font-semibold uppercase tracking-wide text-text-muted"
      style={{ left, width: LABEL_COLUMN_WIDTH }}
    >
      <div className="relative h-full">
        <span className="absolute inset-x-0 text-center leading-none" style={{ top: 6 }}>
          Prev
        </span>
        {showReal && (
          <span className="absolute inset-x-0 text-center leading-none" style={{ top: realTop }}>
            Real
          </span>
        )}
      </div>
    </td>
  );
}
