import { useMemo, useState } from 'react';
import type { ActivityView, ProjectStatus, ProjectView, TaskView } from '../types';
import { diffDays } from '../utils';
import { useAuth } from './useAuth';
import { useCategories } from './useCategories';
import { useHolidays } from './useHolidays';
import { usePeople } from './usePeople';
import { usePerfil } from './usePerfil';
import { useProjects } from './useProjects';

const WINDOW_DAYS = 15;

// Ordem por urgência (não alfabética) — mesmo raciocínio de outras listas de status do app.
export const STATUS_RANK: Record<ProjectStatus, number> = { delayed: 0, in_progress: 1, planned: 2, completed: 3 };

export interface UpcomingRow {
  project: ProjectView;
  activity: ActivityView;
  task: TaskView;
  /** `end`: prazo (fim previsto) dentro da janela — `daysLeft` conta até o fim. `start`: ainda
   * não começou e o INÍCIO previsto é que está dentro da janela (fim previsto fica pra depois,
   * senão já teria caído no caso `end`) — `daysLeft` aqui conta até o início. */
  kind: 'end' | 'start';
  daysLeft: number;
}

/**
 * "Tarefas dos próximos 15 dias" — lógica de dados compartilhada entre a versão desktop
 * (`UpcomingTasksPage.tsx`, tabela com ordenação por coluna) e a mobile (`MobileUpcomingTasksPage.tsx`,
 * cards com ordenação fixa por urgência) — sem isso as duas telas divergiriam em silêncio a cada
 * ajuste de filtro/restrição (mesmo raciocínio de reuso já aplicado a `computeWorkload` na Fase 6).
 * Uma linha por tarefa (não atividade/projeto), ainda não concluída. Dois jeitos de entrar na
 * lista: fim previsto dentro da janela (inclui atrasadas, `daysLeft < 0`), OU início previsto
 * dentro da janela pra quem ainda não começou (tarefa longa, cujo fim só cai muito depois dos 15
 * dias, mas que precisa aparecer porque está pra começar).
 */
export function useUpcomingTasksData() {
  const { projects, today, replanejamentos, updateTask, updateTaskActualDates, confirmTaskCompletion, replanTask, setTaskPredecessors, removeTask } =
    useProjects();
  const { people, createPerson } = usePeople();
  const { categories } = useCategories();
  const { holidays } = useHolidays();
  const { session } = useAuth();
  const isAdmin = usePerfil();
  // Usuário comum vê só as tarefas em que é o responsável (pedido do usuário) — administrador
  // continua vendo tudo. `isAdmin !== true` cobre `false` E `undefined` (papel ainda carregando),
  // pra não vazar as tarefas de todo mundo por um instante antes do papel resolver.
  const myPerson = people.find((p) => p.userId === session?.user.id);
  const restrictToMine = isAdmin !== true;

  const [search, setSearch] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedResponsaveis, setSelectedResponsaveis] = useState<string[]>([]);
  const [onlyNotStarted, setOnlyNotStarted] = useState(false);
  // Clique no card "Atrasadas"/"A vencer" filtra a lista pra só aquele grupo — clicar de novo no
  // mesmo card desliga. Só um ativo por vez (é a mesma dimensão, atrasada x a vencer).
  const [urgencyFilter, setUrgencyFilter] = useState<'overdue' | 'upcoming' | null>(null);

  const rows = useMemo(() => {
    const list: UpcomingRow[] = [];
    for (const project of projects) {
      for (const activity of project.activities) {
        for (const task of activity.tasks) {
          if (task.status === 'completed') continue;
          if (restrictToMine && (!myPerson || task.responsavelId !== myPerson.id)) continue;

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
  }, [projects, today, restrictToMine, myPerson]);

  // Portfólio inteiro (não só as linhas dos próximos 15 dias) — pra clicar numa linha e abrir o
  // mesmo `TaskPanel` do Cronograma, que precisa enxergar todas as tarefas (predecessoras
  // candidatas, contagem de dependentes) e não só as visíveis nesta lista filtrada.
  const allTasks = useMemo(() => projects.flatMap((p) => p.activities.flatMap((a) => a.tasks)), [projects]);
  const activityIdToProjectId = useMemo(
    () => new Map(projects.flatMap((p) => p.activities.map((a) => [a.id, p.id] as const))),
    [projects],
  );

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
      // ainda não chegou na data de início, esse é só "previsto". Mesma flag `isStartDelayed`
      // que o selo do StatusBadge já usa, não um cálculo novo.
      if (onlyNotStarted && !task.isStartDelayed) return false;
      if (!term) return true;
      const responsavel = people.find((p) => p.id === task.responsavelId)?.name ?? '';
      const haystack = `${project.code} ${project.name} ${activity.name} ${task.name} ${responsavel}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search, people, selectedProjects, selectedActivities, selectedResponsaveis, onlyNotStarted]);

  // Filtro final — aplica o clique no card "Atrasadas"/"A vencer" por cima.
  const filtered = useMemo(() => {
    if (!urgencyFilter) return filteredExceptUrgency;
    return filteredExceptUrgency.filter((r) => (urgencyFilter === 'overdue' ? r.daysLeft < 0 : r.daysLeft >= 0));
  }, [filteredExceptUrgency, urgencyFilter]);

  // Reflete os filtros ativos (Projeto/Atividade/Responsável/Não iniciadas/busca). Atrasadas/A
  // vencer usam `filteredExceptUrgency` (não `filtered`) pra não se auto-zerarem quando um dos
  // dois está selecionado — ver comentário acima de `filteredExceptUrgency`.
  const summary = useMemo(() => {
    const projectCount = new Set(filtered.map((r) => r.project.id)).size;
    const activityCount = new Set(filtered.map((r) => r.activity.id)).size;
    const overdueCount = filteredExceptUrgency.filter((r) => r.daysLeft < 0).length;
    const upcomingCount = filteredExceptUrgency.length - overdueCount;
    return { total: filtered.length, projectCount, activityCount, overdueCount, upcomingCount };
  }, [filtered, filteredExceptUrgency]);

  const hasActiveFilters =
    selectedProjects.length > 0 ||
    selectedActivities.length > 0 ||
    selectedResponsaveis.length > 0 ||
    onlyNotStarted ||
    urgencyFilter !== null ||
    search.trim() !== '';

  function clearFilters() {
    setSelectedProjects([]);
    setSelectedActivities([]);
    setSelectedResponsaveis([]);
    setOnlyNotStarted(false);
    setUrgencyFilter(null);
    setSearch('');
  }

  return {
    projects,
    today,
    replanejamentos,
    people,
    createPerson,
    categories,
    holidays,
    isAdmin,
    myPerson,
    restrictToMine,
    rows,
    allTasks,
    activityIdToProjectId,
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
    filteredExceptUrgency,
    filtered,
    summary,
    hasActiveFilters,
    clearFilters,
    updateTask,
    updateTaskActualDates,
    confirmTaskCompletion,
    replanTask,
    setTaskPredecessors,
    removeTask,
  };
}
