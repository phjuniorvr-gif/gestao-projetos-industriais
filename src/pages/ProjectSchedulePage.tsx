import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpDown, CalendarClock, ChevronsDownUp, ChevronsUpDown, GanttChart, ListPlus, Pencil, Table2 } from 'lucide-react';
import { Button, Card, ConfirmDialog, EmptyState, Skeleton, UndoToast } from '../components/ui';
import {
  AddActivityDialog,
  AddTaskPanel,
  calculatePortfolioRange,
  GanttTable,
  getGanttColumns,
  getGanttLeftWidth,
  MobileScheduleList,
  offsetPx,
  RejectTaskDialog,
  ScheduleLegend,
  TaskPanel,
  ZOOM_PX_PER_DAY,
  type GanttZoom,
} from '../components/gantt';
import {
  EMPTY_FILTERS,
  FilterSelect,
  ProjectFilters,
  ProjectsHealthStrip,
  type ProjectFiltersState,
} from '../components/projects';
import type { MobileOutletContext } from '../components/layout';
import { useCatalog, useCategories, useHolidays, useIsMobile, usePeople, usePerfil, useProjects, useUndoToast } from '../hooks';
import { STATUS_LABEL, type ActivityView, type ProjectStatus, type ProjectView, type TaskView } from '../types';
import { computeProjectStatus, rollUpDates, rollUpStatus, sortProjectsByCriticality, todayISO } from '../utils';

