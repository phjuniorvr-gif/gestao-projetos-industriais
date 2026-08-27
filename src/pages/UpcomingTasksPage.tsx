import { useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, FolderKanban, ListChecks, ListTree, Search } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Card, EmptyState, Input, MultiSelectFilter } from '../components/ui';
import { UpcomingTaskDetail } from '../components/gantt';
import { useIsMobile, useUpcomingTasksData, STATUS_RANK } from '../hooks';
import { formatDatePtBr } from '../utils';
import { STATUS_COLOR } from '../types';

/** "Tarefas dos próximos 15 dias" (desktop) — tabela com ordenação por coluna. A lógica de dados
 * (linhas, filtros, restrição por responsável) mora em `useUpcomingTasksData` — compartilhada com
 * `MobileUpcomingTasksPage.tsx`, que só troca a apresentação (cards, sem ordenação por coluna). */
export function UpcomingTasksPage() {
  const data = useUpcomingTasksData();
  const {
    people,
    myPerson,
    restrictToMine,
    rows,
    projectOptions,
    activityOptions,
    responsavelOptions,
    search,
    setSearch,
    selectedProjects,
    setSelectedProjects,
    selectedActivities,
    setSelectedActivities,
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
  const isMobile = useIsMobile();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // Coluna que manda na ordenação da tabela — "prazo" é o padrão de sempre (mais urgente/mais
  // atrasado primeiro); "projeto" ordena por código (P01<->P99). Cada uma guarda a própria
  // direção pra lembrar como ficou da última vez que foi a coluna ativa.
  const [sortColumn, setSortColumn] = useState<'projeto' | 'prazo' | 'status'>('prazo');
  const [projectSortDir, setProjectSortDir] = useState<'asc' | 'desc'>('asc');
  const [prazoSortDir, setPrazoSortDir] = useState<'asc' | 'desc'>('asc');
  const [statusSortDir, setStatusSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleProjectSort() {
    if (sortColumn === 'projeto') setProjectSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortColumn('projeto');
      setProjectSortDir('asc');
    }
  }
  function togglePrazoSort() {
    if (sortColumn === 'prazo') setPrazoSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortColumn('prazo');
      setPrazoSortDir('asc');
    }
  }
  function toggleStatusSort() {
    if (sortColumn === 'status') setStatusSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortColumn('status');
      setStatusSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    const codeNumber = (code: string) => parseInt(code.match(/\d+/)?.[0] ?? '0', 10);
    const list = [...filtered];
    if (sortColumn === 'projeto') {
      list.sort((a, b) => codeNumber(a.project.code) - codeNumber(b.project.code));
      if (projectSortDir === 'desc') list.reverse();
    } else if (sortColumn === 'status') {
      list.sort((a, b) => STATUS_RANK[a.task.status] - STATUS_RANK[b.task.status]);
      if (statusSortDir === 'desc') list.reverse();
    } else {
      list.sort((a, b) => a.daysLeft - b.daysLeft);
      if (prazoSortDir === 'desc') list.reverse();
    }
    return list;
  }, [filtered, sortColumn, projectSortDir, prazoSortDir, statusSortDir]);

  return (
    <div className="space-y-6">
      <PageHeader title="Tarefas dos próximos 15 dias" subtitle="Tarefas com prazo previsto vencendo em breve (ou já vencido), ainda não concluídas" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Total de Tarefas" value={summary.total} icon={ListChecks} color="#0F172A" />
        <SummaryCard label="Projetos Envolvidos" value={summary.projectCount} icon={FolderKanban} color="#2563EB" />
        <SummaryCard label="Atividades Envolvidas" value={summary.activityCount} icon={ListTree} color="#7C3AED" />
        <SummaryCard
          label="Atrasadas"
          value={summary.overdueCount}
          icon={AlertTriangle}
          color={STATUS_COLOR.delayed}
          active={urgencyFilter === 'overdue'}
          onClick={() => setUrgencyFilter((f) => (f === 'overdue' ? null : 'overdue'))}
        />
        <SummaryCard
          label="A vencer"
          value={summary.upcomingCount}
          icon={CalendarClock}
          color={STATUS_COLOR.in_progress}
          active={urgencyFilter === 'upcoming'}
          onClick={() => setUrgencyFilter((f) => (f === 'upcoming' ? null : 'upcoming'))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por projeto, atividade, tarefa ou responsável"
            className="w-full pl-8"
          />
        </div>

        <MultiSelectFilter
          label="Projeto"
          options={projectOptions}
          selected={selectedProjects}
          onChange={setSelectedProjects}
          className="w-52"
        />
        <MultiSelectFilter
          label="Atividade"
          options={activityOptions}
          selected={selectedActivities}
          onChange={setSelectedActivities}
          className="w-52"
        />
        <MultiSelectFilter
          label="Responsável"
          options={responsavelOptions}
          selected={selectedResponsaveis}
          onChange={setSelectedResponsaveis}
          className="w-52"
        />

        <button
          type="button"
          onClick={() => setOnlyNotStarted((v) => !v)}
          aria-pressed={onlyNotStarted}
          className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${
            onlyNotStarted ? 'border-sidebar bg-sidebar text-white' : 'border-border bg-white text-text-muted hover:border-text-muted2'
          }`}
        >
          Não iniciadas
        </button>

        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="text-sm font-semibold text-action hover:underline">
            Limpar filtros
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
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
        <Card className="overflow-x-auto p-0">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[15%]" />
              <col className="w-[18%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-page/60 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                <th className="px-4 py-2.5">
                  <SortableHeader label="Projeto" active={sortColumn === 'projeto'} dir={projectSortDir} onClick={toggleProjectSort} />
                </th>
                <th className="px-4 py-2.5">Atividade</th>
                <th className="px-4 py-2.5">Tarefa</th>
                <th className="px-4 py-2.5">Responsável</th>
                <th className="px-4 py-2.5 text-center">Início previsto</th>
                <th className="px-4 py-2.5 text-center">Término previsto</th>
                <th className="px-4 py-2.5">
                  <SortableHeader label="Status" active={sortColumn === 'status'} dir={statusSortDir} onClick={toggleStatusSort} />
                </th>
                <th className="px-4 py-2.5 text-right">
                  <SortableHeader
                    label="Prazo"
                    active={sortColumn === 'prazo'}
                    dir={prazoSortDir}
                    onClick={togglePrazoSort}
                    align="right"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ project, activity, task, daysLeft }) => {
                const responsavel = people.find((p) => p.id === task.responsavelId);
                return (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-page/40"
                  >
                    <td className="max-w-0 px-4 py-2.5">
                      <p className="truncate font-medium text-text">
                        <span className="font-mono text-xs text-text-muted2">{project.code}</span> {project.name}
                      </p>
                    </td>
                    <td className="max-w-0 px-4 py-2.5">
                      <p className="truncate text-text-muted">{activity.name}</p>
                    </td>
                    <td className="max-w-0 px-4 py-2.5">
                      <p className="truncate text-text">{task.name}</p>
                    </td>
                    <td className="overflow-hidden truncate px-4 py-2.5 text-text-muted">{responsavel?.name ?? '—'}</td>
                    <td className="overflow-hidden truncate px-4 py-2.5 text-center text-text-muted">
                      {formatDatePtBr(task.plannedStart)}
                    </td>
                    <td className="overflow-hidden truncate px-4 py-2.5 text-center text-text-muted">
                      {formatDatePtBr(task.plannedEnd)}
                    </td>
                    <td className="overflow-hidden px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge
                          status={task.status}
                          startDelayed={task.isStartDelayed}
                          pendingConfirmation={task.pendingConfirmation}
                        />
                        {task.isStartDelayed && (
                          <span className="whitespace-nowrap rounded-full bg-page px-1.5 py-0.5 text-[10px] font-semibold text-text-muted2">
                            não iniciada
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`overflow-hidden px-4 py-2.5 text-right font-mono text-xs font-semibold ${
                        daysLeft < 0 ? 'text-status-delayed' : daysLeft <= 3 ? 'text-status-delayed' : 'text-text-muted'
                      }`}
                    >
                      {daysLeft < 0 ? `${Math.abs(daysLeft)}d` : daysLeft === 0 ? 'hoje' : `${daysLeft}d`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <UpcomingTaskDetail data={data} selectedTaskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} isMobile={isMobile} />
    </div>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 uppercase tracking-wide hover:text-text-muted ${
        align === 'right' ? 'ml-auto flex-row-reverse' : ''
      } ${active ? 'text-text-muted' : ''}`}
    >
      {label}
      <Icon className="h-3 w-3" />
    </button>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof ListChecks;
  color: string;
  /** Presente só nos cards clicáveis (Atrasadas/A vencer) — os outros três são só leitura. */
  active?: boolean;
  onClick?: () => void;
}) {
  const card = (
    <Card className={`overflow-hidden p-0 ${active ? 'ring-2 ring-offset-1' : ''}`} style={active ? ({ '--tw-ring-color': color } as CSSProperties) : undefined}>
      <div className="px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: color }}>
        {label}
      </div>
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-2xl font-bold text-text">{value}</span>
        <Icon className="h-6 w-6" style={{ color }} />
      </div>
    </Card>
  );

  if (!onClick) return card;

  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="text-left transition-opacity hover:opacity-90">
      {card}
    </button>
  );
}
