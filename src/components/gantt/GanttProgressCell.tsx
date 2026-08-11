// Fase 4 — coluna "Avanço" de atividade/projeto: percentual derivado + micro-barra. Barra cresce
// pra preencher o espaço disponível na coluna (flex-1), não um tamanho fixo pequeno — só o texto
// da porcentagem tem largura própria (shrink-0), o resto é da barra, respeitando o padding da
// célula (px-2 já aplicado por quem chama). Tarefa não tem percentual (regra de ouro) — usa
// StatusBadge normal, não este componente.
interface GanttProgressCellProps {
  progress: number;
}

export function GanttProgressCell({ progress }: GanttProgressCellProps) {
  return (
    <div className="flex w-full items-center gap-2">
      <span className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-border-2">
        <span className="block h-full rounded-full bg-action" style={{ width: `${progress}%` }} />
      </span>
      <span className="shrink-0 text-xs font-medium text-text-muted">{progress}%</span>
    </div>
  );
}
