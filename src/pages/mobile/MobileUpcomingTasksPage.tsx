import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { UpcomingTaskDetail } from '../../components/gantt';
import { Card, EmptyState, Input, MultiSelectFilter } from '../../components/ui';
import { useUpcomingTasksData } from '../../hooks';
import { formatDatePtBr } from '../../utils';
import { STATUS_COLOR } from '../../types';
import type { UpcomingRow } from '../../hooks';

/**
 * "Tarefas dos próximos 15 dias" no mobile — cards empilhados em vez da tabela larga do desktop
 * (mesmo raciocínio de `MobileScheduleList.tsx`: a tabela desktop não cabe numa tela estreita).
 * É a ÚNICA tela que um usuário comum restrito enxerga (`MobileTabBar.tsx`), então tende a ser
 * usada por quem está em campo — sem filtro de Projeto/Atividade (o usuário comum já vê só as
 * próprias tarefas; a busca cobre o resto), mas COM filtro de Responsável (pedido do usuário —
 * administrador/visualizador usam pra ver a fila de uma pessoa específica). Ordenação sempre por
 * urgência (mais atrasado primeiro) — sem cabeçalho de coluna pra clicar, então sem o toggle de
 * ordenação do desktop.
 */
export function MobileUpcomingTasksPage() {
  const data = useUpcomingTasksData();
  const {
    people,
    myPerson,
    restrictToMine,
    rows,
    search,
    setSearch,
    responsavelOptions,
    selectedResponsaveis,
    setSelectedResponsaveis,
    onlyNotStarted,
    setOnlyNotStarted,
    urgencyFilter,
    setUrgencyFilter,
    filtered,
    summary,
    hasActiveFilters,
    clearFilters,
  } = data;
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const sorted = useMemo(() => [...filtered].sort((a, b) => a.daysLeft - b.daysLeft), [filtered]);

  return (
    <div className="space-y-4">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por projeto, atividade ou tarefa"
        className="min-h-11 w-full"
      />

      <MultiSelectFilter
        label="Responsável"
        options={responsavelOptions}
        selected={selectedResponsaveis}
        onChange={setSelectedResponsaveis}
        className="min-h-11 w-full"
      />

      <div className="grid grid-cols-2 gap-2">
        <UrgencyChip
          label="Atrasadas"
          value={summary.overdueCount}
          color={STATUS_COLOR.delayed}
          active={urgencyFilter === 'overdue'}
          onClick={() => setUrgencyFilter((f) => (f === 'overdue' ? null : 'overdue'))}
        />
        <UrgencyChip
          label="A vencer"
          value={summary.upcomingCount}
          color={STATUS_COLOR.in_progress}
          active={urgencyFilter === 'upcoming'}
          onClick={() => setUrgencyFilter((f) => (f === 'upcoming' ? null : 'upcoming'))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOnlyNotStarted((v) => !v)}
          aria-pressed={onlyNotStarted}
          className={`flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${
            onlyNotStarted ? 'border-sidebar bg-sidebar text-white' : 'border-border bg-white text-text-muted'
          }`}
        >
          Não iniciadas
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-semibold text-action"
          >
            <X className="h-3.5 w-3.5" /> Limpar filtro
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="Nenhuma tarefa nos próximos 15 dias"
          description={
            restrictToMine && !myPerson
              ? 'Seu usuário ainda não está vinculado a uma pessoa responsável — fale com o administrador.'
              : rows.length > 0
                ? 'Ajuste a busca para encontrar o que procura.'
                : 'Nada com prazo previsto vencendo em breve.'
          }
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((row) => (
            <TaskCard
              key={row.task.id}
              row={row}
              responsavelName={people.find((p) => p.id === row.task.responsavelId)?.name}
              onOpen={() => setSelectedTaskId(row.task.id)}
            />
          ))}
        </div>
      )}

      <UpcomingTaskDetail data={data} selectedTaskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} isMobile />
    </div>
  );
}

function UrgencyChip({
  label,
  value,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
        active ? 'border-action bg-action/5' : 'border-border bg-white'
      }`}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm text-text">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 font-mono text-base font-bold" style={{ color }}>
        {value}
      </span>
    </button>
  );
}

function TaskCard({ row, responsavelName, onOpen }: { row: UpcomingRow; responsavelName?: string; onOpen: () => void }) {
  const { project, activity, task, daysLeft } = row;
  const overdue = daysLeft < 0;
  return (
    <Card className="min-h-11 cursor-pointer space-y-2 p-3" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-text-muted2">
            {project.code} · {activity.name}
          </p>
          <p className="truncate text-sm font-semibold text-text">{task.name}</p>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap font-mono text-xs font-semibold ${
            overdue || daysLeft <= 3 ? 'text-status-delayed' : 'text-text-muted'
          }`}
        >
          {overdue ? `${Math.abs(daysLeft)}d atraso` : daysLeft === 0 ? 'hoje' : `${daysLeft}d`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <StatusBadge status={task.status} startDelayed={task.isStartDelayed} pendingConfirmation={task.pendingConfirmation} />
        {task.isStartDelayed && (
          <span className="whitespace-nowrap rounded-full bg-page px-1.5 py-0.5 text-[10px] font-semibold text-text-muted2">
            não iniciada
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
        <span className="truncate">{responsavelName ?? '—'}</span>
        <span className="shrink-0 whitespace-nowrap">
          {formatDatePtBr(task.plannedStart)} → {formatDatePtBr(task.plannedEnd)}
        </span>
      </div>
    </Card>
  );
}
