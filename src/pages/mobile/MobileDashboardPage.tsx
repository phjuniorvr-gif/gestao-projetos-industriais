import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileProjectSheet, StatusChipRow } from '../../components/projects';
import { Card, UndoToast } from '../../components/ui';
import { useHolidays, useProjects, useUndoToast } from '../../hooks';
import { computeAttentionItems, computeStatusDistribution, computeWorstDeviation } from '../../utils/portfolio';
import { formatDatePtBr } from '../../utils';
import { STATUS_COLOR } from '../../types';

export function MobileDashboardPage() {
  const navigate = useNavigate();
  const { projects, today, updateTaskActualDates } = useProjects();
  const { holidays, loaded: holidaysLoaded } = useHolidays();
  const { toast, show, dismiss } = useUndoToast();
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  const safeHolidays = holidaysLoaded ? holidays : [];
  const distribution = computeStatusDistribution(projects);
  const delayedCount = distribution.find((d) => d.status === 'delayed')?.count ?? 0;
  const worstDeviation = computeWorstDeviation(projects, today, safeHolidays);
  const attentionItems = computeAttentionItems(projects, today, safeHolidays);
  const openProject = projects.find((p) => p.id === openProjectId) ?? null;

  return (
    <div className="space-y-4">
      <Card className="border-l-[3px] p-4" style={{ borderColor: STATUS_COLOR.delayed }}>
        <p className="text-2xl font-semibold text-text">{delayedCount}</p>
        <p className="text-xs font-medium text-text-muted">Precisam de ação</p>
        <p className="mt-0.5 text-xs text-text-muted2">
          {delayedCount === 0
            ? 'Nenhum projeto atrasado'
            : `${delayedCount} projeto${delayedCount === 1 ? '' : 's'} atrasado${delayedCount === 1 ? '' : 's'} · o pior acumula ${worstDeviation}d de desvio`}
        </p>
      </Card>

      <StatusChipRow
        distribution={distribution}
        activeStatus={null}
        onToggleStatus={(status) => navigate(`/projetos?status=${status}`)}
        size="touch"
      />

      <Card className="p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted2">Atenção nos próximos 90 dias</h3>
        {attentionItems.length === 0 ? (
          <p className="text-xs text-text-muted">Nada urgente por enquanto.</p>
        ) : (
          <ul className="space-y-1">
            {attentionItems.map(({ project, kind, days }) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => setOpenProjectId(project.id)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-1 text-left hover:bg-page"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_COLOR[kind === 'overdue' ? 'delayed' : project.status] }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">
                        {project.code} — {project.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {kind === 'overdue' && `venceu em ${formatDatePtBr(project.plannedEnd)}`}
                        {kind === 'upcomingStart' && `previsto para ${formatDatePtBr(project.plannedStart)}`}
                        {kind === 'dueSoon' && `entrega em ${days}d`}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-xs font-semibold ${
                      kind === 'overdue' ? 'text-status-delayed' : 'text-text-muted2'
                    }`}
                  >
                    {kind === 'overdue' ? `+${days}d` : `${days}d`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <MobileProjectSheet
        project={openProject}
        today={today}
        holidays={safeHolidays}
        onClose={() => setOpenProjectId(null)}
        onUpdateTask={(taskId, patch) => {
          if (openProject) updateTaskActualDates(openProject.id, taskId, patch);
        }}
        onShowUndo={(message, onUndo) => show(message, onUndo)}
      />

      <UndoToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
