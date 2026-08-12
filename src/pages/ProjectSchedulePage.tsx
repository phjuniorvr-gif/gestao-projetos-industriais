import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, ChevronsDownUp, ChevronsUpDown, ListPlus, Maximize2, Minimize2, Pencil } from 'lucide-react';
import { Button, Card, ConfirmDialog, EmptyState, Skeleton } from '../components/ui';
import {
  AddActivityDialog,
  AddTaskPanel,
  calculatePortfolioRange,
  GanttTable,
  getGanttColumns,
  getGanttLeftWidth,
  offsetPx,
  ScheduleLegend,
  TaskPanel,
  ZOOM_PX_PER_DAY,
  type GanttZoom,
} from '../components/gantt';
import { EMPTY_FILTERS, FilterSelect, ProjectFilters, type ProjectFiltersState } from '../components/projects';
import { useCatalog, useCategories, useHolidays, usePeople, useProjects } from '../hooks';
import { STATUS_LABEL, type ActivityView, type ProjectView, type TaskView } from '../types';
import { addDays, rollUpDates, rollUpStatus, todayISO } from '../utils';

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
    removeActivity,
  } = useProjects();
  const { catalog } = useCatalog();
  const { categories } = useCategories();
  const { people, createPerson } = usePeople();
  const { holidays } = useHolidays();
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

  const visibleProjects = useMemo(
    () =>
      id
        ? projectsToShow
        : projectsToShow.filter((p) => {
            if (filters.unit && p.unit !== filters.unit) return false;
            if (filters.status && STATUS_LABEL[p.status] !== filters.status) return false;
            if (filters.year && p.plannedStart?.slice(0, 4) !== filters.year) return false;
            return true;
          }),
    [projectsToShow, filters, id],
  );

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

  const activityIdToProjectId = useMemo(
    () => new Map(ganttProjects.flatMap((p) => p.activities.map((a) => [a.id, p.id] as const))),
    [ganttProjects],
  );

  // Ao abrir a página, começa com tudo recolhido (só mostra a linha do projeto).
  const collapsedOnLoadRef = useRef(false);
  useEffect(() => {
    if (loaded && !collapsedOnLoadRef.current && projectsToShow.length > 0) {
      setCollapsedProjectIds(new Set(projectsToShow.map((p) => p.id)));
      collapsedOnLoadRef.current = true;
    }
  }, [loaded, projectsToShow]);

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

  const project = id ? projectsToShow[0] : undefined;
  const title = project ? `${project.code} — ${project.name}` : 'Cronograma de Projetos';

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-8 -mt-6 space-y-4 border-b border-border bg-page px-8 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">{title}</h1>
            <p className="mt-1.5 text-sm text-text-muted">
              Somente as tarefas recebem número. As dependências são informadas pelo número da tarefa predecessora.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <ScheduleLegend />
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                label="Categoria"
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={categories.map((c) => ({ value: c.id, label: c.label }))}
              />
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
        </div>

        {projectsToShow.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3.5">
            <p className="text-sm font-semibold text-text">
              {project ? 'Cronograma do projeto' : 'Cronograma dos projetos'}
            </p>
            <div className="flex items-center gap-2.5">
              <Link
                to="/projetos"
                className="inline-flex items-center gap-1.5 rounded-[9px] bg-border px-3.5 py-2.5 text-sm font-bold text-text hover:bg-border/70"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Link>
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
              {/* Cobre o caso da linha-alvo (projeto/atividade) não estar visível na tela — os
                  "+" por linha (sempre visíveis no hover, Fase 4 Commit 6) continuam sendo o
                  caminho mais rápido quando a linha já está à vista. */}
              <div className="relative">
                <Button
                  variant="secondary"
                  icon={<ListPlus className="h-4 w-4" />}
                  onClick={() => setNewItemMenuOpen((open) => !open)}
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
                variant={compact ? 'primary' : 'secondary'}
                icon={compact ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                onClick={() => setCompact((c) => !c)}
              >
                {compact ? 'Visão completa' : 'Visão compacta'}
              </Button>
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
              >
                Editar
              </Button>
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

      {ganttProjects.length > 0 && (
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
              zoom={zoom}
              scrollContainerRef={scrollContainerRef}
              onToggleProject={toggleProject}
              onToggleActivity={toggleActivity}
              onOpenTask={setSelectedTask}
              onAddTask={(activity) => setTaskPanelState({ open: true, initialActivityId: activity.id })}
              onAddActivity={(project) => setActivityDialog({ open: true, initialProjectId: project.id })}
              onRemoveActivity={setDeletingActivity}
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
          return replanTask(owningProjectId, taskId, patch, motivo);
        }}
        onDelete={(taskId) => {
          const owningProjectId = activityIdToProjectId.get(
            allTasks.find((t) => t.id === taskId)?.activityId ?? '',
          );
          if (owningProjectId) removeTask(owningProjectId, taskId);
        }}
      />

      <AddActivityDialog
        open={activityDialog.open}
        projects={ganttProjects}
        initialProjectId={activityDialog.initialProjectId}
        onCancel={() => setActivityDialog({ open: false })}
        onAdd={(projectId, name) => {
          addActivity(projectId, name);
          setActivityDialog({ open: false });
        }}
      />

      <AddTaskPanel
        open={taskPanelState.open}
        projects={ganttProjects}
        initialActivityId={taskPanelState.initialActivityId}
        catalog={catalog}
        categories={categories}
        onClose={() => setTaskPanelState({ open: false })}
        onAdd={(activityId, names) => {
          const projectId = activityIdToProjectId.get(activityId);
          const activity = ganttProjects.flatMap((p) => p.activities).find((a) => a.id === activityId);
          if (!projectId || !activity) return;
          const lastTask = activity.tasks.at(-1);
          let cursor = lastTask?.plannedEnd ?? activity.plannedStart ?? todayISO();
          for (const item of names) {
            const start = cursor;
            const end = addDays(start, 7);
            addTask(projectId, activityId, {
              name: item.name,
              category: item.category,
              plannedStart: start,
              plannedEnd: end,
            });
            cursor = end;
          }
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
    </div>
  );
}
