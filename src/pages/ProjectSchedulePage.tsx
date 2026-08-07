import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronsDownUp, ChevronsUpDown, Maximize2, Minimize2 } from 'lucide-react';
import { Button, Card, ConfirmDialog, EmptyState, Skeleton } from '../components/ui';
import { AddActivityDialog, AddTaskPanel, GanttTable, ScheduleLegend, TaskPanel } from '../components/gantt';
import { EMPTY_FILTERS, FilterSelect, ProjectFilters, type ProjectFiltersState } from '../components/projects';
import { useCatalog, useCategories, useProjects } from '../hooks';
import { STATUS_LABEL, type Activity, type Project, type Task } from '../types';
import { addDays, rollUpDates, rollUpStatus, todayISO } from '../utils';

export function ProjectSchedulePage() {
  const { id } = useParams<{ id?: string }>();
  const { projects, loaded, addTask, updateTask, removeTask, setTaskPredecessors, addActivity, removeActivity } =
    useProjects();
  const { catalog } = useCatalog();
  const { categories } = useCategories();
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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [addingToActivity, setAddingToActivity] = useState<Activity | null>(null);
  const [addingActivityToProject, setAddingActivityToProject] = useState<Project | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);

  const ganttProjects = useMemo(() => {
    if (!categoryFilter) return visibleProjects;
    return visibleProjects
      .map((p): Project | null => {
        const activities = p.activities
          .map((a): Activity | null => {
            const tasks = a.tasks.filter((t) => t.category === categoryFilter);
            if (tasks.length === 0) return null;
            return { ...a, tasks, ...rollUpDates(tasks), status: rollUpStatus(tasks) };
          })
          .filter((a): a is Activity => a !== null);
        if (activities.length === 0) return null;
        return { ...p, activities, ...rollUpDates(activities), status: rollUpStatus(activities) };
      })
      .filter((p): p is Project => p !== null);
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
              <Button
                variant="secondary"
                icon={compact ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                onClick={() => setCompact((c) => !c)}
              >
                {compact ? 'Visão completa' : 'Visão compacta'}
              </Button>
              <Button
                variant="primary"
                icon={allExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
                onClick={toggleExpandAll}
              >
                {allExpanded ? 'Recolher tudo' : 'Expandir tudo'}
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
              compact={compact}
              onToggleProject={toggleProject}
              onToggleActivity={toggleActivity}
              onOpenTask={setSelectedTask}
              onAddTask={setAddingToActivity}
              onAddActivity={setAddingActivityToProject}
              onRemoveActivity={setDeletingActivity}
            />
          </div>
        </Card>
      )}

      <TaskPanel
        task={liveSelectedTask}
        allTasks={allTasks}
        categories={categories}
        onClose={() => setSelectedTask(null)}
        onSave={(taskId, patch) => {
          const owningProjectId = activityIdToProjectId.get(
            allTasks.find((t) => t.id === taskId)?.activityId ?? '',
          );
          if (!owningProjectId) return;
          if (patch.predecessorRowNumbers !== undefined) {
            setTaskPredecessors(owningProjectId, taskId, patch.predecessorRowNumbers);
          } else {
            updateTask(owningProjectId, taskId, patch);
          }
        }}
        onDelete={(taskId) => {
          const owningProjectId = activityIdToProjectId.get(
            allTasks.find((t) => t.id === taskId)?.activityId ?? '',
          );
          if (owningProjectId) removeTask(owningProjectId, taskId);
        }}
      />

      <AddActivityDialog
        project={addingActivityToProject}
        onCancel={() => setAddingActivityToProject(null)}
        onAdd={(name) => {
          if (!addingActivityToProject) return;
          addActivity(addingActivityToProject.id, name);
          setAddingActivityToProject(null);
        }}
      />

      <AddTaskPanel
        activity={addingToActivity}
        catalog={catalog}
        categories={categories}
        onClose={() => setAddingToActivity(null)}
        onAdd={(names) => {
          if (!addingToActivity) return;
          const lastTask = addingToActivity.tasks.at(-1);
          let cursor = lastTask?.plannedEnd ?? addingToActivity.plannedStart ?? todayISO();
          for (const item of names) {
            const start = cursor;
            const end = addDays(start, 7);
            addTask(addingToActivity.projectId, addingToActivity.id, {
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
