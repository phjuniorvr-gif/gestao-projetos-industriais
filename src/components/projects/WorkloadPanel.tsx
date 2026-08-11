import type { Person, ProjectView } from '../../types';
import { computeWorkload } from '../../utils/portfolio';
import { Card } from '../ui';

interface WorkloadPanelProps {
  projects: ProjectView[];
  people: Person[];
}

/** "Carga por pessoa" — painel lateral direito (Fase 3). Conta tarefas em aberto (não histórico
 * acumulado), a medida real de quem está afogado agora. */
export function WorkloadPanel({ projects, people }: WorkloadPanelProps) {
  const workload = computeWorkload(projects, people);
  const maxCount = Math.max(1, ...workload.map((w) => w.taskCount));

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted2">Carga por pessoa</h3>
      {workload.length === 0 ? (
        <p className="text-xs text-text-muted">Nenhuma tarefa em aberto atribuída.</p>
      ) : (
        <ul className="space-y-2.5">
          {workload.map(({ person, taskCount, lateTaskCount, managedProjectCount }) => (
            <li key={person.id} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-text">{person.name}</span>
                <span className="shrink-0 text-text-muted2">
                  {taskCount} tarefa{taskCount === 1 ? '' : 's'}
                  {lateTaskCount > 0 && ` · ${lateTaskCount} atras.`}
                </span>
              </div>
              <div className="mt-1 h-1 w-full rounded-full bg-page">
                <div className="h-1 rounded-full bg-action" style={{ width: `${(taskCount / maxCount) * 100}%` }} />
              </div>
              {managedProjectCount > 0 && (
                <p className="mt-0.5 text-[10px] text-text-muted2">
                  gerencia {managedProjectCount} projeto{managedProjectCount === 1 ? '' : 's'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
