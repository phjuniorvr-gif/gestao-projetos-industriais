import type { DependencyType, Holiday, Task, TaskDependency } from '../types';
import { addBusinessDays } from './dates';

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
 * Forma mínima que a validação de grafo precisa — não `Task` inteiro (que desde a Fase 2.7 só
 * tem `dependencies`, por id; número de linha é sempre traduzido por quem chama). Deixa o editor
 * (e a validação sintética do wizard, `SelectedActivitiesList.tsx`) montar só isto, sem fabricar
 * um `Task` falso com campos que não fazem sentido fora de uma tarefa de verdade.
 */
export interface DependencyGraphNode {
  rowNumber: number;
  predecessorRowNumbers: number[];
}

/**
 * Valida as predecessoras de uma tarefa: autodependência, duplicata, número inexistente e ciclo.
 * `allTasks` deve conter a tarefa já com o novo valor de predecessorRowNumbers aplicado
 * (numeração contínua no projeto inteiro, não por atividade).
 */
export function validateTaskDependencies(taskRowNumber: number, allTasks: DependencyGraphNode[]): DependencyValidation {
  const errors: string[] = [];
  const rowNumbers = new Set(allTasks.map((t) => t.rowNumber));
  const task = allTasks.find((t) => t.rowNumber === taskRowNumber);
  if (!task) return { valid: true, errors: [] };

  if (task.predecessorRowNumbers.includes(taskRowNumber)) {
    errors.push('Uma tarefa não pode depender dela mesma.');
  }

  const duplicated = task.predecessorRowNumbers.some(
    (n, index) => task.predecessorRowNumbers.indexOf(n) !== index,
  );
  if (duplicated) {
    errors.push('A mesma predecessora foi informada mais de uma vez.');
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

function hasCycle(tasks: DependencyGraphNode[]): boolean {
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

/**
 * Data-limite que a regra do tipo exige pra sucessora, a partir das datas PREVISTAS da
 * predecessora (Fase 2.7, spec 2.7 — tabela dos 4 tipos, em dias úteis). FS/SS restringem o
 * INÍCIO da sucessora; FF/SF restringem o FIM — só usada por `computeTaskDependencyViolated`
 * (checagem de previsto); `computeTaskBlockedByDependencies` usa data REAL e resolve isso
 * inline, porque só se aplica quando a data real já existe (regra diferente, ver comentário lá).
 */
export function computeDependencyRuleDate(
  dependency: { tipo: DependencyType; folgaDias: number },
  predecessor: { plannedStart: string; plannedEnd: string },
  holidays: Holiday[],
  unit: string,
): string {
  switch (dependency.tipo) {
    case 'FS':
      return addBusinessDays(predecessor.plannedEnd, 1 + dependency.folgaDias, holidays, unit);
    case 'SS':
      return addBusinessDays(predecessor.plannedStart, dependency.folgaDias, holidays, unit);
    case 'FF':
      return addBusinessDays(predecessor.plannedEnd, dependency.folgaDias, holidays, unit);
    case 'SF':
      return addBusinessDays(predecessor.plannedStart, dependency.folgaDias, holidays, unit);
  }
}

/**
 * Violação de PREVISTO de uma única aresta (dependência) — extraída de
 * `computeTaskDependencyViolated` (Fase 2.7) pra ser reaproveitada também por
 * `countViolatedDependencyEdges` (Fase 4, Commit 4), que conta arestas, não tarefas.
 * `predecessor` ausente (dependência pendurada) nunca conta como violação.
 */
export function isDependencyEdgeViolated(
  dep: { tipo: DependencyType; folgaDias: number },
  predecessor: { plannedStart: string; plannedEnd: string } | undefined,
  task: { plannedStart: string; plannedEnd: string },
  holidays: Holiday[],
  unit: string,
): boolean {
  if (!predecessor) return false;
  const ruleDate = computeDependencyRuleDate(dep, predecessor, holidays, unit);
  const successorDate = dep.tipo === 'FF' || dep.tipo === 'SF' ? task.plannedEnd : task.plannedStart;
  return successorDate < ruleDate;
}

/**
 * Violação de PREVISTO (Fase 2.7, decisão 3) — compara a data prevista da sucessora contra a
 * regra calculada com as datas PREVISTAS da predecessora (não real: isto é uma checagem de
 * cronograma, "essas datas fazem sentido entre si", não de execução). Sinaliza, nunca bloqueia
 * salvar (spec 2.7: "violação não bloqueia"). Vale pros 4 tipos — diferente de
 * `computeTaskBlockedByDependencies`, que só considera FS/SS.
 */
export function computeTaskDependencyViolated(
  task: { plannedStart: string; plannedEnd: string; dependencies?: TaskDependency[] },
  tasksById: Map<string, { plannedStart: string; plannedEnd: string }>,
  holidays: Holiday[],
  unit: string,
): boolean {
  return (task.dependencies ?? []).some((dep) => isDependencyEdgeViolated(dep, tasksById.get(dep.predecessorId), task, holidays, unit));
}

/**
 * Contador pro rodapé do Gantt (Fase 4, Commit 4) — conta ARESTAS violadas (uma tarefa com 2
 * dependências violadas conta 2), diferente de `computeTaskDependencyViolated`, que é por tarefa
 * (`some()`, usado no selo). `tasks`/`tasksById` cobrem só o conjunto atualmente visível no
 * Gantt (já filtrado por categoria/projeto). `unitByTaskId` (não um `unit` único) porque a tela
 * de Cronograma de Projetos mostra vários projetos — e portanto várias unidades — ao mesmo tempo;
 * `isDependencyEdgeViolated`/`computeDependencyRuleDate` continuam recebendo um `unit` por
 * chamada, é só a busca desse valor que muda de "constante" pra "por tarefa" aqui.
 */
export function countViolatedDependencyEdges(
  tasks: { id: string; plannedStart: string; plannedEnd: string; dependencies: TaskDependency[] }[],
  tasksById: Map<string, { plannedStart: string; plannedEnd: string }>,
  holidays: Holiday[],
  unitByTaskId: Map<string, string>,
): number {
  let count = 0;
  for (const task of tasks) {
    const unit = unitByTaskId.get(task.id) ?? '';
    for (const dep of task.dependencies) {
      if (isDependencyEdgeViolated(dep, tasksById.get(dep.predecessorId), task, holidays, unit)) count++;
    }
  }
  return count;
}

/**
 * Bloqueada (selo "não pode começar", Fase 2.7 — decisão 2, ajustada com o usuário): só FS e SS
 * restringem o INÍCIO da sucessora, então só eles bloqueiam — FF/SF restringem o fim, uma tarefa
 * só com predecessora FF pode começar livremente (marcar bloqueio ali seria falso positivo).
 * Ao contrário de `computeTaskDependencyViolated` (previsto), usa data REAL da predecessora:
 * sem `actualEnd` (FS) ou `actualStart` (SS) ainda, bloqueada incondicionalmente — a folga só
 * entra depois que a data real existe, contada a partir dela. Guardas de `plannedStart`/já
 * iniciada/antes do prazo preservam o comportamento anterior a este tipo de dependência existir.
 */
export function computeTaskBlockedByDependencies(
  task: Task,
  tasksById: Map<string, Task>,
  today: string,
  holidays: Holiday[],
  unit: string,
): boolean {
  if (!task.plannedStart) return false;
  if (task.actualStart || task.actualEnd) return false;
  if (today < task.plannedStart) return false;

  return (task.dependencies ?? []).some((dep) => {
    if (dep.tipo !== 'FS' && dep.tipo !== 'SS') return false;
    const predecessor = tasksById.get(dep.predecessorId);
    if (!predecessor) return false;

    const anchor = dep.tipo === 'FS' ? predecessor.actualEnd : predecessor.actualStart;
    if (!anchor) return true;

    const offset = dep.tipo === 'FS' ? 1 + dep.folgaDias : dep.folgaDias;
    const thresholdDate = addBusinessDays(anchor, offset, holidays, unit);
    return today < thresholdDate;
  });
}
