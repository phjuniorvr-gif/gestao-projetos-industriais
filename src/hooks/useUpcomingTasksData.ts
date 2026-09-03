import { useMemo, useState } from 'react';
import type { ActivityView, ProjectStatus, ProjectView, TaskView } from '../types';
import { diffDays } from '../utils';
import { useAuth } from './useAuth';
import { useCategories } from './useCategories';
import { useHolidays } from './useHolidays';
import { usePapel } from './usePapel';
import { usePeople } from './usePeople';
import { useProjects } from './useProjects';

/** Opções do seletor de período (a pedido do usuário — antes era fixo em 15 dias, ficando
 * poluído com muita tarefa distante). Atrasadas (`daysLeft < 0`) e "hoje" (`daysLeft === 0`)
 * sempre aparecem pra qualquer opção, porque `daysLeft <= windowDays` já cobre os dois casos
 * (negativo e zero) sem precisar de exceção separada. `0` = "Hoje" (só atrasadas + hoje, nenhuma
 * futura) — pedido seguinte do usuário, mesma regra de `<=`, sem caso especial no cálculo. */
export const WINDOW_DAY_OPTIONS = [0, 7, 15, 30, 60] as const;
// Abre sempre em "Hoje" (a pedido do usuário) — o período mais amplo fica um clique de distância,
// mas a tela não começa poluída com tarefa distante.
const DEFAULT_WINDOW_DAYS = 0;

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
 * "Tarefas por vencer" — lógica de dados compartilhada entre a versão desktop
 * (`UpcomingTasksPage.tsx`, tabela com ordenação por coluna) e a mobile (`MobileUpcomingTasksPage.tsx`,
 * cards com ordenação fixa por urgência) — sem isso as duas telas divergiriam em silêncio a cada
 * ajuste de filtro/restrição (mesmo raciocínio de reuso já aplicado a `computeWorkload` na Fase 6).
 * Uma linha por tarefa (não atividade/projeto), ainda não concluída. Dois jeitos de entrar na
 * lista: fim previsto dentro da janela (inclui atrasadas, `daysLeft < 0`), OU início previsto
 * dentro da janela pra quem ainda não começou (tarefa longa, cujo fim só cai muito depois da
 * janela, mas que precisa aparecer porque está pra começar). Janela em dias é escolhida pelo
 * usuário (`windowDays`/`WINDOW_DAY_OPTIONS`, a pedido do usuário — antes fixa em 15 dias);
 * atrasadas e "hoje" sempre aparecem em qualquer janela, de graça, porque `daysLeft <= windowDays`
 * já é verdadeiro pra qualquer valor negativo ou zero.
 */
export function useUpcomingTasksData() {
  const {
    projects,
    today,
    replanejamentos,
    updateTask,
    updateTaskActualDates,
    confirmTaskCompletion,
    rejectTaskCompletion,
    replanTask,
    setTaskPredecessors,
    removeTask,
  } = useProjects();
  const { people, createPerson } = usePeople();
  const { categories } = useCategories();
  const { holidays } = useHolidays();
  const { session } = useAuth();
  const papel = usePapel();
  // Mesmo cálculo de `usePerfil()`, derivado do mesmo `papel` já buscado aqui — evita chamar os
  // dois hooks (duas buscas independentes) só pra chegar no mesmo boolean. Tri-state preservado
  // (`undefined` enquanto carrega, nunca vira `false` prematuro) pelo mesmo motivo de sempre.
  const isAdmin = papel === undefined ? undefined : papel === 'administrador';
  // Só administrador vê o portfólio inteiro nesta tela — 'usuario' E 'visualizador' (pedido do
  // usuário, revertendo o `canViewAll` que valia aqui até então) veem só as próprias tarefas.
  // `papel !== 'administrador'` cobre os dois papéis E `undefined` (papel ainda carregando), pra
  // não vazar as tarefas de todo mundo por um instante antes do papel resolver. `canViewAll`
  // continua governando NAVEGAÇÃO (Sidebar/MobileTabBar/RequireAccess) — só essa tela ficou mais
  // restrita que a navegação, por pedido explícito.
  const myPerson = people.find((p) => p.userId === session?.user.id);
  const restrictToMine = papel !== 'administrador';

  const [windowDays, setWindowDays] = useState<number>(DEFAULT_WINDOW_DAYS);
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
            if (daysToEnd <= windowDays) {
              list.push({ project, activity, task, kind: 'end', daysLeft: daysToEnd });
              continue;
            }
          }

          if (!task.actualStart && task.plannedStart) {
            const daysToStart = diffDays(today, task.plannedStart);
            if (daysToStart <= windowDays) {
              list.push({ project, activity, task, kind: 'start', daysLeft: daysToStart });
            }
          }
        }
      }
    }
    return list;
  }, [projects, today, restrictToMine, myPerson, windowDays]);

  // Portfólio inteiro (não só as linhas dentro da janela) — pra clicar numa linha e abrir o
  // mesmo `TaskPanel` do Cronograma, que precisa enxergar todas as tarefas (predecessoras
  // candidatas, contagem de dependentes) e não só as visíveis nesta lista filtrada.
  const allTasks = useMemo(() => projects.flatMap((p) => p.activities.flatMap((a) => a.tasks)), [projects]);
  const activityIdToProjectId = useMemo(
    () => new Map(projects.flatMap((p) => p.activities.map((a) => [a.id, p.id] as const))),
    [projects],
  );

  // Opções derivadas de `rows` (só quem aparece dentro da janela selecionada) — não a lista de
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
    windowDays,
    setWindowDays,
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
    rejectTaskCompletion,
    replanTask,
    setTaskPredecessors,
    removeTask,
  };
}
