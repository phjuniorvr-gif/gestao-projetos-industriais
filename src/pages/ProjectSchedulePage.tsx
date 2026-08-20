import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, ChevronsDownUp, ChevronsUpDown, GanttChart, ListPlus, Pencil, Table2 } from 'lucide-react';
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
import { useCatalog, useCategories, useHolidays, useIsMobile, usePeople, usePerfil, useProjects, useUndoToast } from '../hooks';
import { STATUS_LABEL, type ActivityView, type ProjectStatus, type ProjectView, type TaskView } from '../types';
import { rollUpDates, rollUpStatus, todayISO } from '../utils';

const ZOOM_OPTIONS: { value: GanttZoom; label: string }[] = [
  { value: 'dia', label: 'Dia' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
];

export function ProjectSchedulePage() {
  const { id } = useParams<{ id?: string }>();
  const {
    projects,
    loaded,
    replanejamentos,
    addTask,
    updateTask,
    updateTaskActualDates,
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
  const { categories } = useCategories();
  const { catalog } = useCatalog();
  const { people, createPerson } = usePeople();
  const { holidays } = useHolidays();
  const { toast, show, dismiss } = useUndoToast();
  const [filters, setFilters] = useState<ProjectFiltersState>(EMPTY_FILTERS);
  const [categoryFilter, setCategoryFilter] = useState('');

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

  // Sem o filtro de status — base que os cards de saúde usam pra contar por status (senão,
  // selecionar "Atrasado" zeraria os outros cards em vez de só destacar/filtrar a lista).
  const visibleProjectsExceptStatus = useMemo(
    () =>
      id
        ? projectsToShow
        : projectsToShow.filter((p) => {
            if (filters.unit && p.unit !== filters.unit) return false;
            if (filters.year && p.plannedStart?.slice(0, 4) !== filters.year) return false;
            return true;
          }),
    [projectsToShow, filters.unit, filters.year, id],
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

  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(new Set());
  const [collapsedActivityIds, setCollapsedActivityIds] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [compact, setCompact] = useState(true);
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

  const ganttProjects = useMemo(() => {
    if (!categoryFilter) return visibleProjects;
    return visibleProjects
      .map((p): ProjectView | null => {
        const activities = p.activities
          .map((a): ActivityView | null => {
            const tasks = a.tasks.filter((t) => t.category === categoryFilter);
            if (tasks.length === 0) return null;
            return { ...a, tasks, ...rollUpDates(tasks), status: rollUpStatus(tasks) };
          })
          .filter((a): a is ActivityView => a !== null);
        if (activities.length === 0) return null;
        return { ...p, activities, ...rollUpDates(activities), status: rollUpStatus(activities) };
      })
      .filter((p): p is ProjectView => p !== null);
  }, [visibleProjects, categoryFilter]);

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

  // Ao abrir a página com o portfólio inteiro (desktop), começa com tudo recolhido (só mostra a
  // linha do projeto). Na rota de um projeto só (/projetos/:id/cronograma — é a que o "Ver
  // atividades" do bottom sheet mobile abre) no DESKTOP, começa já expandido: quem chega numa
  // tela de projeto único quer ver as atividades sem mais um toque. No MOBILE (`MobileScheduleList`,
  // sem o nível "projeto" pra recolher) é o oposto — pedido do usuário: abre com as atividades
  // recolhidas, senão a lista de tarefas some a tela inteira antes mesmo de ver quais atividades
  // existem.
  const collapsedOnLoadRef = useRef(false);
  useEffect(() => {
    if (loaded && !collapsedOnLoadRef.current && projectsToShow.length > 0) {
      if (isMobile) {
        setCollapsedActivityIds(new Set(projectsToShow.flatMap((p) => p.activities.map((a) => a.id))));
      } else if (id) {
        setAllExpanded(true);
      } else {
        setCollapsedProjectIds(new Set(projectsToShow.map((p) => p.id)));
      }
      collapsedOnLoadRef.current = true;
    }
  }, [loaded, projectsToShow, id, isMobile]);

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

  function toggleExpandAll() {
    if (allExpanded) {
      setCollapsedProjectIds(new Set(visibleProjects.map((p) => p.id)));
      setAllExpanded(false);
    } else {
      setCollapsedProjectIds(new Set());
      setAllExpanded(true);
    }
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
    const leftWidth = getGanttLeftWidth(getGanttColumns(!compact));
    const pxPerDay = ZOOM_PX_PER_DAY[zoom];
    const target = offsetPx(range, today, pxPerDay) - (container.clientWidth - leftWidth) / 2;
    container.scrollLeft = Math.max(0, target);
  }

  // mantém "selectedTask" sincronizada com o estado mais atual do projeto após edições
  const liveSelectedTask = selectedTask ? (allTasks.find((t) => t.id === selectedTask.id) ?? null) : null;

  const selectedTaskDependentCount = liveSelectedTask
    ? allPortfolioTasks.filter((t) => t.dependencies.some((d) => d.predecessorId === liveSelectedTask.id)).length
    : 0;

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
  const title = project ? `${project.code} — ${project.name}` : 'Cronograma de Projetos';

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-8 -mt-6 space-y-4 border-b border-border bg-page px-8 pt-6 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            {isMobile && (
              <Link to="/projetos" className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-action">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Link>
            )}
            <h1 className="text-2xl font-bold text-text">{title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isMobile && (
              <FilterSelect
                label="Categoria"
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={categories.map((c) => ({ value: c.id, label: c.label }))}
              />
            )}
            {!project && projectsToShow.length > 0 && (
              <ProjectFilters
                filters={filters}
                units={units}
                years={years}
                onChange={(next) => {
                  setFilters(next);
                  if (next === EMPTY_FILTERS) setCategoryFilter('');
                }}
              />
            )}
          </div>
        </div>

        {!project && projectsToShow.length > 0 && (
          <ProjectsHealthStrip
            projects={visibleProjectsExceptStatus}
            totalCount={visibleProjects.length}
            activeStatuses={activeStatuses}
            onToggleStatus={toggleStatus}
          />
        )}

        {projectsToShow.length > 0 && !isMobile && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3.5">
            <p className="text-sm font-semibold text-text">
              {project ? 'Cronograma do projeto' : 'Cronograma dos projetos'}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                to="/projetos"
                className="inline-flex items-center gap-1.5 rounded-[9px] bg-border px-3.5 py-2.5 text-sm font-bold text-text hover:bg-border/70"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Link>
              {compact && (
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
                  escopo do celular desde a Fase 6; aqui só sobrava controle sem espaço pra ele. */}
              {!isMobile && (
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
                    variant={allExpanded ? 'secondary' : 'primary'}
                    icon={allExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
                    onClick={toggleExpandAll}
                  >
                    {allExpanded ? 'Recolher tudo' : 'Expandir tudo'}
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
              {!isMobile && (
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

      {projectsToShow.length === 0 ? (
        <EmptyState title="Nenhum projeto cadastrado" description="Crie um projeto para ver o cronograma aqui." />
      ) : visibleProjects.length === 0 ? (
        <EmptyState title="Nenhum projeto encontrado" description="Ajuste os filtros para encontrar o que procura." />
      ) : ganttProjects.length === 0 && categoryFilter ? (
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

      {ganttProjects.length > 0 && compact && !isMobile && <ScheduleLegend />}

      {ganttProjects.length > 0 && isMobile && (
        <MobileScheduleList
          projects={ganttProjects}
          collapsedActivityIds={collapsedActivityIds}
          onToggleActivity={toggleActivity}
          onOpenTask={setSelectedTask}
        />
      )}

      {ganttProjects.length > 0 && !isMobile && (
        <Card className="space-y-4 p-0">
          <div className="px-4 pb-4 pt-4">
            <GanttTable
              projects={ganttProjects}
              collapsedProjectIds={collapsedProjectIds}
              collapsedActivityIds={collapsedActivityIds}
              categories={categories}
              people={people}
              holidays={holidays}
              compact={compact}
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
            />
          </div>
        </Card>
      )}

      <TaskPanel
        task={liveSelectedTask}
        allTasks={allTasks}
        categories={categories}
        people={people}
        replanejamentos={replanejamentos}
        isAdmin={isAdmin}
        holidays={holidays}
        unit={ganttProjects.find((p) => p.id === activityIdToProjectId.get(liveSelectedTask?.activityId ?? ''))?.unit ?? ''}
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
        onAdd={(projectId, name) => {
          addActivity(projectId, name);
          setActivityDialog({ open: false });
        }}
        onAddFromCatalog={(projectId, name, tasks) => {
          addActivityWithTasks(projectId, name, tasks, todayISO());
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

      <UndoToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
