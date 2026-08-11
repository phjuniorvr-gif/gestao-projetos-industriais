import type { ActivityView, Holiday, Project, ProjectStatus, ProjectView, Replanejamento, Task, TaskView } from '../types';
import { addBusinessDays, businessDaysBetween, todayISO } from './dates';
import { computeTaskBlockedByDependencies, computeTaskDependencyViolated } from './dependencies';
import { computeReplanCount } from './replan';

interface DatedItem {
  plannedStart?: string;
  plannedEnd?: string;
  baseStart?: string;
  baseEnd?: string;
  actualStart?: string;
  actualEnd?: string;
}

interface StatusedItem {
  status: ProjectStatus;
}

/**
 * Status de uma tarefa — 4 valores diretos das datas (spec Fase 2.3). Bloqueio por predecessora
 * não entra mais aqui: virou `computeTaskBlocked`, uma condição derivada separada (decisão no
 * CLAUDE.md — blocked não é mais valor de status, é selo ao lado). `today` é injetado pelo
 * chamador, nunca lido internamente — determinístico e testável sem mockar relógio.
 */
export function computeTaskStatus(task: Task, today: string): ProjectStatus {
  if (task.actualEnd) return 'completed';
  if (today > task.plannedEnd) return 'delayed';
  if (task.actualStart) return 'in_progress';
  return 'planned';
}

/**
 * Agregação com quantificadores explícitos (não só precedência — um texto tipo "atrasado >
 * concluído > andamento > planejado" é ambíguo o bastante pra sair errado): delayed se ALGUMA
 * filha é delayed; completed se TODAS são completed; in_progress se ALGUMA já começou
 * (in_progress ou completed); senão planned. Atividade sem tarefas / projeto sem atividades:
 * planned.
 */
export function rollUpStatus(children: StatusedItem[]): ProjectStatus {
  if (children.length === 0) return 'planned';
  if (children.some((c) => c.status === 'delayed')) return 'delayed';
  if (children.every((c) => c.status === 'completed')) return 'completed';
  if (children.some((c) => c.status === 'in_progress' || c.status === 'completed')) return 'in_progress';
  return 'planned';
}

/**
 * Seção "REGRAS DAS DATAS": previsto = extremos entre os filhos; real só quando aplicável.
 *
 * Linha de base (Fase 2.5) usa a MESMA regra de extremos simples de `planned`, não a assimetria
 * de `actual` (`any`/`every`): `baseStart`/`baseEnd` são sempre seedados JUNTOS, no instante de
 * criação da tarefa (`useProjects.ts`) — nunca existe uma tarefa com um preenchido e o outro não,
 * diferente de `actualStart`/`actualEnd` (que podem ser preenchidos em momentos diferentes
 * conforme a execução avança). Não há "base parcial" que justificasse `every()` aqui.
 */
export function rollUpDates(children: DatedItem[]): DatedItem {
  const plannedStarts = children.map((c) => c.plannedStart).filter((d): d is string => Boolean(d));
  const plannedEnds = children.map((c) => c.plannedEnd).filter((d): d is string => Boolean(d));
  const baseStarts = children.map((c) => c.baseStart).filter((d): d is string => Boolean(d));
  const baseEnds = children.map((c) => c.baseEnd).filter((d): d is string => Boolean(d));
  const actualStarts = children.map((c) => c.actualStart).filter((d): d is string => Boolean(d));
  const actualEnds = children.map((c) => c.actualEnd).filter((d): d is string => Boolean(d));

  const allHaveActualEnd = children.length > 0 && children.every((c) => Boolean(c.actualEnd));

  return {
    plannedStart: plannedStarts.length ? plannedStarts.sort()[0] : undefined,
    plannedEnd: plannedEnds.length ? plannedEnds.sort().at(-1) : undefined,
    baseStart: baseStarts.length ? baseStarts.sort()[0] : undefined,
    baseEnd: baseEnds.length ? baseEnds.sort().at(-1) : undefined,
    actualStart: actualStarts.length ? actualStarts.sort()[0] : undefined,
    actualEnd: allHaveActualEnd ? actualEnds.sort().at(-1) : undefined,
  };
}

/**
 * Deveria ter começado e não começou — independe de ter ou não predecessora pendente (uma
 * tarefa sem nenhuma predecessora também pode estar simplesmente atrasada pra começar). Guarda
 * explícita pra `plannedStart` ausente: decisão, não acidente de comparação — vira caso de teste.
 */
export function computeTaskStartDelayed(task: Task, today: string): boolean {
  if (!task.plannedStart) return false;
  return !task.actualStart && !task.actualEnd && task.plannedStart < today;
}

/**
 * Concluída depois do previsto. Guarda explícita pra `plannedEnd`/`actualEnd` ausentes —
 * decisão, não acidente de comparação — vira caso de teste.
 */
