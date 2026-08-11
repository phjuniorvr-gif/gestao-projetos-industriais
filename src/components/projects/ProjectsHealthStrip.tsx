import type { Holiday, ProjectStatus, ProjectView } from '../../types';
import { STATUS_COLOR, STATUS_LABEL } from '../../types';
import { computeStatusDistribution, computeWorstDeviation } from '../../utils/portfolio';
import { Card } from '../ui';

interface ProjectsHealthStripProps {
  /** Portfólio inteiro, sem filtro de busca/unidade/ano — a faixa é o termômetro geral da área. */
  projects: ProjectView[];
  today: string;
  holidays: Holiday[];
  activeStatus: ProjectStatus | null;
  onToggleStatus: (status: ProjectStatus) => void;
}

/** Faixa de saúde: hero (nº atrasados + pior desvio) + barra empilhada clicável + chips
 * legenda/filtro — substitui os 5 `StatusCard` + `Legend` órfã (Fase 3). */
export function ProjectsHealthStrip({ projects, today, holidays, activeStatus, onToggleStatus }: ProjectsHealthStripProps) {
  const distribution = computeStatusDistribution(projects);
  const delayedCount = distribution.find((d) => d.status === 'delayed')?.count ?? 0;
  const worstDeviation = computeWorstDeviation(projects, today, holidays);
  const total = projects.length;

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="shrink-0 border-l-[3px] pl-3 sm:w-64" style={{ borderColor: STATUS_COLOR.delayed }}>
        <p className="text-2xl font-semibold text-text">{delayedCount}</p>
        <p className="text-xs font-medium text-text-muted">Precisam de ação</p>
        <p className="mt-0.5 text-xs text-text-muted2">
          {delayedCount === 0
            ? 'Nenhum projeto atrasado'
            : `${delayedCount} projeto${delayedCount === 1 ? '' : 's'} atrasado${delayedCount === 1 ? '' : 's'} · o pior acumula ${worstDeviation}d de desvio sobre a data prevista`}
        </p>
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex h-[13px] overflow-hidden rounded" role="group" aria-label="Distribuição de projetos por status">
          {total === 0 ? (
            <div className="h-full w-full bg-border" />
          ) : (
            distribution
              .filter((d) => d.count > 0)
              .map((d) => (
                <button
                  key={d.status}
                  type="button"
                  onClick={() => onToggleStatus(d.status)}
                  style={{ width: `${(d.count / total) * 100}%`, backgroundColor: STATUS_COLOR[d.status] }}
                  className={`h-full transition-opacity ${activeStatus && activeStatus !== d.status ? 'opacity-40' : ''}`}
                  aria-label={`${STATUS_LABEL[d.status]}: ${d.count}`}
                  title={`${STATUS_LABEL[d.status]}: ${d.count}`}
                />
              ))
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {distribution.map((d) => (
            <button
              key={d.status}
              type="button"
              onClick={() => onToggleStatus(d.status)}
              aria-pressed={activeStatus === d.status}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                activeStatus === d.status
                  ? 'border-sidebar bg-sidebar text-white'
                  : 'border-border bg-white text-text-muted hover:border-text-muted2'
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[d.status] }} />
              {STATUS_LABEL[d.status]} · {d.count}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
