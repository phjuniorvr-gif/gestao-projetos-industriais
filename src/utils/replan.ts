import type { ReplanCampo } from '../types';

/**
 * Auditoria de replanejamento (Fase 2.5) — funções puras, arquivo separado de `status.ts`
 * porque operam sobre uma fonte de dados diferente (o log `Replanejamento[]`, vindo de uma
 * tabela própria), mesmo padrão de isolamento por assunto de `dependencies.ts`/`schedule.ts`.
 */

// Shape próprio, não `Pick<Task,...>` — em `Task`, `baseStart`/`baseEnd` são obrigatórios
// (garantidos por projectsRepo.ts/useProjects.ts desde a Fase 2.5), mas essas funções aceitam
// um shape mais permissivo de propósito.
interface DateFields {
  plannedStart: string;
  plannedEnd: string;
  baseStart?: string;
  baseEnd?: string;
}
type DatePatch = Partial<DateFields>;

/** Conta quantas vezes o PREVISTO desta tarefa já foi empurrado — só `campo==='previsto'`,
 * por decisão explícita (o selo R{n} da spec é sobre "data prevista", não sobre a base). */
export function computeReplanCount(
  taskId: string,
  replanejamentos: { tarefaId: string; campo: ReplanCampo }[],
): number {
  return replanejamentos.filter((r) => r.tarefaId === taskId && r.campo === 'previsto').length;
}

export interface DateChangeResult {
  previstoChanged: boolean;
  baseChanged: boolean;
}

/** Compara o patch contra o valor atual da tarefa — só conta como mudança se o valor novo for
 * realmente diferente do antigo (onBlur sem edição de verdade não deve exigir motivo). */
export function computeDateChanges(oldTask: DateFields, patch: DatePatch): DateChangeResult {
  const previstoChanged =
    (patch.plannedStart !== undefined && patch.plannedStart !== oldTask.plannedStart) ||
    (patch.plannedEnd !== undefined && patch.plannedEnd !== oldTask.plannedEnd);
  const baseChanged =
    (patch.baseStart !== undefined && patch.baseStart !== oldTask.baseStart) ||
    (patch.baseEnd !== undefined && patch.baseEnd !== oldTask.baseEnd);
  return { previstoChanged, baseChanged };
}

export interface ReplanValidation {
  valid: boolean;
  errors: string[];
}

/** Motivo é obrigatório sempre que previsto OU base mudou de verdade — mesmo se nada mudou,
 * válido mesmo sem motivo (não força preenchimento de um campo que não se aplica). */
export function validateReplanMotivo(changes: DateChangeResult, motivo: string): ReplanValidation {
  if ((changes.previstoChanged || changes.baseChanged) && !motivo.trim()) {
    return { valid: false, errors: ['Informe o motivo do replanejamento.'] };
  }
  return { valid: true, errors: [] };
}

// buildReplanEntries/insertReplanejamentos (montar e gravar as linhas de log a partir do
// client) foram removidas na Fase 5, Commit 2 — substituídas pela RPC `replanejar_tarefa()`
// (Postgres), que faz o update de `tasks` e o insert em `replanejamentos` na mesma transação.
// As duas chamadas independentes daqui não eram atômicas: uma podia ter sucesso sem a outra.
