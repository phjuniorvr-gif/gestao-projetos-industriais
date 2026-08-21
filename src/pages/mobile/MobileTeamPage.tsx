import { useState } from 'react';
import { MobileProjectSheet } from '../../components/projects';
import { Card, EmptyState, UndoToast } from '../../components/ui';
import { useHolidays, usePeople, useProjects, useUndoToast } from '../../hooks';
import { computeWorkloadWithProjects } from '../../utils/portfolio';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Aba Equipe (Fase 6/mobile, rota nova `/equipe`) — carga por pessoa com drill-down aninhado dos
 * projetos onde tem tarefa em aberto (`computeWorkloadWithProjects`, único cálculo puro novo desta
 * fase). Toque num projeto da lista abre o mesmo `MobileProjectSheet` das outras abas.
 */
export function MobileTeamPage() {
  const { projects, today, updateTaskActualDates } = useProjects();
  const { people } = usePeople();
  const { holidays, loaded: holidaysLoaded } = useHolidays();
  const { toast, show, dismiss } = useUndoToast();
  // Guarda a pessoa junto com o projeto — o sheet precisa saber de quem filtrar "Tarefas em
  // aberto" (senão mostraria as tarefas do projeto inteiro, não só as dessa pessoa).
  const [openTarget, setOpenTarget] = useState<{ projectId: string; personId: string; personName: string } | null>(null);

  const safeHolidays = holidaysLoaded ? holidays : [];
  const workload = computeWorkloadWithProjects(projects, people);
  const openProject = projects.find((p) => p.id === openTarget?.projectId) ?? null;

  return (
    <div className="space-y-3">
      {workload.length === 0 ? (
        <EmptyState title="Nenhuma tarefa em aberto atribuída" />
      ) : (
        workload.map(({ person, taskCount, lateTaskCount, managedProjectCount, openProjects }) => (
          <Card key={person.id} className="p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-border-2 text-xs font-semibold text-text-muted">
                {initials(person.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{person.name}</p>
                <p className="text-xs text-text-muted">
                  {taskCount} tarefa{taskCount === 1 ? '' : 's'} em aberto
                  {managedProjectCount > 0 && ` · gerencia ${managedProjectCount}`}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  lateTaskCount > 0 ? 'bg-status-delayed-bg text-status-delayed' : 'bg-status-done/10 text-status-done'
                }`}
              >
                {lateTaskCount > 0 ? `${lateTaskCount} atrasada${lateTaskCount === 1 ? '' : 's'}` : 'em dia'}
              </span>
            </div>

            <ul className="mt-3 space-y-1 border-t border-border pt-2">
              {openProjects.map(({ project, openTaskCount }) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => setOpenTarget({ projectId: project.id, personId: person.id, personName: person.name })}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-1 text-left text-xs hover:bg-page"
                  >
                    <span className="min-w-0 truncate text-text">
                      {project.code} — {project.name}
                    </span>
                    <span className="shrink-0 text-text-muted2">
                      {openTaskCount} tarefa{openTaskCount === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      <MobileProjectSheet
        project={openProject}
        today={today}
        holidays={safeHolidays}
        onClose={() => setOpenTarget(null)}
        onUpdateTask={(taskId, patch) => {
          if (openProject) updateTaskActualDates(openProject.id, taskId, patch);
        }}
        onShowUndo={(message, onUndo) => show(message, onUndo)}
        filterResponsavelId={openTarget?.personId}
        filterResponsavelName={openTarget?.personName}
      />

      <UndoToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
