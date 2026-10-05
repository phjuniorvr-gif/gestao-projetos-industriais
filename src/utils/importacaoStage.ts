import type { ActivityView, ProjectStatus, ProjectView, TaskView } from '../types';
import { diffDays } from './dates';
import { shouldShowStartDelayedBadge } from './status';

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

export interface ImportacaoResumoCard {
  project: ProjectView;
  activity: ActivityView;
  stage: ImportacaoStage;
  task: TaskView;
}

function plural(n: number): string {
  return n === 1 ? 'dia' : 'dias';
}

/** Mesma precedência já corrigida nos cards/filtros do Kanban (sessão de 2026-09-30) — atrasado
 * sempre prevalece sobre "não iniciada" (`shouldShowStartDelayedBadge` já exclui `status ===
 * 'delayed'`), então os dois nunca aparecem juntos aqui. */
export function selectImportacaoResumoCards(cards: ImportacaoResumoCard[]): ImportacaoResumoCard[] {
  return cards.filter((c) => c.task.status === 'delayed' || shouldShowStartDelayedBadge(c.task));
}

/** 🔴 pra atrasado, 🟡 pra não iniciado — mesma leitura rápida de semáforo que o resto do app já
 * usa (cor laranja/`status-delayed` nos dois casos na UI); aqui em emoji porque o destino é texto
 * puro (WhatsApp/Telegram), sem cor de CSS disponível. */
function formatResumoStatusLine(task: TaskView, today: string): string {
  if (task.status === 'delayed') {
    const days = diffDays(task.plannedEnd, today);
    return `🔴 Atrasado ${days} ${plural(days)}`;
  }
  const days = diffDays(task.plannedStart, today);
  return `🟡 Não iniciado (deveria ter começado há ${days} ${plural(days)})`;
}

/** Texto pronto pra copiar e enviar ao comprador (pedido do usuário, sessão de 2026-10-05) — só
 * processos atrasados/não iniciados, agrupados por etapa (Fabricação/Transit Time/Entrega/
 * Outras), no formato literal que o usuário deu como exemplo. `cards` já deve vir filtrado por
 * `selectImportacaoResumoCards` — função separada pra poder contar quantos cards entram (pro
 * botão mostrar "N pendências") sem gerar o texto inteiro à toa. **Emoji no lugar do "-" de
 * marcador + negrito em "Processo N"** (pedido seguinte do usuário) — `*texto*` é a sintaxe de
 * negrito do WhatsApp/Telegram (os dois destinos citados pelo usuário), não Markdown de verdade;
 * cola como `*Processo 758*` em texto puro se o destino não entender essa sintaxe, mas renderiza
 * negrito nos dois apps de mensagem. */
export function buildImportacaoResumoText(cards: ImportacaoResumoCard[], today: string): string {
  const blocks: string[] = [];
  for (const stage of IMPORTACAO_STAGE_ORDER) {
    const stageCards = cards.filter((c) => c.stage === stage);
    if (stageCards.length === 0) continue;
    const lines: string[] = [`*${IMPORTACAO_STAGE_LABELS[stage]}*`, ''];
    for (const { project, activity, task } of stageCards) {
      const processo = activity.processo || '—';
      lines.push(`📦 *Processo ${processo}*`);
      lines.push(`🏭 ${project.code} - ${activity.name} (Processo ${processo})`);
      lines.push(formatResumoStatusLine(task, today));
      lines.push('📝 Observação:');
      lines.push(task.observacao?.trim() || '(sem observação)');
      lines.push('');
    }
    blocks.push(lines.join('\n').trimEnd());
  }
  return blocks.join('\n\n');
}
