import type { Holiday, ProjectStatus } from '../types';
import type { ProjectFiltersState } from '../components/projects/ProjectFilters';
import { addBusinessDays, businessDaysBetween } from './dates';

/**
 * Agregações de portfólio pra tela de Projetos (Fase 3) — diferente de `status.ts`, que é o
 * motor de recompute por item (tarefa → atividade → projeto), chamado uma vez em
 * `useProjects.ts`. Aqui são cálculos sobre a lista já hidratada (`ProjectView[]`), específicos
 * da tela: nenhuma dessas funções faz parte do recompute nem é usada por ele.
 */

interface DeviationInput {
  status: ProjectStatus;
  plannedEnd?: string;
  actualEnd?: string;
  unit: string;
}

/**
 * Dias úteis de desvio sobre a data prevista de FIM DO PROJETO (não de tarefas internas —
 * um projeto pode estar com status 'delayed' por causa de uma tarefa antecipada atrasada,
 * mesmo com o prazo geral do projeto ainda no futuro; nesse caso o desvio aqui é 0, porque o
 * prazo que a spec pede ("desvio sobre a data prevista") ainda não estourou). Referência:
 * `actualEnd` se concluído com atraso; `today` se ainda em aberto e já passou do previsto;
 * `0` nos demais casos (inclui "ainda dentro do previsto").
 */
export function computeScheduleDeviationDays(project: DeviationInput, today: string, holidays: Holiday[]): number {
  if (!project.plannedEnd) return 0;

  if (project.status === 'completed') {
    if (!project.actualEnd || project.actualEnd <= project.plannedEnd) return 0;
    const from = addBusinessDays(project.plannedEnd, 1, holidays, project.unit);
    return businessDaysBetween(from, project.actualEnd, holidays, project.unit);
  }

  if (project.status !== 'delayed') return 0; // planned/in_progress: ainda dentro do previsto

  const from = addBusinessDays(project.plannedEnd, 1, holidays, project.unit);
  if (from > today) return 0; // prazo geral do projeto ainda não passou
  return businessDaysBetween(from, today, holidays, project.unit);
}

/** Quantidade de filtros ativos (busca/unidade/status/ano) — puro, sem tocar DOM. */
export function computeActiveFilterCount(filters: ProjectFiltersState): number {
  let count = 0;
  if (filters.search.trim()) count++;
  if (filters.unit) count++;
  if (filters.status) count++;
  if (filters.year) count++;
  return count;
}

/** Distribuição de projetos por status, na ordem fixa que a faixa de saúde exibe. */
const HEALTH_STRIP_ORDER: ProjectStatus[] = ['delayed', 'in_progress', 'completed', 'planned'];

export interface StatusDistributionEntry {
  status: ProjectStatus;
  count: number;
}

export function computeStatusDistribution(projects: { status: ProjectStatus }[]): StatusDistributionEntry[] {
  return HEALTH_STRIP_ORDER.map((status) => ({
    status,
    count: projects.filter((p) => p.status === status).length,
  }));
}

/** Pior desvio (em dias úteis) entre os projetos atrasados — 0 se não houver nenhum. */
export function computeWorstDeviation(projects: DeviationInput[], today: string, holidays: Holiday[]): number {
  const delayed = projects.filter((p) => p.status === 'delayed');
  if (delayed.length === 0) return 0;
  return Math.max(...delayed.map((p) => computeScheduleDeviationDays(p, today, holidays)));
}
