import { addBusinessDays } from './dates';
import type { Holiday } from '../types';

export interface DurationTaskInput {
  /** Chave local do wizard — não é o id final da tarefa. */
  key: string;
  /** Duração em dias úteis (Fase 2.6 — spec: "toda duração ... usa dias úteis"). */
  durationDays: number;
  /** Já resolvidos como número de linha (posição global no projeto). */
  predecessorRowNumbers: number[];
}

/**
 * Calcula plannedStart/plannedEnd a partir de duração (em dias úteis) + predecessoras
 * (término→início, sem lag, ambos em dias úteis). `tasks` deve estar na ordem final de
 * rowNumber (índice 0 = linha 1), já que cada tarefa só pode depender de uma linha anterior —
 * a mesma regra usada no resto do app.
 */
export function computeDatesFromDuration(
  tasks: DurationTaskInput[],
  projectStartISO: string,
  holidays: Holiday[] = [],
  unit?: string,
): Map<string, { plannedStart: string; plannedEnd: string }> {
  const result = new Map<string, { plannedStart: string; plannedEnd: string }>();

  for (const task of tasks) {
    const predecessorEnds = task.predecessorRowNumbers
      .map((row) => result.get(tasks[row - 1]?.key ?? '')?.plannedEnd)
      .filter((date): date is string => Boolean(date));

    const plannedStart = predecessorEnds.length
      ? addBusinessDays(predecessorEnds.sort().at(-1)!, 1, holidays, unit)
      : projectStartISO;
    const plannedEnd = addBusinessDays(plannedStart, Math.max(1, task.durationDays) - 1, holidays, unit);

    result.set(task.key, { plannedStart, plannedEnd });
  }

  return result;
}
