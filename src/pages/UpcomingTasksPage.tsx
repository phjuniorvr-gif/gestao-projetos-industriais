import { useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, FolderKanban, ListChecks, ListTree, Search } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Card, ConfirmDialog, EmptyState, Input, MultiSelectFilter } from '../components/ui';
import { TaskPanel } from '../components/gantt';
import { useCategories, useHolidays, useIsMobile, usePeople, usePerfil, useProjects } from '../hooks';
import { diffDays, formatDatePtBr } from '../utils';
import { STATUS_COLOR } from '../types';
import type { ActivityView, ProjectStatus, ProjectView, TaskView } from '../types';

const WINDOW_DAYS = 15;

// Ordem por urgência (não alfabética) — mesmo raciocínio de outras listas de status do app.
const STATUS_RANK: Record<ProjectStatus, number> = { delayed: 0, in_progress: 1, planned: 2, completed: 3 };

interface UpcomingRow {
  project: ProjectView;
  activity: ActivityView;
  task: TaskView;
  /** `end`: prazo (fim previsto) dentro da janela — `daysLeft` conta até o fim. `start`: ainda
   * não começou e o INÍCIO previsto é que está dentro da janela (fim previsto fica pra depois,
   * senão já teria caído no caso `end`) — `daysLeft` aqui conta até o início. */
  kind: 'end' | 'start';
  daysLeft: number;
}

/** "Tarefas dos próximos 15 dias" — uma linha por tarefa (não atividade/projeto), ainda não
 * concluída. Dois jeitos de entrar na lista: fim previsto dentro da janela (inclui atrasadas,
 * `daysLeft < 0`), OU início previsto dentro da janela pra quem ainda não começou (tarefa longa,
 * cujo fim só cai muito depois dos 15 dias, mas que precisa aparecer porque está pra começar —
 * pedido do usuário: "tarefas que não começou"). Ordenado do mais urgente pro menos urgente. */
