import { addDays } from './dates';

export interface DurationTaskInput {
  /** Chave local do wizard — não é o id final da tarefa. */
  key: string;
  durationDays: number;
  /** Já resolvidos como número de linha (posição global no projeto). */
  predecessorRowNumbers: number[];
}

/**
 * Calcula plannedStart/plannedEnd a partir de duração + predecessoras (término→início, sem lag).
 * `tasks` deve estar na ordem final de rowNumber (índice 0 = linha 1), já que cada tarefa só
 * pode depender de uma linha anterior — a mesma regra usada no resto do app.
 */
export function computeDatesFromDuration(
  tasks: DurationTaskInput[],
  projectStartISO: string,
): Map<string, { plannedStart: string; plannedEnd: string }> {
  const result = new Map<string, { plannedStart: string; plannedEnd: string }>();

  for (const task of tasks) {
    const predecessorEnds = task.predecessorRowNumbers
      .map((row) => result.get(tasks[row - 1]?.key ?? '')?.plannedEnd)
      .filter((date): date is string => Boolean(date));

    const plannedStart = predecessorEnds.length
      ? addDays(predecessorEnds.sort().at(-1)!, 1)
      : projectStartISO;
    const plannedEnd = addDays(plannedStart, Math.max(1, task.durationDays) - 1);

    result.set(task.key, { plannedStart, plannedEnd });
  }

  return result;
}
