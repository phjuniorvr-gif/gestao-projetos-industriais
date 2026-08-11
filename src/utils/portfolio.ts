import type { Holiday, Person, ProjectStatus, ProjectView } from '../types';
import type { ProjectFiltersState } from '../components/projects/ProjectFilters';
import { addBusinessDays, businessDaysBetween } from './dates';
import { taskWeight } from './status';

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

/**
 * Avanço ESPERADO hoje (curva S do plano) — não confundir com `computeProgress` (Fase 2.2,
 * avanço REAL). Mesma máquina: soma o peso (`taskWeight`) das tarefas cujo `plannedEnd` já
 * passou, dividido pelo peso total. Não é uma reta por tempo decorrido — reta ignoraria a
 * ponderação por dias úteis (um feriadão pareceria atraso sem nada ter acontecido) e a
 * distribuição real do plano (tarefas concentradas no fim). Usa o mesmo limiar estrito de
 * `computeTaskStatus` (`today > plannedEnd`, não `>=`), pra "esperado" e "atrasado" nascerem do
 * mesmo corte de data.
 */
export function computeExpectedProgress(
  tasks: { plannedStart?: string; plannedEnd?: string }[],
  today: string,
  holidays: Holiday[],
  unit: string,
): number {
  if (tasks.length === 0) return 0;
  let totalWeight = 0;
  let expectedWeight = 0;
  for (const task of tasks) {
    const weight = taskWeight(task, holidays, unit);
    totalWeight += weight;
    if (task.plannedEnd && today > task.plannedEnd) expectedWeight += weight;
  }
  return totalWeight === 0 ? 0 : Math.round((expectedWeight / totalWeight) * 100);
}

/** Ponto percentual de defasagem (esperado − real) que classifica "muito atrás do previsto". */
const GAP_THRESHOLD_PP = 10;

interface CriticalityInput {
  status: ProjectStatus;
  progress: number;
  startDelayedCount: number;
  isLateCompletion: boolean;
}

/**
 * Score de ordenação padrão da tabela — regra explícita e numérica (não em prosa), pra ordem
 * não mudar sozinha entre renders. Faixas, da mais crítica pra menos:
 *   delayed                                            → 1000 + desvio em dias
 *   in_progress, esperado − real ≥ GAP_THRESHOLD_PP     → 600 + a defasagem
 *   planned, alguma parte já deveria ter começado       → 450
 *   planned                                             → 200
 *   completed, concluído com atraso                     → 100
 *   completed, no prazo                                 → 0
 */
export function computeCriticality(project: CriticalityInput, deviationDays: number, expectedProgress: number): number {
  if (project.status === 'delayed') return 1000 + deviationDays;
  if (project.status === 'in_progress' && expectedProgress - project.progress >= GAP_THRESHOLD_PP) {
    return 600 + (expectedProgress - project.progress);
  }
  if (project.status === 'planned' && project.startDelayedCount > 0) return 450;
  if (project.status === 'planned') return 200;
  if (project.status === 'completed' && project.isLateCompletion) return 100;
  return 0; // completed no prazo
}

/**
 * Ordena por criticidade (score desc), com 2 camadas de desempate determinístico: maior desvio
 * primeiro, depois prazo previsto mais próximo primeiro, depois id (estável, nunca reordena à
 * toa entre renders com dado idêntico). Score/desvio/esperado calculados uma vez por projeto,
 * não a cada comparação do sort.
 */
export function sortProjectsByCriticality(projects: ProjectView[], today: string, holidays: Holiday[]): ProjectView[] {
  const ranked = projects.map((project) => {
    const deviationDays = computeScheduleDeviationDays(project, today, holidays);
    const expectedProgress = computeExpectedProgress(project.activities.flatMap((a) => a.tasks), today, holidays, project.unit);
    const score = computeCriticality(project, deviationDays, expectedProgress);
    return { project, deviationDays, score };
  });

  ranked.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.deviationDays !== b.deviationDays) return b.deviationDays - a.deviationDays;
    const endA = a.project.plannedEnd ?? '';
    const endB = b.project.plannedEnd ?? '';
    if (endA !== endB) return endA < endB ? -1 : 1;
    return a.project.id < b.project.id ? -1 : a.project.id > b.project.id ? 1 : 0;
  });

  return ranked.map((r) => r.project);
}

export interface TeamAvatarEntry {
  person: Person;
  hasDelayedTask: boolean;
}

/**
 * Equipe do projeto, derivada de `Task.responsavelId` (não de atividade — Fase 2.1 não criou
 * responsável por atividade). `hasDelayedTask` destaca quem tem ao menos 1 tarefa com
 * status 'delayed' nesse projeto, pra realce visual (avatar em laranja).
 */
export function computeProjectTeam(project: ProjectView, people: Person[]): TeamAvatarEntry[] {
  const byId = new Map<string, TeamAvatarEntry>();
  for (const activity of project.activities) {
    for (const task of activity.tasks) {
      if (!task.responsavelId) continue;
      const existing = byId.get(task.responsavelId);
      const hasDelayedTask = (existing?.hasDelayedTask ?? false) || task.status === 'delayed';
      if (existing) {
        existing.hasDelayedTask = hasDelayedTask;
        continue;
      }
      const person = people.find((p) => p.id === task.responsavelId);
      if (person) byId.set(task.responsavelId, { person, hasDelayedTask });
    }
  }
  return Array.from(byId.values());
}