export function UpcomingTasksPage() {
  const { projects, today, replanejamentos, updateTask, updateTaskActualDates, replanTask, setTaskPredecessors, removeTask } =
    useProjects();
  const { people, createPerson } = usePeople();
  const { categories } = useCategories();
  const { holidays } = useHolidays();
  const isAdmin = usePerfil();
  const isMobile = useIsMobile();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskView | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedResponsaveis, setSelectedResponsaveis] = useState<string[]>([]);
  const [onlyNotStarted, setOnlyNotStarted] = useState(false);
  // Clique no card "Atrasadas"/"A vencer" filtra a tabela pra só aquele grupo — clicar de novo no
  // mesmo card desliga. Só um ativo por vez (é a mesma dimensão, atrasada x a vencer).
  const [urgencyFilter, setUrgencyFilter] = useState<'overdue' | 'upcoming' | null>(null);
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

  const rows = useMemo(() => {
    const list: UpcomingRow[] = [];
    for (const project of projects) {
      for (const activity of project.activities) {
        for (const task of activity.tasks) {
          if (task.status === 'completed') continue;

          if (task.plannedEnd) {
            const daysToEnd = diffDays(today, task.plannedEnd);
            if (daysToEnd <= WINDOW_DAYS) {
              list.push({ project, activity, task, kind: 'end', daysLeft: daysToEnd });
              continue;
            }
          }

          if (!task.actualStart && task.plannedStart) {
            const daysToStart = diffDays(today, task.plannedStart);
            if (daysToStart <= WINDOW_DAYS) {
              list.push({ project, activity, task, kind: 'start', daysLeft: daysToStart });
            }
          }
        }
      }
    }
    return list;
  }, [projects, today]);

  // Portfólio inteiro (não só as linhas dos próximos 15 dias) — pra clicar numa linha e abrir o
  // mesmo `TaskPanel` do Cronograma, que precisa enxergar todas as tarefas (predecessoras
  // candidatas, contagem de dependentes) e não só as visíveis nesta lista filtrada.
  const allTasks = useMemo(() => projects.flatMap((p) => p.activities.flatMap((a) => a.tasks)), [projects]);
  const activityIdToProjectId = useMemo(
    () => new Map(projects.flatMap((p) => p.activities.map((a) => [a.id, p.id] as const))),
    [projects],
  );
  const selectedTask = selectedTaskId ? (allTasks.find((t) => t.id === selectedTaskId) ?? null) : null;
  const selectedTaskDependentCount = selectedTask
    ? allTasks.filter((t) => t.dependencies.some((d) => d.predecessorId === selectedTask.id)).length
    : 0;

  // Opções derivadas de `rows` (só quem aparece nos próximos 15 dias) — não a lista de
  // projetos/pessoas do portfólio inteiro, senão a maioria das opções nunca bateria com nada.
  const projectOptions = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.project.id, r.project]));
    return Array.from(byId.values())
      .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'))
      .map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
  }, [rows]);
  const activityOptions = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.activity.id, r.activity]));
    return Array.from(byId.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((a) => ({ value: a.id, label: a.name }));
  }, [rows]);
  const responsavelOptions = useMemo(() => {
    const ids = new Set(rows.map((r) => r.task.responsavelId).filter((id): id is string => Boolean(id)));
    return Array.from(ids)
      .map((id) => people.find((p) => p.id === id))
      .filter((p): p is (typeof people)[number] => Boolean(p))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((p) => ({ value: p.id, label: p.name }));
  }, [rows, people]);

  // Todos os filtros MENOS o de urgência (Atrasadas/A vencer) — base usada pra calcular os dois
  // cards de urgência, senão selecionar um zeraria a contagem do outro (mesmo raciocínio de
  // `filteredExceptStatus` em ProjectsHealthStrip.tsx).
  const filteredExceptUrgency = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(({ project, activity, task }) => {
      if (selectedProjects.length > 0 && !selectedProjects.includes(project.id)) return false;
      if (selectedActivities.length > 0 && !selectedActivities.includes(activity.id)) return false;
      if (selectedResponsaveis.length > 0 && (!task.responsavelId || !selectedResponsaveis.includes(task.responsavelId)))
        return false;
      // "Não iniciada" = deveria ter começado (previsto <= hoje) e não começou — não conta quem
      // ainda não chegou na data de início, esse é só "previsto" (pedido do usuário: "fica
      // apenas o da data de hoje pra trás, o futuro já entra nos previsto"). Mesma flag
      // `isStartDelayed` que o selo do StatusBadge já usa, não um cálculo novo.
      if (onlyNotStarted && !task.isStartDelayed) return false;
      if (!term) return true;
      const responsavel = people.find((p) => p.id === task.responsavelId)?.name ?? '';
      const haystack = `${project.code} ${project.name} ${activity.name} ${task.name} ${responsavel}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search, people, selectedProjects, selectedActivities, selectedResponsaveis, onlyNotStarted]);

  // Filtro final (alimenta a tabela) — aplica o clique no card "Atrasadas"/"A vencer" por cima.
  const filtered = useMemo(() => {
    if (!urgencyFilter) return filteredExceptUrgency;
    return filteredExceptUrgency.filter((r) => (urgencyFilter === 'overdue' ? r.daysLeft < 0 : r.daysLeft >= 0));
  }, [filteredExceptUrgency, urgencyFilter]);

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

  // Reflete os filtros ativos (Projeto/Atividade/Responsável/Não iniciadas/busca) — pedido do
  // usuário: os cards devem mudar junto com o filtro, não continuar mostrando o total geral.
  // Atrasadas/A vencer usam `filteredExceptUrgency` (não `filtered`) pra não se auto-zerarem
  // quando um dos dois está selecionado — ver comentário acima de `filteredExceptUrgency`.
  const summary = useMemo(() => {
    const projectCount = new Set(filtered.map((r) => r.project.id)).size;
    const activityCount = new Set(filtered.map((r) => r.activity.id)).size;
    const overdueCount = filteredExceptUrgency.filter((r) => r.daysLeft < 0).length;
    const upcomingCount = filteredExceptUrgency.length - overdueCount;
    return { total: filtered.length, projectCount, activityCount, overdueCount, upcomingCount };
  }, [filtered, filteredExceptUrgency]);

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

        {(selectedProjects.length > 0 ||
          selectedActivities.length > 0 ||
          selectedResponsaveis.length > 0 ||
          onlyNotStarted ||
          urgencyFilter !== null ||
          search.trim()) && (
          <button
            type="button"
            onClick={() => {
              setSelectedProjects([]);
              setSelectedActivities([]);
              setSelectedResponsaveis([]);
              setOnlyNotStarted(false);
              setUrgencyFilter(null);
              setSearch('');
            }}
            className="text-sm font-semibold text-action hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma tarefa nos próximos 15 dias"
          description={rows.length > 0 ? 'Ajuste a busca para encontrar o que procura.' : 'Nada com prazo previsto vencendo em breve.'}
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[8%]" />
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
                <th className="px-4 py-2.5">Prazo previsto</th>
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
              {sorted.map(({ project, activity, task, kind, daysLeft }) => {
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
                    <td className="overflow-hidden truncate px-4 py-2.5 text-text-muted">
                      {formatDatePtBr(kind === 'start' ? task.plannedStart : task.plannedEnd)}
                      {kind === 'start' && <span className="ml-1 text-[10px] text-text-muted2">(início)</span>}
                    </td>
                    <td className="overflow-hidden px-2 py-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge status={task.status} startDelayed={task.isStartDelayed} />
                        {task.isStartDelayed && (
                          <span className="whitespace-nowrap rounded-full bg-page px-1.5 py-0.5 text-[10px] font-semibold text-text-muted2">
                            não iniciada
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`overflow-hidden px-2 py-2.5 text-right font-mono text-xs font-semibold ${
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

      <TaskPanel
        task={selectedTask}
        isMobile={isMobile}
        allTasks={allTasks}
        categories={categories}
        people={people}
        replanejamentos={replanejamentos}
        isAdmin={isAdmin}
        holidays={holidays}
        unit={projects.find((p) => p.id === activityIdToProjectId.get(selectedTask?.activityId ?? ''))?.unit ?? ''}
        onCreatePerson={createPerson}
        onClose={() => setSelectedTaskId(null)}
        onSave={(taskId, patch) => {
          const owningProjectId = activityIdToProjectId.get(allTasks.find((t) => t.id === taskId)?.activityId ?? '');
          if (!owningProjectId) return;
          updateTask(owningProjectId, taskId, patch);
        }}
        onSaveActual={(taskId, patch) => {
          const owningProjectId = activityIdToProjectId.get(allTasks.find((t) => t.id === taskId)?.activityId ?? '');
          if (!owningProjectId) return;
          updateTaskActualDates(owningProjectId, taskId, patch);
        }}
        onSetPredecessors={(taskId, entries) => {
          const owningProjectId = activityIdToProjectId.get(allTasks.find((t) => t.id === taskId)?.activityId ?? '');
          if (!owningProjectId) return { valid: false, errors: ['Projeto não encontrado.'] };
          return setTaskPredecessors(owningProjectId, taskId, entries);
        }}
        onReplan={(taskId, patch, motivo) => {
          const owningProjectId = activityIdToProjectId.get(allTasks.find((t) => t.id === taskId)?.activityId ?? '');
          if (!owningProjectId) return { valid: false, errors: ['Projeto não encontrado.'] };
          return replanTask(owningProjectId, taskId, patch, motivo, isAdmin === true);
        }}
        dependentCount={selectedTaskDependentCount}
        onDelete={(taskId) => {
          const task = allTasks.find((t) => t.id === taskId);
          if (task) setDeletingTask(task);
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingTask)}
        title="Excluir tarefa"
        message={deletingTask ? `Tem certeza que deseja excluir "${deletingTask.name}"?` : ''}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeletingTask(null)}
        onConfirm={() => {
          const owningProjectId = deletingTask ? activityIdToProjectId.get(deletingTask.activityId) : undefined;
          if (deletingTask && owningProjectId) removeTask(owningProjectId, deletingTask.id);
          setDeletingTask(null);
          setSelectedTaskId(null);
        }}
      />
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
