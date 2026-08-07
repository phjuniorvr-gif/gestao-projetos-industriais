import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronsDownUp, ChevronsUpDown, Maximize2, Minimize2 } from 'lucide-react';
import { Button, Card, EmptyState, Skeleton } from '../components/ui';
import { AddTaskPanel, GanttTable, ScheduleLegend, TaskPanel } from '../components/gantt';
import { useCatalog, useProjects } from '../hooks';
import type { Activity, Task } from '../types';
import { addDays, todayISO } from '../utils';

export function ProjectSchedulePage() {
  const { id } = useParams<{ id?: string }>();
  const { projects, loaded, addTask, updateTask, removeTask, setTaskPredecessors } = useProjects();
  const { catalog } = useCatalog();

  const projectsToShow = useMemo(
    () => (id ? projects.filter((p) => p.id === id) : projects),
    [projects, id],
  );

  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(new Set());
  const [collapsedActivityIds, setCollapsedActivityIds] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(true);
  const [compact, setCompact] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [addingToActivity, setAddingToActivity] = useState<Activity | null>(null);

  const allTasks = useMemo(() => projectsToShow.flatMap((p) => p.activities.flatMap((a) => a.tasks)), [projectsToShow]);

  const activityIdToProjectId = useMemo(
    () => new Map(projectsToShow.flatMap((p) => p.activities.map((a) => [a.id, p.id] as const))),
    [projectsToShow],
  );

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
      setCollapsedProjectIds(new Set(projectsToShow.map((p) => p.id)));
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">{title}</h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Somente as tarefas recebem número. As dependências são informadas pelo número da tarefa predecessora.
          </p>
        </div>

        <ScheduleLegend />
      </div>

      {projectsToShow.length === 0 ? (
        <EmptyState title="Nenhum projeto cadastrado" description="Crie um projeto para ver o cronograma aqui." />
      ) : allTasks.length === 0 ? (
        <EmptyState
          title="Nenhuma tarefa cadastrada"
          description="Use o botão “+ Tarefa” em cada atividade abaixo para começar a montar o cronograma."
        />
      ) : null}

      {projectsToShow.length > 0 && (
        <Card className="space-y-4 p-0">
          <div className="flex items-center justify-between border-b border-border bg-page/60 px-4 py-3.5">
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

          <div className="px-4 pb-4">
            <GanttTable
              projects={projectsToShow}
              collapsedProjectIds={collapsedProjectIds}
              collapsedActivityIds={collapsedActivityIds}
              compact={compact}
              onToggleProject={toggleProject}
              onToggleActivity={toggleActivity}
              onOpenTask={setSelectedTask}
              onAddTask={setAddingToActivity}
            />
          </div>
        </Card>
      )}

      <TaskPanel
        task={liveSelectedTask}
        allTasks={allTasks}
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

      <AddTaskPanel
        activity={addingToActivity}
        catalog={catalog}
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
    </div>
  );
}