const ZOOM_OPTIONS: { value: GanttZoom; label: string }[] = [
  { value: 'dia', label: 'Dia' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
];

// Aba Importação (pedido do usuário) — os 4 cards de status contam TAREFA (ver
// `importacaoTasksExceptStatus`), então o rótulo precisa dizer "Tarefa", não só "Concluído"/
// "Planejado" (concordância de gênero com "tarefa" também difere de `STATUS_LABEL`, pensado
// originalmente pra "projeto"/"atividade" no masculino).
const IMPORTACAO_TASK_STATUS_LABELS: Partial<Record<ProjectStatus, string>> = {
  completed: 'Tarefa Concluída',
  in_progress: 'Tarefa Em Andamento',
  delayed: 'Tarefa Atrasada',
  planned: 'Tarefa Planejada',
};

export function ProjectSchedulePage() {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Rota /importacao (pedido do usuário) — mesma tela de Cronograma, travada na categoria
  // "Importação". Detectado por pathname (não por prop nova) porque este componente já serve 3
  // formatos de rota diferentes (/cronograma, /projetos/:id/cronograma) do mesmo jeito.
  const isImportacaoView = location.pathname === '/importacao';
  // Drill-down da aba Equipe (mobile): "Ver atividades" a partir de uma pessoa já filtrada manda
  // pra cá com ?responsavel=<id> — restringe a árvore a só as tarefas dela, mesmo raciocínio de
  // categoryFilter (recomputa rollup, dropa quem ficou sem tarefa).
  const responsavelFilterId = searchParams.get('responsavel');
  const {
    projects,
    today,
    loaded,
    replanejamentos,
    addTask,
    updateTask,
    updateActivityName,
    updateActivityProcesso,
    updateTaskActualDates,
    updateTaskObservacao,
    confirmTaskCompletion,
    rejectTaskCompletion,
    replanTask,
    removeTask,
    setTaskPredecessors,
    addActivity,
    addActivityWithTasks,
    removeActivity,
    removeActivityWithTasks,
    restoreActivityWithTasks,
  } = useProjects();
  const isAdmin = usePerfil();
  // A rota /projetos/:id/cronograma é pra onde o bottom sheet mobile ("Ver atividades") manda —
  // continua sendo a tela desktop mesmo (decisão da Fase 6), mas os controles pensados pra tela
  // larga (zoom, "Novo item", "Editar"...) só atrapalham lá; simplifica em vez de reconstruir.
  const isMobile = useIsMobile();
  const { categories, loaded: categoriesLoaded } = useCategories();
  const importacaoCategoryId = useMemo(() => categories.find((c) => c.label === 'Importação')?.id, [categories]);
  const { catalog } = useCatalog();
  const { people, createPerson } = usePeople();
  const { holidays } = useHolidays();
  const { toast, show, dismiss } = useUndoToast();
  const [filters, setFilters] = useState<ProjectFiltersState>(EMPTY_FILTERS);
  // Importação mobile (pedido do usuário) — "Ano" mora no cabeçalho da página (`MobileLayout.tsx`,
  // mesmo mecanismo já usado por Projetos/Cronograma), não em `filters.year`. `AppLayout.tsx`
  // (desktop) não fornece esse contexto — `undefined` ali é normal, não erro.
  const outletContext = useOutletContext<MobileOutletContext | undefined>();
  const effectiveYear = isMobile && isImportacaoView ? (outletContext?.year ?? '') : filters.year;
  // Aba Importação (pedido do usuário) — "Unidade" sai, "Projeto" entra no lugar: um comprador
  // triando pendências de vários projetos quer poder isolar um projeto específico, e "Unidade"
  // (site/fábrica) não é tão útil pra esse recorte quanto pra Projetos/Cronograma normal.
  const [importacaoProjectFilter, setImportacaoProjectFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  // Filtro de categoria "de verdade" usado pelo resto da tela — na aba Importação é sempre a
  // categoria travada (nunca o que estiver em `categoryFilter`, que fica sem uso nessa rota).
  const effectiveCategoryFilter = isImportacaoView ? importacaoCategoryId : categoryFilter;
  // Concluída fica visível por padrão (comportamento de sempre) — o botão só liga/desliga a
  // exibição, mesmo raciocínio de categoryFilter/responsavelFilterId (dropa atividade/projeto que
  // ficou sem nenhuma tarefa depois do filtro).
  const [hideCompleted, setHideCompleted] = useState(false);

  const projectsToShow = useMemo(
    () => (id ? projects.filter((p) => p.id === id) : projects),
    [projects, id],
  );

  const units = useMemo(() => Array.from(new Set(projects.map((p) => p.unit).filter(Boolean))).sort(), [projects]);
  const years = useMemo(
    () =>
      Array.from(new Set(projects.map((p) => p.plannedStart?.slice(0, 4)).filter((y): y is string => Boolean(y)))).sort(),
    [projects],
  );
  // Opções do "Projeto" da Importação — só os que TÊM alguma tarefa de importação (independente
  // de responsável/esconder concluídas/status, que só afetam o que aparece DEPOIS de escolher um
  // projeto), mesmo raciocínio de `units`/`years` (lista estável, calculada do portfólio inteiro).
  const importacaoProjectOptions = useMemo(() => {
    if (!importacaoCategoryId) return [];
    return projectsToShow
      .filter((p) => p.activities.some((a) => a.tasks.some((t) => t.category === importacaoCategoryId)))
      .map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
  }, [projectsToShow, importacaoCategoryId]);

  // Sem o filtro de status — base que os cards de saúde usam pra contar por status (senão,
  // selecionar "Atrasado" zeraria os outros cards em vez de só destacar/filtrar a lista).
  const visibleProjectsExceptStatus = useMemo(
    () =>
      id
        ? projectsToShow
        : projectsToShow.filter((p) => {
            if (filters.unit && p.unit !== filters.unit) return false;
            if (effectiveYear && p.plannedStart?.slice(0, 4) !== effectiveYear) return false;
            return true;
          }),
    [projectsToShow, filters.unit, effectiveYear, id],
  );

  const visibleProjects = useMemo(
    () =>
      filters.status.length === 0
        ? visibleProjectsExceptStatus
        : visibleProjectsExceptStatus.filter((p) => filters.status.includes(STATUS_LABEL[p.status])),
    [visibleProjectsExceptStatus, filters.status],
  );

  const activeStatuses = useMemo(
    () => (Object.keys(STATUS_LABEL) as ProjectStatus[]).filter((s) => filters.status.includes(STATUS_LABEL[s])),
    [filters.status],
  );
  const toggleStatus = (status: ProjectStatus, multi: boolean) => {
    const label = STATUS_LABEL[status];
    setFilters((f) => {
      if (multi) {
        const has = f.status.includes(label);
        return { ...f, status: has ? f.status.filter((s) => s !== label) : [...f.status, label] };
      }
      const isOnlySelected = f.status.length === 1 && f.status[0] === label;
      return { ...f, status: isOnlySelected ? [] : [label] };
    });
  };

  // Aba Importação — base pros 4 cards de status da faixa de saúde (sem filtro de status, mesmo
  // cuidado de `visibleProjectsExceptStatus` acima), de TAREFA, não de atividade nem de projeto —
  // pedido do usuário: "Total de Atividades" continua contando atividade, mas Concluído/Em
  // andamento/Atrasado/Planejado devem contar as tarefas em si (o que o comprador realmente
  // preenche uma a uma). Mesmo filtro de categoria/responsável/esconder concluídas de
  // `filteredGanttProjects`, só que achatado até o nível de tarefa e a partir de
  // `visibleProjectsExceptStatus` (pré-filtro de status).
  const importacaoTasksExceptStatus = useMemo(() => {
    if (!isImportacaoView || !importacaoCategoryId) return [];
    return visibleProjectsExceptStatus
      .filter((p) => !importacaoProjectFilter || p.id === importacaoProjectFilter)
      .flatMap((p) =>
        p.activities.flatMap((a) =>
          a.tasks.filter(
            (t) =>
              t.category === importacaoCategoryId &&
              (!responsavelFilterId || t.responsavelId === responsavelFilterId) &&
              (!hideCompleted || t.status !== 'completed'),
          ),
        ),
      );
  }, [
    isImportacaoView,
    importacaoCategoryId,
    visibleProjectsExceptStatus,
    responsavelFilterId,
    hideCompleted,
    importacaoProjectFilter,
  ]);

  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(new Set());
  const [collapsedActivityIds, setCollapsedActivityIds] = useState<Set<string>>(new Set());
  // Botão "Expandir/Recolher tudo" — ciclo de 3 níveis (pedido do usuário), não mais um toggle
  // binário: 'project' (só projeto, tudo recolhido) → 'activity' (mostra atividade, tarefa
  // continua escondida) → 'task' (mostra tudo) → volta pra 'project'.
  const [expandLevel, setExpandLevel] = useState<'project' | 'activity' | 'task'>('project');
  // Aba Importação (pedido do usuário) — sem nível Projeto, então o ciclo de 3 níveis não se
  // aplica; toggle de 2 estados só entre Atividade (tarefa escondida) e Tarefa (tudo aberto).
  // Começa `false` (recolhido em Atividade, pedido do usuário) — combina com `collapsedOnLoadRef`
  // recolhendo as atividades ao carregar essa rota.
  const [importacaoExpanded, setImportacaoExpanded] = useState(false);
  // Aba Importação (pedido do usuário) — ordena ATIVIDADE (não projeto/código, que é o que
  // `nameSort` faz no Cronograma normal): "criticidade" (padrão, mesma regra de
  // `sortProjectsByCriticality`) ou "Processo" A→Z/Z→A. Ciclo de 3 estados via `cycleImportacaoSort`.
  const [importacaoSort, setImportacaoSort] = useState<'criticidade' | 'processoAsc' | 'processoDesc'>('criticidade');
  // Começa em modo Tabela (sem Gantt) — pedido do usuário.
  const [compact, setCompact] = useState(false);
  // Aba Importação (pedido do usuário) sempre em modo Tabela, sem alternar — o toggle Tabela⇄Gantt
  // nem aparece nessa rota. `effectiveCompact` (não `compact` bruto) é o que alimenta GanttTable/
  // getGanttColumns/gates de zoom daqui pra baixo.
  const effectiveCompact = isImportacaoView ? false : compact;
  // Ordena por código (P01→P99), não pelo cabeçalho "Estrutura" (que é a árvore inteira, não uma
  // coluna "Projeto" isolada como em ProjectsTable.tsx) — botão explícito. Só 2 estados (sem
  // "padrão" no meio, a pedido do usuário), já começa em decrescente (P99 → P01).
  const [nameSort, setNameSort] = useState<'asc' | 'desc'>('desc');
  const [editMode, setEditMode] = useState(false);
  const [newItemMenuOpen, setNewItemMenuOpen] = useState(false);
  const [zoom, setZoom] = useState<GanttZoom>('semana');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedTask, setSelectedTask] = useState<TaskView | null>(null);
  // { open: false } fecha o painel. initialProjectId/initialActivityId vêm preenchidos quando
  // aberto pelo "+" de uma linha específica (pula o seletor); ausentes quando aberto pelo "＋ Novo
  // item" do topo da página (Fase 4, Commit 6) — cobre o caso da linha-alvo não estar visível.
  const [activityDialog, setActivityDialog] = useState<{ open: boolean; initialProjectId?: string }>({ open: false });
  const [taskPanelState, setTaskPanelState] = useState<{ open: boolean; initialActivityId?: string }>({ open: false });
  const [deletingActivity, setDeletingActivity] = useState<ActivityView | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskView | null>(null);
  const [rejectingTaskId, setRejectingTaskId] = useState<string | null>(null);

  const filteredGanttProjects = useMemo(() => {
    // `effectiveCategoryFilter` (não `categoryFilter` bruto) — na aba Importação é sempre a
    // categoria travada. Calculado FORA de um `useEffect`+`setCategoryFilter` de propósito: um
    // efeito corre um render depois do estado mudar, e nesse intervalo (entre a categoria carregar
    // e o efeito rodar) a tela mostraria o portfólio inteiro sem filtro por um frame — um comprador
    // veria projeto que não devia, mesmo que por instante. Sendo derivado direto no render, esse
    // frame nunca existe.
    if (isImportacaoView && !importacaoCategoryId) return [];
    // Aba Importação filtra por status de TAREFA (bate com o que os cards de resumo contam agora
    // — Concluído/Em andamento/Atrasado/Planejado contam tarefa, não atividade), não por status de
    // PROJETO nem de ATIVIDADE — por isso parte de `visibleProjectsExceptStatus` (sem o filtro de
    // projeto já aplicado por `filters.status`) em vez de `visibleProjects` nessa rota. Entra
    // direto no MESMO `tasks.filter` de categoria/responsável/esconder-concluídas — não um corte
    // por fora na atividade inteira (isso deixava tarefa "em andamento"/"planejado" visível junto
    // com a "atrasada" dentro de uma atividade que só ficava no filtro por ter UMA tarefa
    // combinando; pedido do usuário: clicar "Atrasado" deve mostrar só a tarefa atrasada mesmo).
    const source = isImportacaoView ? visibleProjectsExceptStatus : visibleProjects;
    if (!effectiveCategoryFilter && !responsavelFilterId && !hideCompleted && !(isImportacaoView && activeStatuses.length > 0))
      return source;
    return source
      .map((p): ProjectView | null => {
        if (isImportacaoView && importacaoProjectFilter && p.id !== importacaoProjectFilter) return null;
        const activities = p.activities
          .map((a): ActivityView | null => {
            const tasks = a.tasks.filter(
              (t) =>
                (!effectiveCategoryFilter || t.category === effectiveCategoryFilter) &&
                (!responsavelFilterId || t.responsavelId === responsavelFilterId) &&
                (!hideCompleted || t.status !== 'completed') &&
                (!isImportacaoView || activeStatuses.length === 0 || activeStatuses.includes(t.status)),
            );
            if (tasks.length === 0) return null;
            return { ...a, tasks, ...rollUpDates(tasks), status: rollUpStatus(tasks) };
          })
          .filter((a): a is ActivityView => a !== null);
        if (activities.length === 0) return null;
        const projectDates = rollUpDates(activities);
        return { ...p, activities, ...projectDates, status: computeProjectStatus(activities, projectDates.plannedEnd, today) };
      })
      .filter((p): p is ProjectView => p !== null);
  }, [
    visibleProjects,
    visibleProjectsExceptStatus,
    effectiveCategoryFilter,
    responsavelFilterId,
    hideCompleted,
    today,
    isImportacaoView,
    importacaoCategoryId,
    activeStatuses,
    importacaoProjectFilter,
  ]);

  const ganttProjects = useMemo(() => {
    const codeNumber = (code: string) => parseInt(code.match(/\d+/)?.[0] ?? '0', 10);
    const ranked = [...filteredGanttProjects].sort((a, b) => codeNumber(a.code) - codeNumber(b.code));
    return nameSort === 'desc' ? ranked.reverse() : ranked;
  }, [filteredGanttProjects, nameSort]);

  // Aba Importação — ordena ATIVIDADE, não projeto (pedido do usuário: um comprador triando
  // pendências quer a mais crítica primeiro, atravessando projeto diferente, não agrupada por
  // código). Achata `ganttProjects` (agrupado por projeto) em pares atividade+projeto-dono,
  // ordena, e reagrupa numa entrada de 1 atividade por "projeto" sintético — preserva o `id` REAL
  // do projeto em cada entrada (só o array `activities` muda), então `activityIdToProjectId`/toda
  // gravação (Processo, Observação, renomear) continuam resolvendo o projeto certo sem mudança
  // nenhuma. Usada só como `projects` da `<GanttTable>` — `ganttProjects` (agrupado normal)
  // continua alimentando o resto (seletor de projeto do "Novo item", `allTasks`, etc).
  const importacaoDisplayProjects = useMemo(() => {
    if (!isImportacaoView) return ganttProjects;
    const pairs = ganttProjects.flatMap((p) => p.activities.map((a) => ({ project: p, activity: a })));
    const projectByActivityId = new Map(pairs.map((pair) => [pair.activity.id, pair.project]));
    let orderedActivities: ActivityView[];
    if (importacaoSort === 'processoAsc' || importacaoSort === 'processoDesc') {
      orderedActivities = [...pairs]
        .map((pair) => pair.activity)
        .sort((a, b) => (a.processo ?? '').localeCompare(b.processo ?? '', 'pt-BR', { sensitivity: 'base' }));
      if (importacaoSort === 'processoDesc') orderedActivities.reverse();
    } else {
      const withUnit = pairs.map(({ project, activity }) => ({ ...activity, unit: project.unit }));
      orderedActivities = sortProjectsByCriticality(withUnit, today, holidays);
    }
    return orderedActivities.map((activity) => ({
      ...projectByActivityId.get(activity.id)!,
      activities: [activity],
    }));
  }, [isImportacaoView, ganttProjects, importacaoSort, today, holidays]);

  const allTasks = useMemo(() => ganttProjects.flatMap((p) => p.activities.flatMap((a) => a.tasks)), [ganttProjects]);

  // Fase 7 (Parte A) — portfólio inteiro, SEM o filtro de rota que `allTasks` carrega (essa
  // página também renderiza um projeto só, via /projetos/:id/cronograma). A contagem de
  // dependentes de uma tarefa (pra bloquear exclusão) precisa enxergar tarefas de qualquer
  // projeto, não só do que está sendo exibido agora — subcontaria se alguma dependência
  // apontasse de fora do projeto aberto (medido em 2026-08-13: 0 hoje, mas nada no código impede
  // de passar a existir, já que computeCandidatePredecessors recebe o mesmo `allTasks` sem
  // filtrar por projeto quando a rota é /cronograma inteiro).
  const allPortfolioTasks = useMemo(() => projects.flatMap((p) => p.activities.flatMap((a) => a.tasks)), [projects]);

  const activityIdToProjectId = useMemo(
    () => new Map(ganttProjects.flatMap((p) => p.activities.map((a) => [a.id, p.id] as const))),
    [ganttProjects],
  );

  // Ao abrir a página, tudo recolhido — projeto E atividade (pedido do usuário: mesmo expandindo
  // um projeto, as tarefas de cada atividade continuam escondidas até um clique próprio nela). No
  // MOBILE (`MobileScheduleList`, sem o nível "projeto" pra recolher) só existe o nível atividade.
  const collapsedOnLoadRef = useRef(false);
  useEffect(() => {
    if (!loaded || collapsedOnLoadRef.current || projectsToShow.length === 0) return;
    if (isImportacaoView) {
      // Sem nível Projeto nessa aba (escondido via `hideProjectRow`) — recolhe só Atividade,
      // pedido do usuário. Espera a categoria "Importação" carregar antes de recolher: sem isso
      // `ganttProjects` ainda estaria vazio (`filteredGanttProjects` retorna `[]` enquanto
      // `importacaoCategoryId` é `undefined`) e o recolhimento inicial não pegaria nenhuma
      // atividade, ficando preso em "não recolhido" pra sempre (o `ref` só deixa rodar uma vez).
      if (!categoriesLoaded) return;
      setCollapsedActivityIds(new Set(ganttProjects.flatMap((p) => p.activities.map((a) => a.id))));
    } else {
      setCollapsedActivityIds(new Set(projectsToShow.flatMap((p) => p.activities.map((a) => a.id))));
      if (!isMobile) {
        setCollapsedProjectIds(new Set(projectsToShow.map((p) => p.id)));
      }
    }
    collapsedOnLoadRef.current = true;
  }, [loaded, projectsToShow, isMobile, isImportacaoView, categoriesLoaded, ganttProjects]);

  if (!loaded) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (id && projectsToShow.length === 0) {
    return <EmptyState title="Projeto não encontrado" description="Verifique o link ou volte para a lista de projetos." />;
  }

  function cycleExpandLevel() {
    const allActivityIds = new Set(visibleProjects.flatMap((p) => p.activities.map((a) => a.id)));
    if (expandLevel === 'project') {
      // nível atividade: projeto expandido, atividade ainda recolhida (tarefa some)
      setCollapsedProjectIds(new Set());
      setCollapsedActivityIds(allActivityIds);
      setExpandLevel('activity');
    } else if (expandLevel === 'activity') {
      // nível tarefa: tudo expandido
      setCollapsedProjectIds(new Set());
      setCollapsedActivityIds(new Set());
      setExpandLevel('task');
    } else {
      // recolhe tudo, só o projeto fica visível
      setCollapsedProjectIds(new Set(visibleProjects.map((p) => p.id)));
      setCollapsedActivityIds(allActivityIds);
      setExpandLevel('project');
    }
  }

  // Aba Importação — 2 estados só (sem nível Projeto pra ciclar): tudo expandido ⇄ atividade
  // recolhida (tarefa some). Usa `ganttProjects` (já filtrado pela categoria travada), não
  // `visibleProjects` (portfólio inteiro antes do filtro).
  function toggleImportacaoExpand() {
    if (importacaoExpanded) {
      setCollapsedActivityIds(new Set(ganttProjects.flatMap((p) => p.activities.map((a) => a.id))));
    } else {
      setCollapsedActivityIds(new Set());
    }
    setImportacaoExpanded((v) => !v);
  }

  function cycleImportacaoSort() {
    setImportacaoSort((s) => (s === 'criticidade' ? 'processoAsc' : s === 'processoAsc' ? 'processoDesc' : 'criticidade'));
  }

  function toggleProject(projectId: string) {
    setCollapsedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function toggleActivity(activityId: string) {
    setCollapsedActivityIds((current) => {
      const next = new Set(current);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }

  // Centraliza "hoje" na área visível do Gantt — mesma fórmula do protótipo:
  // scrollLeft = x(hoje) - (largura visível - largura do painel esquerdo) / 2. As colunas do
  // painel esquerdo são sticky (não "ocupam" scroll), então a área de timeline visível começa em
  // `scrollLeft` e vai até `scrollLeft + clientWidth`; x(hoje) aqui é relativo ao início da
  // timeline (offsetPx), não ao início absoluto da tabela.
  function scrollToToday() {
    const container = scrollContainerRef.current;
    if (!container) return;
    const range = calculatePortfolioRange(ganttProjects);
    const today = todayISO();
    if (today < range.start || today > range.end) return;
    const leftWidth = getGanttLeftWidth(getGanttColumns(effectiveCompact ? 'compact' : 'full'));
    const pxPerDay = ZOOM_PX_PER_DAY[zoom];
    const target = offsetPx(range, today, pxPerDay) - (container.clientWidth - leftWidth) / 2;
    container.scrollLeft = Math.max(0, target);
  }

  // mantém "selectedTask" sincronizada com o estado mais atual do projeto após edições
  const liveSelectedTask = selectedTask ? (allTasks.find((t) => t.id === selectedTask.id) ?? null) : null;

  const selectedTaskDependentCount = liveSelectedTask
    ? allPortfolioTasks.filter((t) => t.dependencies.some((d) => d.predecessorId === liveSelectedTask.id)).length
    : 0;
  const selectedTaskProject = ganttProjects.find((p) => p.id === activityIdToProjectId.get(liveSelectedTask?.activityId ?? ''));

  /** Fase 7 (Parte A) — dispara na hora (sem ConfirmDialog, mesmo padrão de exclusão sem
   * confirmação prévia da Fase 3) + Desfazer de 6s restaurando o projeto inteiro de antes
   * (atividade, tarefas com rowNumbers originais, e as dependencies que tinham sido limpas nas
   * tarefas sobreviventes — ver `removeActivityWithTasks`). */
  function handleRemoveActivityWithTasks(activity: ActivityView) {
    const owningProjectId = activityIdToProjectId.get(activity.id);
    if (!owningProjectId) return;
    const previousProject = removeActivityWithTasks(owningProjectId, activity.id);
    if (!previousProject) return;
    const taskCount = activity.tasks.length;
    show(`"${activity.name}" e ${taskCount === 1 ? 'sua tarefa foram excluídas' : `suas ${taskCount} tarefas foram excluídas`}`, () => {
      restoreActivityWithTasks(owningProjectId, previousProject);
    });
  }

  const project = id ? projectsToShow[0] : undefined;
  const title = isImportacaoView ? 'Importação' : project ? `${project.code} — ${project.name}` : 'Cronograma de Projetos';
  const responsavelFilterName = responsavelFilterId ? people.find((p) => p.id === responsavelFilterId)?.name : undefined;

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-8 -mt-6 space-y-4 border-b border-border bg-page px-8 pt-6 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {/* Mobile Importação já tem "Importação" no cabeçalho navy (`MobileLayout.tsx`, ver
              `TITLE_BY_PATH`) — sem título nem "Voltar" nessa rota, esta div ficaria vazia
              (mas ainda reservando o `gap-3` do flex pai, um vão em branco antes dos filtros
              abaixo) se renderizasse sempre; some inteira quando não tem nada de verdade pra
              mostrar, a pedido do usuário. */}
          {(!isMobile || !isImportacaoView || responsavelFilterName) && (
            <div>
              {isMobile && !isImportacaoView && (
                <Link to="/projetos" className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-action">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Link>
              )}
              {!(isMobile && isImportacaoView) && <h1 className="text-2xl font-bold text-text">{title}</h1>}
              {responsavelFilterName && (
                <p className="mt-0.5 text-xs text-text-muted">
                  Mostrando só tarefas de <span className="font-semibold text-text">{responsavelFilterName}</span> ·{' '}
                  <Link to={`/projetos/${id}/cronograma`} className="font-semibold text-action">
                    ver todas
                  </Link>
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!isMobile && !isImportacaoView && (
              <FilterSelect
                label="Categoria"
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={categories.map((c) => ({ value: c.id, label: c.label }))}
              />
            )}
            {!isMobile && (
              <button
                type="button"
                onClick={() => setHideCompleted((v) => !v)}
                aria-pressed={hideCompleted}
                className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${
                  hideCompleted ? 'border-sidebar bg-sidebar text-white' : 'border-border bg-white text-text-muted hover:border-text-muted2'
                }`}
              >
                Esconder concluídas
              </button>
            )}
            {/* Mesmo ciclo de ordenação do botão desktop (`cycleImportacaoSort`/`importacaoSort`,
                acima) — mobile não tem a barra de toolbar desktop (fica inteira atrás de
                `!isMobile`), então precisa de um controle próprio, mesmo estilo de botão "Ordenar"
                já usado em `MobileSchedulePage.tsx`. */}
            {isMobile && isImportacaoView && (
              <button
                type="button"
                onClick={cycleImportacaoSort}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-xs font-semibold text-text-muted"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {importacaoSort === 'criticidade'
                  ? 'Processo: A → Z'
                  : importacaoSort === 'processoAsc'
                    ? 'Processo: Z → A'
                    : 'Criticidade'}
              </button>
            )}
            {/* "Unidade" volta pra Importação (pedido do usuário, estética) — renderizada aqui,
                logo depois do botão de ordenação, não dentro de `<ProjectFilters>` (que continua
                com `hideUnit`, senão apareceria duas vezes). "Projeto" (novo, substituiu Unidade
                antes) continua também, só que depois dela agora. */}
            {isImportacaoView && (
              <FilterSelect
                label="Unidade"
                value={filters.unit}
                onChange={(unit) => setFilters((f) => ({ ...f, unit }))}
                options={units}
              />
            )}
            {isImportacaoView && (
              <FilterSelect
                label="Projeto"
                value={importacaoProjectFilter}
                onChange={setImportacaoProjectFilter}
                options={importacaoProjectOptions}
              />
            )}
            {!project && projectsToShow.length > 0 && !(isMobile && isImportacaoView) && (
              <ProjectFilters
                filters={filters}
                units={units}
                years={years}
                hideStatus={isImportacaoView}
                hideSearch={isImportacaoView}
                hideYear={isMobile && isImportacaoView}
                hideUnit={isImportacaoView}
                onChange={(next) => {
                  setFilters(next);
                  if (next === EMPTY_FILTERS) {
                    setCategoryFilter('');
                    setHideCompleted(false);
                    setImportacaoProjectFilter('');
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Aba Importação no mobile já tem esse resumo, de novo, dentro do `MobileScheduleList`
            ("Status das tarefas") — pedido do usuário pra tirar a duplicata aqui em cima. */}
        {!project && projectsToShow.length > 0 && !(isMobile && isImportacaoView) && (
          <ProjectsHealthStrip
            projects={isImportacaoView ? importacaoTasksExceptStatus : visibleProjectsExceptStatus}
            totalCount={isImportacaoView ? ganttProjects.flatMap((p) => p.activities).length : visibleProjects.length}
            totalLabel={isImportacaoView ? 'Total de Atividades' : undefined}
            statusLabels={isImportacaoView ? IMPORTACAO_TASK_STATUS_LABELS : undefined}
            activeStatuses={activeStatuses}
            onToggleStatus={toggleStatus}
          />
        )}

        {projectsToShow.length > 0 && !isMobile && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3.5">
            <p className="text-sm font-semibold text-text">
              {isImportacaoView ? 'Itens de importação' : project ? 'Cronograma do projeto' : 'Cronograma dos projetos'}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              {!isImportacaoView && (
                <Link
                  to="/projetos"
                  className="inline-flex items-center gap-1.5 rounded-[9px] bg-border px-3.5 py-2.5 text-sm font-bold text-text hover:bg-border/70"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Link>
              )}
              {effectiveCompact && (
                <>
                  <div className="flex items-center rounded-[9px] border border-border bg-page p-0.5">
                    {ZOOM_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setZoom(option.value)}
                        className={`rounded-[7px] px-3 py-1.5 text-sm font-semibold transition-colors ${
                          zoom === option.value ? 'bg-card text-action shadow-sm' : 'text-text-muted hover:text-text'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={scrollToToday}>
                    Ir para hoje
                  </Button>
                </>
              )}
              {/* Criar/editar fica de fora no mobile — leitura + "informar real" (bottom sheet) é o
                  escopo do celular desde a Fase 6; aqui só sobrava controle sem espaço pra ele.
                  Fica de fora também na aba Importação — é uma lista já achatada/filtrada, criar
                  atividade/tarefa ali não tem contexto de projeto claro pra fazer sentido. */}
              {!isMobile && !isImportacaoView && (
                <>
                  <div className="relative">
                    <Button
                      variant="secondary"
                      icon={<ListPlus className="h-4 w-4" />}
                      onClick={() => setNewItemMenuOpen((open) => !open)}
                      disabled={isAdmin !== true}
                      title={isAdmin !== true ? 'Somente administrador pode criar atividade ou tarefa.' : undefined}
                    >
                      Novo item
                    </Button>
                    {newItemMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setNewItemMenuOpen(false)} />
                        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-[9px] border border-border bg-card p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setNewItemMenuOpen(false);
                              setActivityDialog({ open: true });
                            }}
                            className="block w-full rounded-md px-3 py-2 text-left text-sm text-text hover:bg-page"
                          >
                            Nova atividade
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewItemMenuOpen(false);
                              setTaskPanelState({ open: true });
                            }}
                            className="block w-full rounded-md px-3 py-2 text-left text-sm text-text hover:bg-page"
                          >
                            Nova tarefa
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <Button
                    variant={expandLevel === 'task' ? 'secondary' : 'primary'}
                    icon={expandLevel === 'task' ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
                    onClick={cycleExpandLevel}
                  >
                    {expandLevel === 'project' ? 'Expandir atividades' : expandLevel === 'activity' ? 'Expandir tarefas' : 'Recolher tudo'}
                  </Button>
                  <Button
                    variant={editMode ? 'secondary' : 'primary'}
                    icon={<Pencil className="h-4 w-4" />}
                    onClick={() => setEditMode((e) => !e)}
                    disabled={isAdmin !== true}
                    title={isAdmin !== true ? 'Somente administrador pode excluir atividade.' : undefined}
                  >
                    Editar
                  </Button>
                </>
              )}
              {/* Aba Importação — sem nível Projeto, então é só 2 estados (não o ciclo de 3 acima). */}
              {!isMobile && isImportacaoView && (
                <Button
                  variant={importacaoExpanded ? 'secondary' : 'primary'}
                  icon={importacaoExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
                  onClick={toggleImportacaoExpand}
                >
                  {importacaoExpanded ? 'Recolher tudo' : 'Expandir tarefas'}
                </Button>
              )}
              {/* Ordena ATIVIDADE (pedido do usuário) — ciclo de 3 estados, rótulo descreve o
                  destino do próximo clique, mesmo padrão do toggle acima. */}
              {!isMobile && isImportacaoView && (
                <button
                  type="button"
                  onClick={cycleImportacaoSort}
                  className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-card px-3.5 py-2.5 text-sm font-semibold text-text-muted hover:border-text-muted2"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {importacaoSort === 'criticidade'
                    ? 'Processo: A → Z'
                    : importacaoSort === 'processoAsc'
                      ? 'Processo: Z → A'
                      : 'Criticidade'}
                </button>
              )}
              {!isMobile && !project && !isImportacaoView && (
                <button
                  type="button"
                  onClick={() => setNameSort((s) => (s === 'asc' ? 'desc' : 'asc'))}
                  className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-card px-3.5 py-2.5 text-sm font-semibold text-text-muted hover:border-text-muted2"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {nameSort === 'asc' ? 'Código: P01 → P99' : 'Código: P99 → P01'}
                </button>
              )}
              {!isMobile && !isImportacaoView && (
                <Button
                  variant={compact ? 'primary' : 'secondary'}
                  icon={compact ? <Table2 className="h-4 w-4" /> : <GanttChart className="h-4 w-4" />}
                  onClick={() => setCompact((c) => !c)}
                >
                  {compact ? 'Tabela' : 'Gantt'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {isImportacaoView && categoriesLoaded && !importacaoCategoryId ? (
        <EmptyState
          title='Categoria "Importação" não configurada'
          description="Peça a um administrador para criar essa categoria em Configurações → Categorias."
        />
      ) : projectsToShow.length === 0 ? (
        <EmptyState title="Nenhum projeto cadastrado" description="Crie um projeto para ver o cronograma aqui." />
      ) : visibleProjects.length === 0 ? (
        <EmptyState title="Nenhum projeto encontrado" description="Ajuste os filtros para encontrar o que procura." />
      ) : ganttProjects.length === 0 && effectiveCategoryFilter ? (
        <EmptyState
          title="Nenhuma tarefa encontrada"
          description="Nenhuma tarefa desta categoria foi encontrada. Ajuste o filtro para encontrar o que procura."
        />
      ) : allTasks.length === 0 ? (
        <EmptyState
          title="Nenhuma tarefa cadastrada"
          description="Use o botão “+ Tarefa” em cada atividade abaixo para começar a montar o cronograma."
        />
      ) : null}

      {ganttProjects.length > 0 && effectiveCompact && !isMobile && <ScheduleLegend />}

      {ganttProjects.length > 0 && isMobile && (
        <MobileScheduleList
          projects={importacaoDisplayProjects}
          collapsedActivityIds={collapsedActivityIds}
          onToggleActivity={toggleActivity}
          onOpenTask={setSelectedTask}
        />
      )}

      {ganttProjects.length > 0 && !isMobile && (
        <Card className="space-y-4 p-0">
          <div className="px-4 pb-4 pt-4">
            <GanttTable
              projects={importacaoDisplayProjects}
              collapsedProjectIds={collapsedProjectIds}
              collapsedActivityIds={collapsedActivityIds}
              people={people}
              holidays={holidays}
              compact={effectiveCompact}
              hideProjectRow={isImportacaoView}
              editMode={editMode}
              isAdmin={isAdmin}
              zoom={zoom}
              scrollContainerRef={scrollContainerRef}
              onToggleProject={toggleProject}
              onToggleActivity={toggleActivity}
              onOpenTask={setSelectedTask}
              onAddTask={(activity) => setTaskPanelState({ open: true, initialActivityId: activity.id })}
              onAddActivity={(project) => setActivityDialog({ open: true, initialProjectId: project.id })}
              onRemoveActivity={setDeletingActivity}
              onRemoveActivityWithTasks={handleRemoveActivityWithTasks}
              onRenameActivity={(activity, name) => {
                const owningProjectId = activityIdToProjectId.get(activity.id);
                if (owningProjectId) updateActivityName(owningProjectId, activity.id, name);
              }}
              onChangeProcesso={(activity, processo) => {
                const owningProjectId = activityIdToProjectId.get(activity.id);
                if (owningProjectId) updateActivityProcesso(owningProjectId, activity.id, processo);
              }}
              onChangeObservacao={(taskId, observacao) => {
                const owningProjectId = activityIdToProjectId.get(allTasks.find((t) => t.id === taskId)?.activityId ?? '');
                if (owningProjectId) updateTaskObservacao(owningProjectId, taskId, observacao);
              }}
            />
          </div>
        </Card>
      )}

      <TaskPanel
        task={liveSelectedTask}
        isMobile={isMobile}
        allTasks={allTasks}
        categories={categories}
        people={people}
        replanejamentos={replanejamentos}
        isAdmin={isAdmin}
        holidays={holidays}
        unit={selectedTaskProject?.unit ?? ''}
        projectName={selectedTaskProject ? `${selectedTaskProject.code} — ${selectedTaskProject.name}` : undefined}
        onCreatePerson={createPerson}
        onClose={() => setSelectedTask(null)}
        onSave={(taskId, patch) => {
          const owningProjectId = activityIdToProjectId.get(
            allTasks.find((t) => t.id === taskId)?.activityId ?? '',
          );
          if (!owningProjectId) return;
          updateTask(owningProjectId, taskId, patch);
        }}
        onSaveActual={(taskId, patch) => {
          const owningProjectId = activityIdToProjectId.get(
            allTasks.find((t) => t.id === taskId)?.activityId ?? '',
          );
          if (!owningProjectId) return;
          updateTaskActualDates(owningProjectId, taskId, patch);
        }}
        onConfirmCompletion={(taskId) => {
          const owningProjectId = activityIdToProjectId.get(
            allTasks.find((t) => t.id === taskId)?.activityId ?? '',
          );
          if (owningProjectId) confirmTaskCompletion(owningProjectId, taskId);
        }}
        onRequestReject={(taskId) => setRejectingTaskId(taskId)}
        onSetPredecessors={(taskId, entries) => {
          const owningProjectId = activityIdToProjectId.get(
            allTasks.find((t) => t.id === taskId)?.activityId ?? '',
          );
          if (!owningProjectId) return { valid: false, errors: ['Projeto não encontrado.'] };
          return setTaskPredecessors(owningProjectId, taskId, entries);
        }}
        onReplan={(taskId, patch, motivo) => {
          const owningProjectId = activityIdToProjectId.get(
            allTasks.find((t) => t.id === taskId)?.activityId ?? '',
          );
          if (!owningProjectId) return { valid: false, errors: ['Projeto não encontrado.'] };
          return replanTask(owningProjectId, taskId, patch, motivo, isAdmin === true);
        }}
        dependentCount={selectedTaskDependentCount}
        onDelete={(taskId) => {
          const task = allTasks.find((t) => t.id === taskId);
          if (task) setDeletingTask(task);
        }}
      />

      <AddActivityDialog
        open={activityDialog.open}
        projects={ganttProjects}
        initialProjectId={activityDialog.initialProjectId}
        catalog={catalog}
        categories={categories}
        people={people}
        onCreatePerson={createPerson}
        onCancel={() => setActivityDialog({ open: false })}
        onAdd={(projectId, name, processo) => {
          addActivity(projectId, name, processo);
          setActivityDialog({ open: false });
        }}
        onAddFromCatalog={(projectId, name, tasks, processo) => {
          addActivityWithTasks(projectId, name, tasks, todayISO(), processo);
          setActivityDialog({ open: false });
        }}
      />

      <AddTaskPanel
        open={taskPanelState.open}
        projects={ganttProjects}
        initialActivityId={taskPanelState.initialActivityId}
        categories={categories}
        people={people}
        holidays={holidays}
        onCreatePerson={createPerson}
        onClose={() => setTaskPanelState({ open: false })}
        onAdd={(activityId, name, category, responsavelId, plannedStart, plannedEnd, predecessorRowNumbers) => {
          const projectId = activityIdToProjectId.get(activityId);
          if (!projectId) return;
          addTask(projectId, activityId, {
            name,
            category,
            responsavelId,
            plannedStart,
            plannedEnd,
            predecessorRowNumbers,
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingActivity)}
        title="Excluir atividade"
        message={
          deletingActivity
            ? `Tem certeza que deseja excluir "${deletingActivity.name}" e todas as suas tarefas? As linhas das tarefas restantes serão renumeradas.`
            : ''
        }
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeletingActivity(null)}
        onConfirm={() => {
          const owningProjectId = deletingActivity ? activityIdToProjectId.get(deletingActivity.id) : undefined;
          if (deletingActivity && owningProjectId) removeActivity(owningProjectId, deletingActivity.id);
          setDeletingActivity(null);
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
        }}
      />

      <RejectTaskDialog
        open={Boolean(rejectingTaskId)}
        taskName={allTasks.find((t) => t.id === rejectingTaskId)?.name ?? ''}
        onCancel={() => setRejectingTaskId(null)}
        onConfirm={(motivo) => {
          const rejectingTask = allTasks.find((t) => t.id === rejectingTaskId);
          const owningProjectId = rejectingTask ? activityIdToProjectId.get(rejectingTask.activityId) : undefined;
          if (!rejectingTask || !owningProjectId) return { valid: false, errors: ['Tarefa não encontrada.'] };
          const result = rejectTaskCompletion(owningProjectId, rejectingTask.id, motivo);
          if (result.valid) setRejectingTaskId(null);
          return result;
        }}
      />

      <UndoToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
