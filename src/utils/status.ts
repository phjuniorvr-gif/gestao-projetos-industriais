import type { ActivityView, Holiday, Project, ProjectStatus, ProjectView, Task, TaskView } from '../types';
import { addBusinessDays, businessDaysBetween, todayISO } from './dates';

interface DatedItem {
  plannedStart?: string;
  plannedEnd?: string;
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

/** Seção "REGRAS DAS DATAS": previsto = extremos entre os filhos; real só quando aplicável. */
export function rollUpDates(children: DatedItem[]): DatedItem {
  const plannedStarts = children.map((c) => c.plannedStart).filter((d): d is string => Boolean(d));
  const plannedEnds = children.map((c) => c.plannedEnd).filter((d): d is string => Boolean(d));
  const actualStarts = children.map((c) => c.actualStart).filter((d): d is string => Boolean(d));
  const actualEnds = children.map((c) => c.actualEnd).filter((d): d is string => Boolean(d));

  const allHaveActualEnd = children.length > 0 && children.every((c) => Boolean(c.actualEnd));

  return {
    plannedStart: plannedStarts.length ? plannedStarts.sort()[0] : undefined,
    plannedEnd: plannedEnds.length ? plannedEnds.sort().at(-1) : undefined,
    actualStart: actualStarts.length ? actualStarts.sort()[0] : undefined,
    actualEnd: allHaveActualEnd ? actualEnds.sort().at(-1) : undefined,
  };
}

/**
 * Bloqueada: já deveria ter começado (ou já começou — mas aí não conta mais como bloqueada) e
 * não pode por causa de uma predecessora não concluída. Antes de `plannedStart`, predecessora
 * pendente ainda não é bloqueio real, é só uma tarefa futura.
 */
export function computeTaskBlocked(task: Task, tasksByRowNumber: Map<number, TaskView>, today: string): boolean {
  if (!task.plannedStart) return false;
  if (task.actualStart || task.actualEnd) return false;
  if (today < task.plannedStart) return false;
  return task.predecessorRowNumbers.some((rowNumber) => {
    const predecessor = tasksByRowNumber.get(rowNumber);
    return predecessor ? predecessor.status !== 'completed' : false;
  });
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
 * Progresso: percentual de tarefas concluídas sobre o total (sem peso — pesar por dias úteis é
 * Fase 2.2).
 */
export function computeProgress(tasks: TaskView[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === 'completed').length;
  return Math.round((done / tasks.length) * 100);
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
 */
export function recomputeProject(project: Project, today: string = todayISO(), holidays?: Holiday[]): ProjectView {
  const allTasks = project.activities.flatMap((a) => a.tasks).sort((a, b) => a.rowNumber - b.rowNumber);
  const tasksByRowNumber = new Map<number, TaskView>();

  const recomputedTasks = new Map<string, TaskView>();
  for (const task of allTasks) {
    const status = computeTaskStatus(task, today);
    const isBlocked = computeTaskBlocked(task, tasksByRowNumber, today);
    const isStartDelayed = computeTaskStartDelayed(task, today);
    const lateCompletion = isLateCompletion(task);
    const view: TaskView = {
      ...task,
      status,
      isBlocked,
      isStartDelayed,
      isLateCompletion: lateCompletion,
      lateCompletionDays: lateCompletion ? computeLateCompletionDays(task, holidays, project.unit) : undefined,
    };
    tasksByRowNumber.set(task.rowNumber, view);
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
    };
  });

  const projectDates = rollUpDates(activities);
  const progress = computeProgress(activities.flatMap((a) => a.tasks));

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
