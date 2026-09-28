import type { ProjectStatus } from '../types';

// Kanban da aba Importação (sessão de 2026-09-28, "teste" a pedido do usuário) — agrupa cada
// processo pela ETAPA em que está agora, sem nenhum campo novo no banco (regra de ouro): deriva
// do nome + status das tarefas que a atividade já tem.
export type ImportacaoStage = 'fabricacao' | 'transit' | 'entrega' | 'outras';

export const IMPORTACAO_STAGE_ORDER: ImportacaoStage[] = ['fabricacao', 'transit', 'entrega', 'outras'];

export const IMPORTACAO_STAGE_LABELS: Record<ImportacaoStage, string> = {
  fabricacao: 'Fabricação',
  transit: 'Transit Time',
  entrega: 'Entrega',
  outras: 'Outras etapas',
};

/** Por NOME (contém, case-insensitive), não por posição (1ª/2ª/3ª tarefa) — medido antes de
 * escolher: atividade real ("Protetores Porta Palete") tem só 1 tarefa, chamada "Transit Time";
 * por posição isso apareceria errado, como se fosse a 1ª etapa ("Fabricação"). Por nome funciona
 * mesmo pra atividade fora do padrão de 3 tarefas. */
function matchStageName(name: string): ImportacaoStage {
  const n = name.toLowerCase();
  if (n.includes('fabrica')) return 'fabricacao';
  if (n.includes('transit')) return 'transit';
  if (n.includes('entrega')) return 'entrega';
  return 'outras';
}

/** Etapa atual = a PRIMEIRA tarefa (na ordem em que a atividade já lista, não reordenada) que
 * ainda não está concluída. Todas concluídas (ou nenhuma tarefa) → `null`, o processo some do
 * Kanban inteiro (pedido do usuário — "não quero ver as concluídas"). Tarefa cujo nome não bate
 * com nenhuma das 3 etapas conhecidas cai em "outras" — não esconde nem quebra, só sinaliza que
 * aquela atividade ainda não está no padrão (Fabricação/Transit Time/Entrega). */
export function computeImportacaoStage<T extends { name: string; status: ProjectStatus }>(
  tasks: T[],
): { stage: ImportacaoStage; task: T } | null {
  const current = tasks.find((t) => t.status !== 'completed');
  if (!current) return null;
  return { stage: matchStageName(current.name), task: current };
}
