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
 * por decisão explícita (o selo R{n} da spec é sobre "data prevista", não sobre a base).
 * Edições feitas pelo administrador não contam (`porAdministrador`) — a pedido do usuário
 * (único administrador do sistema): mudar previsto/base continua sendo registrado no log de
 * auditoria normalmente, só não infla o selo R{n} que sinaliza replanejamento pra quem acompanha
 * o cronograma. */
export function computeReplanCount(
  taskId: string,
  replanejamentos: { tarefaId: string; campo: ReplanCampo; porAdministrador: boolean }[],
): number {
  return replanejamentos.filter((r) => r.tarefaId === taskId && r.campo === 'previsto' && !r.porAdministrador).length;
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
 * válido mesmo sem motivo (não força preenchimento de um campo que não se aplica). Administrador
 * fica de fora dessa obrigação (a pedido do usuário — único administrador do sistema, editando o
 * próprio cronograma sem precisar justificar cada ajuste); mesma regra espelhada na RPC
 * `replanejar_tarefa()` no banco, que também substitui motivo em branco por um texto padrão só
 * pra administrador (a tabela `replanejamentos` nunca aceita motivo vazio, pra ninguém). */
export function validateReplanMotivo(changes: DateChangeResult, motivo: string, isAdmin: boolean): ReplanValidation {
  if ((changes.previstoChanged || changes.baseChanged) && !motivo.trim() && !isAdmin) {
    return { valid: false, errors: ['Informe o motivo do replanejamento.'] };
  }
  return { valid: true, errors: [] };
}

/** Fase 7 (Parte A) — fim não pode ficar antes do início (previsto ou real, mesma regra pros
 * dois pares de data). Início = fim é permitido (tarefa de 1 dia, medido na Fase 4: 18% das
 * tarefas reais têm essa duração). */
export function validateDateOrder(start: string, end: string): ReplanValidation {
  if (start && end && end < start) {
    return { valid: false, errors: ['A data de fim não pode ser anterior à data de início.'] };
  }
  return { valid: true, errors: [] };
}

// buildReplanEntries/insertReplanejamentos (montar e gravar as linhas de log a partir do
// client) foram removidas na Fase 5, Commit 2 — substituídas pela RPC `replanejar_tarefa()`
// (Postgres), que faz o update de `tasks` e o insert em `replanejamentos` na mesma transação.
// As duas chamadas independentes daqui não eram atômicas: uma podia ter sucesso sem a outra.
