import type { AttentionItem } from '../../utils/portfolio';
import { formatDatePtBr } from '../../utils';
import { STATUS_COLOR } from '../../types';
import { Card } from '../ui';

interface AttentionSplitPanelProps {
  items: AttentionItem[];
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const { project, kind, days } = item;
  return (
    <li className="flex items-start justify-between gap-2 text-sm">
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: STATUS_COLOR[kind === 'overdue' ? 'delayed' : project.status] }}
        />
        <div className="min-w-0">
          <p className="truncate font-medium text-text">
            {project.code} — {project.name}
          </p>
          <p className="text-xs text-text-muted">
            {kind === 'overdue' && `venceu em ${formatDatePtBr(project.plannedEnd)}`}
            {kind === 'upcomingStart' && `previsto para ${formatDatePtBr(project.plannedStart)}`}
            {kind === 'dueSoon' && `entrega em ${days} dias`}
          </p>
        </div>
      </div>
      <span className={`shrink-0 font-mono text-xs font-semibold ${kind === 'overdue' ? 'text-status-delayed' : 'text-text-muted2'}`}>
        {kind === 'overdue' ? `+${days}d` : `${days}d`}
      </span>
    </li>
  );
}

/**
 * Versão do Dashboard da "Atenção nos próximos N dias" — separa visualmente Vencidos/Atrasados de
 * Próximos vencimentos (o `AttentionPanel.tsx` da tela de Projetos continua com a lista única, não
 * mexido, pra não alterar aquela tela sem pedido). Mesmo `computeAttentionItems` por trás.
 */
export function AttentionSplitPanel({ items }: AttentionSplitPanelProps) {
  const overdue = items.filter((i) => i.kind === 'overdue');
  const upcoming = items.filter((i) => i.kind !== 'overdue');

  return (
    <Card className="p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-text">Atenção nos próximos dias</p>
        <p className="text-xs text-text-muted">Separado por atrasados e próximos vencimentos</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-text-muted">Nada urgente por enquanto.</p>
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted2">Vencidos / atrasados</p>
              <ul className="space-y-2.5">
                {overdue.map((item) => (
                  <AttentionRow key={item.project.id} item={item} />
                ))}
              </ul>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted2">Próximos vencimentos</p>
              <ul className="space-y-2.5">
                {upcoming.map((item) => (
                  <AttentionRow key={item.project.id} item={item} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
