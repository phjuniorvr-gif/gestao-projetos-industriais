import type { Holiday, ProjectView } from '../../types';
import { STATUS_COLOR } from '../../types';
import { formatDatePtBr } from '../../utils';
import { computeAttentionItems } from '../../utils/portfolio';
import { Card } from '../ui';

interface AttentionPanelProps {
  projects: ProjectView[];
  today: string;
  holidays: Holiday[];
}

/** "Atenção nos próximos 90 dias" — painel lateral direito (Fase 3). */
export function AttentionPanel({ projects, today, holidays }: AttentionPanelProps) {
  const items = computeAttentionItems(projects, today, holidays);

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted2">Atenção nos próximos 90 dias</h3>
      {items.length === 0 ? (
        <p className="text-xs text-text-muted">Nada urgente por enquanto.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map(({ project, kind, days }) => (
            <li key={project.id} className="flex items-start justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-start gap-2">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_COLOR[kind === 'overdue' ? 'delayed' : project.status] }}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-text">
                    {project.code} — {project.name}
                  </p>
                  <p className="text-text-muted">
                    {kind === 'overdue' && `venceu em ${formatDatePtBr(project.plannedEnd)}`}
                    {kind === 'upcomingStart' && `previsto para ${formatDatePtBr(project.plannedStart)}`}
                    {kind === 'dueSoon' && `entrega em ${days}d`}
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 font-mono text-[11px] font-semibold ${
                  kind === 'overdue' ? 'text-status-delayed' : 'text-text-muted2'
                }`}
              >
                {kind === 'overdue' ? `+${days}d` : `${days}d`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
