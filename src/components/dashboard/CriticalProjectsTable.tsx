import { Link } from 'react-router-dom';
import type { Holiday, Person, ProjectView } from '../../types';
import { formatDatePtBr } from '../../utils';
import { computeScheduleDeviationDays } from '../../utils/portfolio';
import { StatusBadge } from '../shared/StatusBadge';
import { Card } from '../ui';

interface CriticalProjectsTableProps {
  /** Já ordenados por criticidade (sortProjectsByCriticality) e cortados no topo N por quem chama. */
  projects: ProjectView[];
  people: Person[];
  today: string;
  holidays: Holiday[];
}

/** "Projetos críticos" — recorte do topo da mesma ordenação por criticidade que a tabela de
 * Projetos já usa como padrão (`sortProjectsByCriticality`), não um cálculo de risco novo. */
export function CriticalProjectsTable({ projects, people, today, holidays }: CriticalProjectsTableProps) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <p className="text-sm font-semibold text-text">Projetos críticos</p>
          <p className="text-xs text-text-muted">Projetos atrasados ou com maior risco de prazo</p>
        </div>
        <Link to="/projetos" className="text-sm font-semibold text-action hover:underline">
          Ver todos
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="p-4 text-sm text-text-muted">Nenhum projeto crítico no momento.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted2">
                <th className="px-4 py-2">Projeto</th>
                <th className="px-4 py-2">Unidade</th>
                <th className="px-4 py-2">Responsável</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Avanço</th>
                <th className="px-4 py-2">Prazo</th>
                <th className="px-4 py-2 text-right">Desvio</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.map((project) => {
                const gerente = people.find((p) => p.id === project.gerenteId);
                const deviationDays = computeScheduleDeviationDays(project, today, holidays);
                return (
                  <tr key={project.id}>
                    <td className="max-w-0 px-4 py-2.5">
                      <p className="truncate font-semibold text-text">
                        {project.code} — {project.name}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-text-muted">{project.unit || '—'}</td>
                    <td className="px-4 py-2.5 text-text-muted">{gerente?.name ?? 'Sem gerente'}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={project.status} lateCompletion={project.isLateCompletion} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-1.5 w-24 rounded-full bg-page">
                        <div className="h-1.5 rounded-full bg-action" style={{ width: `${project.progress}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-text-muted">{formatDatePtBr(project.plannedEnd)}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono font-semibold ${
                        deviationDays > 0 ? 'text-status-delayed' : 'text-status-done'
                      }`}
                    >
                      {deviationDays > 0 ? `+${deviationDays}d` : `${deviationDays}d`}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link to={`/projetos/${project.id}/cronograma`} className="font-semibold text-action hover:underline">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
