import { Factory, HelpCircle, PackageCheck, Truck } from 'lucide-react';
import { Card } from '../ui';
import { StatusBadge } from '../shared/StatusBadge';
import type { ActivityView, ProjectView, TaskView } from '../../types';
import {
  calendarDaysBetween,
  diffDays,
  formatDatePtBr,
  IMPORTACAO_STAGE_LABELS,
  IMPORTACAO_STAGE_ORDER,
  type ImportacaoStage,
} from '../../utils';

export interface ImportacaoKanbanCard {
  project: ProjectView;
  activity: ActivityView;
  stage: ImportacaoStage;
  task: TaskView;
}

interface ImportacaoKanbanProps {
  cards: ImportacaoKanbanCard[];
  today: string;
  onOpenTask: (task: TaskView) => void;
}

function plural(n: number): string {
  return n === 1 ? 'dia' : 'dias';
}

/** Linha "Desvio" (pedido do usuário — "não alteramos a base, como podemos enxergar no kanban") —
 * compara o FIM da linha de base (congelada, nunca muda sozinha — Fase 2.5) contra o FIM
 * previsto ATUAL (que pode ter sido replanejado) da mesma tarefa. Dias CORRIDOS (`diffDays`),
 * mesma unidade da Duração logo abaixo — não é o mesmo cálculo de `computeScheduleDeviationDays`
 * (dias úteis, compara real/hoje contra previsto, só quando `status === 'delayed'`, outro
 * conceito de "desvio" já usado em `portfolio.ts`/tabela de Projetos). `null` quando os dois
 * batem — sem replanejamento no fim previsto, não há o que mostrar. */
function formatDeviationLine(task: TaskView): { text: string; late: boolean } | null {
  const deviation = diffDays(task.baseEnd, task.plannedEnd);
  if (deviation === 0) return null;
  if (deviation > 0) return { text: `Desvio de ${deviation} ${plural(deviation)}`, late: true };
  const days = Math.abs(deviation);
  return { text: `Adiantado ${days} ${plural(days)}`, late: false };
}

/** Linha embaixo da data do card (pedido do usuário) — texto muda conforme a SITUAÇÃO da tarefa,
 * não só a contagem: "Atrasado" conta a partir do FIM previsto (já vencido); "Não iniciada" conta
 * a partir do INÍCIO previsto (já vencido, sem início real — `task.isStartDelayed`); "Planejado"
 * (sem nenhuma das duas condições) conta até o início; "Em andamento" conta até o fim. Dias
 * CORRIDOS (`diffDays`), não úteis — mesma convenção já usada pra contagem de prazo em "Tarefas
 * por vencer" (`useUpcomingTasksData.ts`), não a de "Desvio" (`computeScheduleDeviationDays`,
 * dias úteis, outro cálculo, pra outro lugar do app). Sem gate de "concluído": todo card que
 * chega aqui já é não-concluído (`computeImportacaoStage` descarta quem terminou). */
function formatDaysLine(task: TaskView, today: string): { text: string; late: boolean } {
  if (task.status === 'delayed') {
    const days = diffDays(task.plannedEnd, today);
    return { text: `Atrasado ${days} ${plural(days)}`, late: true };
  }
  if (task.isStartDelayed) {
    const days = diffDays(task.plannedStart, today);
    return { text: `Era pra começar há ${days} ${plural(days)}`, late: true };
  }
  if (task.status === 'in_progress') {
    const days = diffDays(today, task.plannedEnd);
    return { text: days === 0 ? 'Termina hoje' : `Termina em ${days} ${plural(days)}`, late: false };
  }
  // 'planned', sem isStartDelayed — início ainda não chegou.
  const days = diffDays(today, task.plannedStart);
  return { text: days <= 0 ? 'Começa hoje' : `Começa em ${days} ${plural(days)}`, late: false };
}

// Cor de cada card de resumo (pedido do usuário) — reaproveita tokens já existentes no design
// system (`STATUS_COLOR`/`--color-*`), sem inventar cor nova; escolhidas só por diferenciação
// visual, sem ligação com status de tarefa (Entrega usa o azul de ação, não o verde de
// "concluído" — processo em etapa de Entrega ainda não terminou). "Outras etapas" usa cinza
// neutro (`--color-text-muted`) — não é uma etapa de verdade, é catálogo de quem ainda não está
// no padrão Fabricação/Transit Time/Entrega.
const STAGE_SUMMARY_COLOR: Record<ImportacaoStage, string> = {
  fabricacao: 'var(--color-status-planned)',
  transit: 'var(--color-status-progress)',
  entrega: 'var(--color-action)',
  outras: 'var(--color-text-muted)',
};
const STAGE_SUMMARY_ICON: Record<ImportacaoStage, typeof Factory> = {
  fabricacao: Factory,
  transit: Truck,
  entrega: PackageCheck,
  outras: HelpCircle,
};

