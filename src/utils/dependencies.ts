import type { Task } from '../types';

export function parsePredecessors(input: string): number[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export function formatPredecessors(numbers: number[]): string {
  return numbers.join(', ');
}

export interface DependencyValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Valida as predecessoras de uma tarefa: autodependência, número inexistente e ciclo.
 * `allTasks` deve conter a tarefa já com o novo valor de predecessorRowNumbers aplicado
 * (numeração contínua no projeto inteiro, não por atividade).
 */
export function validateTaskDependencies(taskRowNumber: number, allTasks: Task[]): DependencyValidation {
  const errors: string[] = [];
  const rowNumbers = new Set(allTasks.map((t) => t.rowNumber));
  const task = allTasks.find((t) => t.rowNumber === taskRowNumber);
  if (!task) return { valid: true, errors: [] };

  if (task.predecessorRowNumbers.includes(taskRowNumber)) {
    errors.push('Uma tarefa não pode depender dela mesma.');
  }

  for (const predecessor of task.predecessorRowNumbers) {
    if (predecessor !== taskRowNumber && !rowNumbers.has(predecessor)) {
      errors.push(`A tarefa ${predecessor} não existe.`);
    }
  }

  if (errors.length === 0 && hasCycle(allTasks)) {
    errors.push('Esta dependência cria um ciclo entre tarefas.');
  }

  return { valid: errors.length === 0, errors };
}

function hasCycle(tasks: Task[]): boolean {
  const graph = new Map<number, number[]>();
  for (const task of tasks) {
    graph.set(task.rowNumber, task.predecessorRowNumbers);
  }

  const visiting = new Set<number>();
  const visited = new Set<number>();

  function visit(node: number): boolean {
    if (visited.has(node)) return false;
    if (visiting.has(node)) return true;
    visiting.add(node);
    for (const predecessor of graph.get(node) ?? []) {
      if (visit(predecessor)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (visit(node)) return true;
  }
  return false;
}