export function isLateCompletion(item: { plannedEnd?: string; actualEnd?: string }): boolean {
  if (!item.plannedEnd || !item.actualEnd) return false;
  return item.actualEnd > item.plannedEnd;
}

export function rollUpLateCompletion(children: { isLateCompletion: boolean }[]): boolean {
  return children.some((c) => c.isLateCompletion);
}

/**
 * Regra de exibição (não de dado — `isStartDelayed` continua calculado certo mesmo quando
 * isto retorna false): suprime o selo de "deveria ter começado" quando a tarefa já está
 * bloqueada (mesma causa raiz, bloqueado é mais específico) ou quando o status já é "Atrasado"
 * (o chip principal já entrega a informação). Extraída de StatusBadge pra ser testável sem
 * depender de renderização de componente.
 */
export function shouldShowStartDelayedBadge(item: {
  isStartDelayed?: boolean;
  isBlocked?: boolean;
  status: ProjectStatus;
}): boolean {
  return Boolean(item.isStartDelayed) && !item.isBlocked && item.status !== 'delayed';
}

/**
 * Contagem, não booleano: `some()` sobre 50+ tarefas satura (quase todo projeto médio tem
 * alguma tarefa ainda não iniciada) e vira ruído fixo aceso, sem informar nada. Funciona nos
 * dois níveis — tarefas-filhas (`isBlocked` booleano) ou atividades-filhas (`blockedCount` já
 * agregado) — por isso o fallback.
 */
export function rollUpBlockedCount(children: { isBlocked?: boolean; blockedCount?: number }[]): number {
  return children.reduce((sum, c) => sum + (c.blockedCount ?? (c.isBlocked ? 1 : 0)), 0);
}

export function rollUpStartDelayedCount(children: { isStartDelayed?: boolean; startDelayedCount?: number }[]): number {
  return children.reduce((sum, c) => sum + (c.startDelayedCount ?? (c.isStartDelayed ? 1 : 0)), 0);
}

/**
 * Peso da tarefa pro avanço ponderado (Fase 2.2): dias úteis entre previsto início/fim, mínimo 1
 * (uma tarefa de 1 dia útil, ou cujo intervalo caia inteiro num fim de semana, não pode ter peso
 * zero — senão não conta nem contra nem a favor do avanço). Isolado numa função só porque, se no
 * futuro o peso mais fiel for custo ou homem-hora em vez de duração, muda-se só aqui. Guarda
 * explícita pra datas ausentes: `Task.plannedStart/plannedEnd` são obrigatórios no tipo real
 * (nunca chega undefined de uma tarefa de verdade), mas a assinatura aceita um shape genérico —
 * contrato precisa ser intencional, não acidente de deixar `businessDaysBetween` receber
 * `undefined`. Peso 0 é neutro: não distorce numerador nem denominador de `computeProgress`.
 */
export function taskWeight(task: { plannedStart?: string; plannedEnd?: string }, holidays: Holiday[], unit: string): number {
  if (!task.plannedStart || !task.plannedEnd) return 0;
  return Math.max(1, businessDaysBetween(task.plannedStart, task.plannedEnd, holidays, unit));
}

/**
 * Progresso ponderado por peso (dias úteis) das tarefas concluídas sobre o total — Fase 2.2.
 * Contagem simples mente: uma atividade com 2 de 5 tarefas concluídas parece 40%, mas se essas
 * duas somam só 22 dos 114 dias úteis totais, o avanço real é 19%. Nunca retorna 100 sem que
 * TODAS as tarefas estejam concluídas — arredondamento não pode fazer um projeto 99,6% pronto
 * aparentar "acabou".
 */
export function computeProgress(tasks: TaskView[], holidays: Holiday[], unit: string): number {
  if (tasks.length === 0) return 0;
  let totalWeight = 0;
  let completedWeight = 0;
  for (const task of tasks) {
    const weight = taskWeight(task, holidays, unit);
    totalWeight += weight;
    if (task.status === 'completed') completedWeight += weight;
  }
  if (totalWeight === 0) return 0;
  if (completedWeight === totalWeight) return 100;
  return Math.min(99, Math.round((completedWeight / totalWeight) * 100));
}

/**
 * Dias úteis de atraso na conclusão, por unidade (feriado municipal só conta pra quem é da
 * unidade certa — `businessDaysBetween`, Fase 2.6). `holidays === undefined` significa "ainda
 * não carregou" — retorna `undefined` de propósito (não `0`), pra quem exibe mostrar só o
 * ícone em vez de um número errado que troca de valor sozinho quando o fetch terminar.
 */