/** "Teste" a pedido do usuário (sessão de 2026-09-28) — em vez da lista corrida de sempre, agrupa
 * cada processo pela etapa em que está agora (`computeImportacaoStage`, `utils/importacaoStage.ts`).
 * Processo com todas as tarefas concluídas nunca chega até aqui — já vem filtrado por quem monta
 * `cards` (`ProjectSchedulePage.tsx`). */
export function ImportacaoKanban({ cards, today, onOpenTask }: ImportacaoKanbanProps) {
  const groups: Record<ImportacaoStage, ImportacaoKanbanCard[]> = { fabricacao: [], transit: [], entrega: [], outras: [] };
  for (const card of cards) groups[card.stage].push(card);

  return (
    <div className="space-y-4">
      {/* Cards de resumo (pedido do usuário) — um por etapa, na mesma ordem das colunas abaixo
          (`IMPORTACAO_STAGE_ORDER`: Fabricação/Transit Time/Entrega/Outras etapas por último).
          "Total Importação" tirado de propósito (pedido do usuário — "ficou confuso"). Estático,
          sem filtro/clique — só contagem. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {IMPORTACAO_STAGE_ORDER.map((stage) => {
          const Icon = STAGE_SUMMARY_ICON[stage];
          return (
            <Card key={stage} className="overflow-hidden p-0">
              <div
                className="px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: STAGE_SUMMARY_COLOR[stage] }}
              >
                {IMPORTACAO_STAGE_LABELS[stage]}
              </div>
              <div className="flex items-center justify-between px-3 py-3">
                <span className="text-2xl font-bold text-text">{groups[stage].length}</span>
                <Icon className="h-6 w-6" style={{ color: STAGE_SUMMARY_COLOR[stage] }} />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {IMPORTACAO_STAGE_ORDER.map((stage) => (
        // Cabeçalho por coluna (rótulo + contagem) removido — pedido do usuário, print mostrando
        // que já é redundante com os cards de resumo coloridos acima (mesma etapa, mesma
        // contagem, duas vezes na tela).
        <div key={stage} className="space-y-2">
          <div className="space-y-2">
            {groups[stage].length === 0 ? (
              <p className="px-1 text-xs text-text-muted2">Nenhum processo nesta etapa.</p>
            ) : (
              groups[stage].map(({ project, activity, task }) => {
                const daysLine = formatDaysLine(task, today);
                const deviationLine = formatDeviationLine(task);
                const duration = calendarDaysBetween(task.plannedStart, task.plannedEnd);
                return (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="block w-full text-left"
                >
                  <Card className="space-y-1.5 p-3 transition-colors hover:border-text-muted2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-text">
                        Processo {activity.processo || '—'}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-text-muted2">{project.code}</span>
                    </div>
                    <p className="truncate text-xs text-text-muted">
                      <span className="font-mono text-text-muted2">{project.code}</span> — {activity.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {formatDatePtBr(task.plannedStart)} — {formatDatePtBr(task.plannedEnd)}
                    </p>
                    {deviationLine && (
                      <p className={`text-xs font-semibold ${deviationLine.late ? 'text-status-delayed' : 'text-text-muted'}`}>
                        {deviationLine.text}
                      </p>
                    )}
                    <p className="text-xs text-text-muted">
                      Duração: {duration} {plural(duration)}
                    </p>
                    <p className={`text-xs font-semibold ${daysLine.late ? 'text-status-delayed' : 'text-text-muted'}`}>
                      {daysLine.text}
                    </p>
                    <StatusBadge
                      status={task.status}
                      blocked={task.isBlocked}
                      startDelayed={task.isStartDelayed}
                      lateCompletion={task.isLateCompletion}
                      pendingConfirmation={task.pendingConfirmation}
                      rejected={task.rejected}
                    />
                  </Card>
                </button>
                );
              })
            )}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
