import type { Holiday, Person, ProjectStatus, ProjectView, TaskView } from '../types';
import type { ProjectFiltersState } from '../components/projects/ProjectFilters';
import { addBusinessDays, businessDaysBetween, diffDays } from './dates';
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
  if (filters.status.length > 0) count++;
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

interface TeamTaskInput {
  responsavelId?: string;
  status: ProjectStatus;
}

function teamFromTasks(tasks: TeamTaskInput[], people: Person[]): TeamAvatarEntry[] {
  const byId = new Map<string, TeamAvatarEntry>();
  for (const task of tasks) {
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
  return Array.from(byId.values());
}

/**
 * Equipe do projeto, derivada de `Task.responsavelId` (não de atividade — Fase 2.1 não criou
 * responsável por atividade). `hasDelayedTask` destaca quem tem ao menos 1 tarefa com
 * status 'delayed' nesse projeto, pra realce visual (avatar em laranja).
 */
export function computeProjectTeam(project: ProjectView, people: Person[]): TeamAvatarEntry[] {
  return teamFromTasks(project.activities.flatMap((a) => a.tasks), people);
}

/** Mesma derivação, escopada a uma única atividade (painel de detalhe, seção "Atividades e equipe"). */
export function computeActivityTeam(activity: { tasks: TeamTaskInput[] }, people: Person[]): TeamAvatarEntry[] {
  return teamFromTasks(activity.tasks, people);
}

/**
 * "Tarefa-foco" da edição inline (Fase 3, caminho 1): a tarefa não concluída com `plannedEnd`
 * mais próximo/mais vencido — proxy de "o que muda essa semana". É só a SUGESTÃO inicial do
 * popover, que sempre deixa o usuário trocar antes de confirmar (nunca grava às cegas na
 * escolhida pelo sistema). `null` se não houver nenhuma tarefa pendente.
 */
export function computeFocusTask(tasks: TaskView[]): TaskView | null {
  const incomplete = tasks.filter((t) => t.status !== 'completed');
  if (incomplete.length === 0) return null;
  return [...incomplete].sort((a, b) => {
    if (a.plannedEnd !== b.plannedEnd) return a.plannedEnd < b.plannedEnd ? -1 : 1;
    return a.rowNumber - b.rowNumber;
  })[0];
}

const ATTENTION_WINDOW_DAYS = 90;

export interface AttentionItem {
  project: ProjectView;
  /** `overdue` = já passou do previsto; `dueSoon` = entrega dentro da janela; `upcomingStart`
   * = início previsto dentro da janela, ainda não começou. */
  kind: 'overdue' | 'dueSoon' | 'upcomingStart';
  /** Dias de atraso (`overdue`) ou dias restantes (`dueSoon`/`upcomingStart`). */
  days: number;
}

/**
 * "Atenção nos próximos 90 dias" — um item por projeto (o mais urgente entre atrasado/entrega
 * próxima/início próximo), ordenado por urgência e limitado a 10. Projeto concluído nunca aparece
 * — não tem mais nada a "atender".
 */
export function computeAttentionItems(
  projects: ProjectView[],
  today: string,
  holidays: Holiday[],
  windowDays: number = ATTENTION_WINDOW_DAYS,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const project of projects) {
    if (project.status === 'completed') continue;

    if (project.status === 'delayed') {
      items.push({ project, kind: 'overdue', days: computeScheduleDeviationDays(project, today, holidays) });
      continue;
    }

    if (project.plannedEnd) {
      const daysToEnd = diffDays(today, project.plannedEnd);
      if (daysToEnd >= 0 && daysToEnd <= windowDays) {
        items.push({ project, kind: 'dueSoon', days: daysToEnd });
        continue;
      }
    }

    if (project.status === 'planned' && project.plannedStart) {
      const daysToStart = diffDays(today, project.plannedStart);
      if (daysToStart >= 0 && daysToStart <= windowDays) {
        items.push({ project, kind: 'upcomingStart', days: daysToStart });
      }
    }
  }

  return items
    .sort((a, b) => {
      if (a.kind === 'overdue' && b.kind !== 'overdue') return -1;
      if (b.kind === 'overdue' && a.kind !== 'overdue') return 1;
      if (a.kind === 'overdue' && b.kind === 'overdue') return b.days - a.days; // pior desvio primeiro
      return a.days - b.days; // menos dias restantes primeiro
    })
    .slice(0, 10);
}

export interface WorkloadEntry {
  person: Person;
  taskCount: number;
  lateTaskCount: number;
  managedProjectCount: number;
}

/**
 * Carga por pessoa — conta TAREFAS não concluídas (não todas, como um histórico acumulado
 * cresceria pra sempre) — é a medida de quem está afogado AGORA, não de quem já trabalhou muito
 * algum dia. `managedProjectCount` só soma pra quem já aparece por ter tarefa em aberto (gerente
 * sem nenhuma tarefa atribuída não entra na lista — painel é sobre carga de execução).
 */
export function computeWorkload(projects: ProjectView[], people: Person[]): WorkloadEntry[] {
  const byId = new Map<string, WorkloadEntry>();

  for (const project of projects) {
    for (const task of project.activities.flatMap((a) => a.tasks)) {
      if (!task.responsavelId || task.status === 'completed') continue;
      const person = people.find((p) => p.id === task.responsavelId);
      if (!person) continue;
      const entry = byId.get(person.id) ?? { person, taskCount: 0, lateTaskCount: 0, managedProjectCount: 0 };
      entry.taskCount += 1;
      if (task.status === 'delayed') entry.lateTaskCount += 1;
      byId.set(person.id, entry);
    }
  }

  for (const project of projects) {
    if (!project.gerenteId) continue;
    const entry = byId.get(project.gerenteId);
    if (entry) entry.managedProjectCount += 1;
  }

  return Array.from(byId.values()).sort((a, b) => b.taskCount - a.taskCount);
}

export interface WorkloadWithProjects extends WorkloadEntry {
  /** Projetos onde a pessoa tem ao menos 1 tarefa em aberto, ordenados por quem pesa mais. */
  openProjects: { project: ProjectView; openTaskCount: number }[];
}

/**
 * Mesma base de `computeWorkload` (reaproveitada, não recalculada) — acrescenta o agrupamento por
 * projeto que a aba Equipe (Fase 6/mobile) precisa pro drill-down aninhado por pessoa.
 */
export function computeWorkloadWithProjects(projects: ProjectView[], people: Person[]): WorkloadWithProjects[] {
  const workload = computeWorkload(projects, people);
  const openTaskCountByPersonProject = new Map<string, Map<string, number>>();

  for (const project of projects) {
    for (const task of project.activities.flatMap((a) => a.tasks)) {
      if (!task.responsavelId || task.status === 'completed') continue;
      let perProject = openTaskCountByPersonProject.get(task.responsavelId);
      if (!perProject) {
        perProject = new Map();
        openTaskCountByPersonProject.set(task.responsavelId, perProject);
      }
      perProject.set(project.id, (perProject.get(project.id) ?? 0) + 1);
    }
  }

  return workload.map((entry) => {
    const perProject = openTaskCountByPersonProject.get(entry.person.id) ?? new Map<string, number>();
    const openProjects = projects
      .filter((p) => perProject.has(p.id))
      .map((p) => ({ project: p, openTaskCount: perProject.get(p.id)! }))
      .sort((a, b) => b.openTaskCount - a.openTaskCount);
    return { ...entry, openProjects };
  });
}