export function computeLateCompletionDays(task: Task, holidays: Holiday[] | undefined, unit: string): number | undefined {
  if (holidays === undefined) return undefined;
  if (!task.plannedEnd || !task.actualEnd) return undefined;
  const from = addBusinessDays(task.plannedEnd, 1, holidays, unit);
  return businessDaysBetween(from, task.actualEnd, holidays, unit);
}

/**
 * Recalcula status/datas/progresso/condições derivadas de todas as tarefas, atividades e do
 * projeto, nesta ordem, produzindo a árvore hidratada (`ProjectView`) a partir da forma
 * persistida (`Project`). `today` tem default (`todayISO()`); `holidays` não tem — `undefined`
 * é um valor com significado próprio (feriados ainda não carregaram), não "esqueci de passar".
 * `replanejamentos` (Fase 2.5) segue o mesmo padrão: `undefined` = "histórico ainda não
 * carregou", não "zero replanejamentos" — vira `replanCount: undefined` em vez de `0` mentiroso.
 */
export function recomputeProject(
  project: Project,
  today: string = todayISO(),
  holidays?: Holiday[],
  replanejamentos?: Replanejamento[],
): ProjectView {
  const allTasks = project.activities.flatMap((a) => a.tasks).sort((a, b) => a.rowNumber - b.rowNumber);

  // undefined (feriados ainda não carregaram) vira [] aqui: computeTaskBlockedByDependencies e
  // computeTaskDependencyViolated (Fase 2.7) toleram lista incompleta do mesmo jeito que
  // computeProgress/taskWeight já toleravam — aproxima sem feriado descontado e se corrige
  // sozinho quando `holidays` carregar, sem precisar de um estado "ainda não sei" à parte.
  const safeHolidays = holidays ?? [];

  // tasksById (não tasksByRowNumber): dependencies (Fase 2.7) referencia id, e id não depende de
  // nenhuma ordem de processamento — diferente do isBlocked antigo (por predecessorRowNumbers),
  // que só funcionava porque toda predecessora tinha rowNumber menor que a sucessora. Uma
  // dependência "pra frente" (criada via editor, não só pelo wizard) agora calcula certo também.
  const tasksById = new Map(allTasks.map((t) => [t.id, t]));

  const recomputedTasks = new Map<string, TaskView>();
  for (const task of allTasks) {
    const status = computeTaskStatus(task, today);
    const isBlocked = computeTaskBlockedByDependencies(task, tasksById, today, safeHolidays, project.unit);
    const isStartDelayed = computeTaskStartDelayed(task, today);
    const lateCompletion = isLateCompletion(task);
    const predecessorRowNumbers = task.dependencies
      .map((d) => tasksById.get(d.predecessorId)?.rowNumber)
      .filter((n): n is number => n !== undefined)
      .sort((a, b) => a - b);
    const view: TaskView = {
      ...task,
      status,
      isBlocked,
      isStartDelayed,
      isLateCompletion: lateCompletion,
      lateCompletionDays: lateCompletion ? computeLateCompletionDays(task, holidays, project.unit) : undefined,
      replanCount: replanejamentos ? computeReplanCount(task.id, replanejamentos) : undefined,
      hasDependencyViolation: computeTaskDependencyViolated(task, tasksById, safeHolidays, project.unit),
      predecessorRowNumbers,
    };
    recomputedTasks.set(task.id, view);
  }

  const activities: ActivityView[] = project.activities.map((activity) => {
    const tasks = activity.tasks.map((t) => recomputedTasks.get(t.id)!);
    const dates = rollUpDates(tasks);
    return {
      ...activity,
      tasks,
      ...dates,
      status: rollUpStatus(tasks),
      blockedCount: rollUpBlockedCount(tasks),
      startDelayedCount: rollUpStartDelayedCount(tasks),
      isLateCompletion: rollUpLateCompletion(tasks),
      progress: computeProgress(tasks, safeHolidays, project.unit),
    };
  });

  const projectDates = rollUpDates(activities);
  // Soma o peso de TODAS as tarefas do projeto de uma vez (não uma média dos `progress` já
  // calculados por atividade) — é a conta que a spec define ("Projeto = mesma conta, somando as
  // tarefas de todas as suas atividades") e lida certo com atividade vazia (peso 0, que numa
  // média entraria como divisão por zero). Não "simplificar" pra média de atividades depois.
  const progress = computeProgress(activities.flatMap((a) => a.tasks), safeHolidays, project.unit);

  return {
    ...project,
    activities,
    ...projectDates,
    status: rollUpStatus(activities),
    blockedCount: rollUpBlockedCount(activities),
    startDelayedCount: rollUpStartDelayedCount(activities),
    isLateCompletion: rollUpLateCompletion(activities),
    progress,
    updatedAt: new Date().toISOString(),
  };
}
