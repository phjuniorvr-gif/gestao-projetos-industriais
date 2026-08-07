import type { Activity, Project, ProjectStatus, Task } from '../types';
import { todayISO } from './dates';

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
 * Status de uma tarefa (seção "STATUS" + "DEPENDÊNCIAS" do spec). Assume que as predecessoras
 * (sempre de rowNumber menor, pela forma como as tarefas são numeradas) já tiveram seu status
 * recalculado nesta mesma passada — ver `recomputeProject`, que processa em ordem crescente de
 * rowNumber.
 */
export function computeTaskStatus(task: Task, tasksByRowNumber: Map<number, Task>): ProjectStatus {
  if (task.actualEnd) {
    return task.actualEnd > task.plannedEnd ? 'completed_late' : 'completed';
  }

  const today = todayISO();

  // Antes da data prevista de início, a predecessora pendente ainda não é um bloqueio real —
  // é simplesmente uma tarefa futura. "Bloqueado" só se aplica quando ela já deveria ter
  // começado (ou está em curso) e não pode por causa de uma predecessora não concluída.
  if (today < task.plannedStart) return 'planned';

  const blockedByPredecessor = task.predecessorRowNumbers.some((rowNumber) => {
    const predecessor = tasksByRowNumber.get(rowNumber);
    if (!predecessor) return false;
    return predecessor.status !== 'completed' && predecessor.status !== 'completed_late';
  });
  if (blockedByPredecessor) return 'blocked';

  if (today > task.plannedEnd) return 'delayed';
  if (task.actualStart) return 'in_progress';
  return 'to_start';
}

/**
 * Agregação de status dos filhos (seção "REGRAS DAS DATAS", aplicada por analogia ao status):
 * atrasado > bloqueado > em andamento > à iniciar > planejado > concluído (com/sem atraso).
 */
export function rollUpStatus(children: StatusedItem[]): ProjectStatus {
  if (children.length === 0) return 'planned';
  if (children.every((c) => c.status === 'completed')) return 'completed';
  if (children.every((c) => c.status === 'completed' || c.status === 'completed_late')) return 'completed_late';
  if (children.some((c) => c.status === 'delayed')) return 'delayed';
  if (children.some((c) => c.status === 'blocked')) return 'blocked';
  if (children.some((c) => c.status === 'in_progress')) return 'in_progress';
  if (children.some((c) => c.status === 'to_start')) return 'to_start';
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
 * Progresso simples (o spec não menciona pesos, ao contrário da versão anterior do app):
 * percentual de tarefas concluídas (com ou sem atraso) sobre o total.
 */
export function computeProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === 'completed' || t.status === 'completed_late').length;
  return Math.round((done / tasks.length) * 100);
}

/**
 * Recalcula status/datas/progresso de todas as tarefas, atividades e do projeto, nesta ordem.
 * Deve ser chamada após qualquer mutação (data, dependência, status manual) antes de persistir.
 */
export function recomputeProject(project: Project): Project {
  const allTasks = project.activities.flatMap((a) => a.tasks).sort((a, b) => a.rowNumber - b.rowNumber);
  const tasksByRowNumber = new Map<number, Task>();

  const recomputedTasks = new Map<string, Task>();
  for (const task of allTasks) {
    const status = computeTaskStatus(task, tasksByRowNumber);
    const updated = { ...task, status };
    tasksByRowNumber.set(task.rowNumber, updated);
    recomputedTasks.set(task.id, updated);
  }

  const activities: Activity[] = project.activities.map((activity) => {
    const tasks = activity.tasks.map((t) => recomputedTasks.get(t.id) ?? t);
    const dates = rollUpDates(tasks);
    const status = rollUpStatus(tasks);
    return { ...activity, tasks, ...dates, status };
  });

  const projectDates = rollUpDates(activities);
  const status = rollUpStatus(activities);
  const progress = computeProgress(activities.flatMap((a) => a.tasks));

  return { ...project, activities, ...projectDates, status, progress, updatedAt: new Date().toISOString() };
}
