import { supabase } from './supabaseClient';
import type { Activity, Category, Project, ProjectStatus, Task } from '../types';
import { recomputeProject } from '../utils';

interface ProjectRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  sector: string;
  responsible: string;
  progress: number;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

interface ActivityRow {
  id: string;
  project_id: string;
  name: string;
  position: number;
}

interface TaskRow {
  id: string;
  project_id: string;
  activity_id: string;
  row_number: number;
  position: number;
  name: string;
  category: Category;
  predecessor_row_numbers: number[];
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
}

function orNull(value: string | undefined): string | null {
  return value ?? null;
}

/** Busca todos os projetos e remonta a árvore Project → Activity → Task, já recalculando status/rollup. */
export async function fetchProjects(): Promise<Project[]> {
  const [{ data: projectRows, error: projectsError }, { data: activityRows, error: activitiesError }, { data: taskRows, error: tasksError }] =
    await Promise.all([
      supabase.from('projects').select('*').order('code'),
      supabase.from('activities').select('*').order('position'),
      supabase.from('tasks').select('*').order('position'),
    ]);

  if (projectsError) throw projectsError;
  if (activitiesError) throw activitiesError;
  if (tasksError) throw tasksError;

  const tasksByActivity = new Map<string, Task[]>();
  for (const row of (taskRows ?? []) as TaskRow[]) {
    const task: Task = {
      id: row.id,
      rowNumber: row.row_number,
      activityId: row.activity_id,
      name: row.name,
      category: row.category,
      predecessorRowNumbers: row.predecessor_row_numbers,
      plannedStart: row.planned_start,
      plannedEnd: row.planned_end,
      actualStart: row.actual_start ?? undefined,
      actualEnd: row.actual_end ?? undefined,
      status: 'planned',
    };
    const list = tasksByActivity.get(row.activity_id) ?? [];
    list.push(task);
    tasksByActivity.set(row.activity_id, list);
  }

  const activitiesByProject = new Map<string, Activity[]>();
  for (const row of (activityRows ?? []) as ActivityRow[]) {
    const activity: Activity = {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      tasks: tasksByActivity.get(row.id) ?? [],
      status: 'planned',
    };
    const list = activitiesByProject.get(row.project_id) ?? [];
    list.push(activity);
    activitiesByProject.set(row.project_id, list);
  }

  return ((projectRows ?? []) as ProjectRow[]).map((row) =>
    recomputeProject({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description ?? undefined,
      unit: row.unit,
      sector: row.sector,
      responsible: row.responsible,
      progress: row.progress,
      status: 'planned',
      activities: activitiesByProject.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

function formatIdList(ids: string[]): string {
  return `(${ids.map((id) => `"${id}"`).join(',')})`;
}

/** Grava a árvore inteira do projeto (upsert de todas as linhas + remoção do que saiu da árvore). */
export async function saveProjectTree(project: Project): Promise<void> {
  const { error: projectError } = await supabase.from('projects').upsert({
    id: project.id,
    code: project.code,
    name: project.name,
    description: project.description ?? null,
    unit: project.unit,
    sector: project.sector,
    responsible: project.responsible,
    planned_start: orNull(project.plannedStart),
    planned_end: orNull(project.plannedEnd),
    actual_start: orNull(project.actualStart),
    actual_end: orNull(project.actualEnd),
    progress: project.progress,
    status: project.status,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  });
  if (projectError) throw projectError;

  const activityIds = project.activities.map((a) => a.id);
  if (activityIds.length > 0) {
    const { error } = await supabase.from('activities').upsert(
      project.activities.map((activity, index) => ({
        id: activity.id,
        project_id: project.id,
        name: activity.name,
        position: index,
        planned_start: orNull(activity.plannedStart),
        planned_end: orNull(activity.plannedEnd),
        actual_start: orNull(activity.actualStart),
        actual_end: orNull(activity.actualEnd),
        status: activity.status,
      })),
    );
    if (error) throw error;
  }

  const deleteActivities = supabase.from('activities').delete().eq('project_id', project.id);
  const { error: deleteActivitiesError } =
    activityIds.length > 0 ? await deleteActivities.not('id', 'in', formatIdList(activityIds)) : await deleteActivities;
  if (deleteActivitiesError) throw deleteActivitiesError;

  const allTasks = project.activities.flatMap((a) => a.tasks);
  const taskIds = allTasks.length > 0 ? allTasks.map((t) => t.id) : [];
  if (allTasks.length > 0) {
    const { error } = await supabase.from('tasks').upsert(
      project.activities.flatMap((activity) =>
        activity.tasks.map((task, index) => ({
          id: task.id,
          project_id: project.id,
          activity_id: activity.id,
          row_number: task.rowNumber,
          position: index,
          name: task.name,
          category: task.category,
          predecessor_row_numbers: task.predecessorRowNumbers,
          planned_start: task.plannedStart,
          planned_end: task.plannedEnd,
          actual_start: orNull(task.actualStart),
          actual_end: orNull(task.actualEnd),
          status: task.status,
        })),
      ),
    );
    if (error) throw error;
  }

  const deleteTasks = supabase.from('tasks').delete().eq('project_id', project.id);
  const { error: deleteTasksError } =
    taskIds.length > 0 ? await deleteTasks.not('id', 'in', formatIdList(taskIds)) : await deleteTasks;
  if (deleteTasksError) throw deleteTasksError;
}

export async function deleteProjectRemote(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}
