import { useState } from 'react';
import { Factory, HelpCircle, PackageCheck, Truck, X } from 'lucide-react';
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
  // Filtro por etapa (pedido do usuário — "clicar no card, ai exemplo fabricação, só mostra o
  // fabricação") — clicar de novo no mesmo card volta a mostrar as 4 colunas. Sem prop/estado
  // externo: é só uma preferência de visão desta tela, não precisa sobreviver a navegação nem
  // ser lido de fora (mesmo raciocínio do filtro de período de "Tarefas por vencer").
  const [activeStage, setActiveStage] = useState<ImportacaoStage | null>(null);
  const visibleStages = activeStage ? [activeStage] : IMPORTACAO_STAGE_ORDER;

  return (
    <div className="space-y-4">
      {/* Cards de resumo (pedido do usuário) — um por etapa, na mesma ordem das colunas abaixo
          (`IMPORTACAO_STAGE_ORDER`: Fabricação/Transit Time/Entrega/Outras etapas por último).
          "Total Importação" tirado de propósito (pedido do usuário — "ficou confuso"). Clicável
          (pedido do usuário) — filtra o quadro abaixo pra só aquela etapa; clique de novo no
          mesmo card limpa o filtro. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {IMPORTACAO_STAGE_ORDER.map((stage) => {
          const Icon = STAGE_SUMMARY_ICON[stage];
          const active = activeStage === stage;
          // Card apagado quando OUTRO está selecionado (pedido do usuário) — reforça visualmente
          // qual etapa está filtrando, sem precisar do anel sozinho fazer esse trabalho todo.
          const dimmed = activeStage !== null && !active;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => setActiveStage((s) => (s === stage ? null : stage))}
              className="text-left"
            >
              <Card
                className={`overflow-hidden p-0 transition-[box-shadow,opacity] ${active ? 'ring-2 ring-action ring-offset-1' : ''} ${dimmed ? 'opacity-40' : ''}`}
              >
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
            </button>
          );
        })}
      </div>

      {/* Achado do usuário, print — clicar de novo no MESMO card limpa o filtro, mas não é óbvio
          (o card ativo só tem um anel discreto, sem nenhum texto de "está filtrado"); botão de
          texto explícito, mesmo padrão "Limpar filtro" já usado no resto do app. */}
      {activeStage && (
        <button
          type="button"
          onClick={() => setActiveStage(null)}
          className="inline-flex min-h-11 items-center gap-1 px-1 text-xs font-semibold text-action"
        >
          <X className="h-3.5 w-3.5" /> Limpar filtro
        </button>
      )}

      <div className={activeStage ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'}>
      {visibleStages.map((stage) => (
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
                  {/* Faixa colorida à esquerda (pedido do usuário — "como faço pra diferenciar os
                      card de uma etapa pra outra") — no desktop a COLUNA já diferencia (4 lado a
                      lado), mas no mobile (1 coluna sempre, empilhado) os cards das 4 etapas
                      ficam em sequência sem nenhum sinal visual, já que o cabeçalho por coluna foi
                      removido antes por ser redundante com os cards de resumo. Reaproveita a
                      MESMA cor de `STAGE_SUMMARY_COLOR` (já usada no cabeçalho de cada card de
                      resumo acima) — sem cor nova, mesma linguagem visual. */}
                  <Card
                    className="space-y-1.5 border-l-4 p-3 transition-colors hover:border-text-muted2"
                    style={{ borderLeftColor: STAGE_SUMMARY_COLOR[stage] }}
                  >
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
                      Previsto: {formatDatePtBr(task.plannedStart)} — {formatDatePtBr(task.plannedEnd)}
                    </p>
                    {/* "Data Final" (pedido do usuário) é da ATIVIDADE inteira (roll-up de todas
                        as tarefas — Fabricação+Transit+Entrega), não da tarefa atual do card
                        ("Previsto" acima) — quando o processo termina de verdade, não só a etapa
                        atual. */}
                    <p className="text-xs text-text-muted">Data Final: {formatDatePtBr(activity.plannedEnd)}</p>
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
