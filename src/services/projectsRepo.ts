import { supabase } from './supabaseClient';
import type { Activity, Category, Project, Task } from '../types';

interface ProjectRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  sector: string;
  gerente_id: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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
  responsavel_id: string | null;
  predecessor_row_numbers: number[];
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
}

function orNull(value: string | undefined): string | null {
  return value ?? null;
}

/**
 * Busca projetos (ativos ou excluídos) e remonta a árvore Project → Activity → Task, na forma
 * persistida (raw) — sem status, sem recompute. Quem hidrata (status + condições derivadas) é
 * o chamador (useProjects.ts via recomputeProject), nunca o repo.
 */
async function fetchProjectsWhere(deleted: boolean): Promise<Project[]> {
  const projectsQuery = deleted
    ? supabase.from('projects').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
    : supabase.from('projects').select('*').is('deleted_at', null).order('code');

  const [{ data: projectRows, error: projectsError }, { data: activityRows, error: activitiesError }, { data: taskRows, error: tasksError }] =
    await Promise.all([
      projectsQuery,
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
      responsavelId: row.responsavel_id ?? undefined,
      predecessorRowNumbers: row.predecessor_row_numbers,
      plannedStart: row.planned_start,
      plannedEnd: row.planned_end,
      actualStart: row.actual_start ?? undefined,
      actualEnd: row.actual_end ?? undefined,
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
    };
    const list = activitiesByProject.get(row.project_id) ?? [];
    list.push(activity);
    activitiesByProject.set(row.project_id, list);
  }

  return ((projectRows ?? []) as ProjectRow[]).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? undefined,
    unit: row.unit,
    sector: row.sector,
    gerenteId: row.gerente_id ?? undefined,
    progress: row.progress,
    activities: activitiesByProject.get(row.id) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
  }));
}

export function fetchProjects(): Promise<Project[]> {
  return fetchProjectsWhere(false);
}

export function fetchDeletedProjects(): Promise<Project[]> {
  return fetchProjectsWhere(true);
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
    gerente_id: orNull(project.gerenteId),
    progress: project.progress,
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
          responsavel_id: orNull(task.responsavelId),
          predecessor_row_numbers: task.predecessorRowNumbers,
          planned_start: task.plannedStart,
          planned_end: task.plannedEnd,
          actual_start: orNull(task.actualStart),
          actual_end: orNull(task.actualEnd),
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

/** Move o projeto para "Excluídos" sem apagar os dados. */
export async function softDeleteProjectRemote(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', projectId);
  if (error) throw error;
}

export async function restoreProjectRemote(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').update({ deleted_at: null }).eq('id', projectId);
  if (error) throw error;
}

/** Apaga o projeto de verdade (usado a partir da aba "Excluídos"). */
export async function deleteProjectRemote(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}
