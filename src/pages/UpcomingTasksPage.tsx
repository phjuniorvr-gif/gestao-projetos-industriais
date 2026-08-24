import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, FolderKanban, ListChecks, ListTree, Search } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Card, EmptyState, Input, MultiSelectFilter } from '../components/ui';
import { usePeople, useProjects } from '../hooks';
import { diffDays, formatDatePtBr } from '../utils';
import { STATUS_COLOR } from '../types';
import type { ActivityView, ProjectView, TaskView } from '../types';

const WINDOW_DAYS = 15;

interface UpcomingRow {
  project: ProjectView;
  activity: ActivityView;
  task: TaskView;
  daysLeft: number;
}

/** "Tarefas dos próximos 15 dias" — uma linha por tarefa (não atividade/projeto), com prazo
 * previsto dentro da janela e ainda não concluída. Inclui atrasadas (`daysLeft < 0`) — quem tem
 * prazo vencido dentro da janela recente também precisa aparecer aqui, não só o que ainda não
 * venceu; ordenado do mais urgente pro menos urgente. */
export function UpcomingTasksPage() {
  const { projects, today } = useProjects();
  const { people } = usePeople();
  const [search, setSearch] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedResponsaveis, setSelectedResponsaveis] = useState<string[]>([]);

  const rows = useMemo(() => {
    const list: UpcomingRow[] = [];
    for (const project of projects) {
      for (const activity of project.activities) {
        for (const task of activity.tasks) {
          if (task.status === 'completed') continue;
          if (!task.plannedEnd) continue;
          const daysLeft = diffDays(today, task.plannedEnd);
          if (daysLeft > WINDOW_DAYS) continue;
          list.push({ project, activity, task, daysLeft });
        }
      }
    }
    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [projects, today]);

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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(({ project, activity, task }) => {
      if (selectedProjects.length > 0 && !selectedProjects.includes(project.id)) return false;
      if (selectedActivities.length > 0 && !selectedActivities.includes(activity.id)) return false;
      if (selectedResponsaveis.length > 0 && (!task.responsavelId || !selectedResponsaveis.includes(task.responsavelId)))
        return false;
      if (!term) return true;
      const responsavel = people.find((p) => p.id === task.responsavelId)?.name ?? '';
      const haystack = `${project.code} ${project.name} ${activity.name} ${task.name} ${responsavel}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search, people, selectedProjects, selectedActivities, selectedResponsaveis]);

  const summary = useMemo(() => {
    const projectCount = new Set(rows.map((r) => r.project.id)).size;
    const activityCount = new Set(rows.map((r) => r.activity.id)).size;
    const overdueCount = rows.filter((r) => r.daysLeft < 0).length;
    const upcomingCount = rows.length - overdueCount;
    return { total: rows.length, projectCount, activityCount, overdueCount, upcomingCount };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="Tarefas dos próximos 15 dias" subtitle="Tarefas com prazo previsto vencendo em breve (ou já vencido), ainda não concluídas" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Total de Tarefas" value={summary.total} icon={ListChecks} color="#0F172A" />
        <SummaryCard label="Projetos Envolvidos" value={summary.projectCount} icon={FolderKanban} color="#2563EB" />
        <SummaryCard label="Atividades Envolvidas" value={summary.activityCount} icon={ListTree} color="#7C3AED" />
        <SummaryCard label="Atrasadas" value={summary.overdueCount} icon={AlertTriangle} color={STATUS_COLOR.delayed} />
        <SummaryCard label="A vencer" value={summary.upcomingCount} icon={CalendarClock} color={STATUS_COLOR.in_progress} />
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

        {(selectedProjects.length > 0 || selectedActivities.length > 0 || selectedResponsaveis.length > 0 || search.trim()) && (
          <button
            type="button"
            onClick={() => {
              setSelectedProjects([]);
              setSelectedActivities([]);
              setSelectedResponsaveis([]);
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
                <th className="px-4 py-2.5">Projeto</th>
                <th className="px-4 py-2.5">Atividade</th>
                <th className="px-4 py-2.5">Tarefa</th>
                <th className="px-4 py-2.5">Responsável</th>
                <th className="px-4 py-2.5">Prazo previsto</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ project, activity, task, daysLeft }) => {
                const responsavel = people.find((p) => p.id === task.responsavelId);
                return (
                  <tr key={task.id} className="border-b border-border last:border-0 hover:bg-page/40">
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
                    <td className="overflow-hidden truncate px-4 py-2.5 text-text-muted">{formatDatePtBr(task.plannedEnd)}</td>
                    <td className="overflow-hidden px-2 py-2.5">
                      <StatusBadge status={task.status} startDelayed={task.isStartDelayed} />
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
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof ListChecks;
  color: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: color }}>
        {label}
      </div>
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-2xl font-bold text-text">{value}</span>
        <Icon className="h-6 w-6" style={{ color }} />
      </div>
    </Card>
  );
}
