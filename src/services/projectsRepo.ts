import { supabase } from './supabaseClient';
import type {
  Activity,
  Category,
  DependencyType,
  Project,
  ReplanCampo,
  ReplanCampoData,
  Replanejamento,
  Task,
  TaskDependency,
} from '../types';

interface ProjectRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  sector: string;
  gerente_id: string | null;
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
  planned_start: string;
  planned_end: string;
  base_start: string;
  base_end: string;
  actual_start: string | null;
  actual_end: string | null;
}

/** Dependências (Fase 2.7) — tabela própria, não coluna de `tasks` (substitui
 * predecessor_row_numbers, renomeada pra _legacy no Commit 4). */
interface DependenciaRow {
  id: string;
  tarefa_id: string;
  predecessora_id: string;
  tipo: DependencyType;
  folga_du: number;
}

interface ReplanejamentoRow {
  id: string;
  tarefa_id: string;
  quando: string;
  quem_user_id: string;
  campo: ReplanCampo;
  campo_data: ReplanCampoData;
  de: string;
  para: string;
  motivo: string;
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

  const [
    { data: projectRows, error: projectsError },
    { data: activityRows, error: activitiesError },
    { data: taskRows, error: tasksError },
    { data: dependenciaRows, error: dependenciasError },
  ] = await Promise.all([
    projectsQuery,
    supabase.from('activities').select('*').order('position'),
    supabase.from('tasks').select('*').order('position'),
    supabase.from('dependencias').select('*'),
  ]);

  if (projectsError) throw projectsError;
  if (activitiesError) throw activitiesError;
  if (tasksError) throw tasksError;
  if (dependenciasError) throw dependenciasError;

  const dependenciesByTask = new Map<string, TaskDependency[]>();
  for (const row of (dependenciaRows ?? []) as DependenciaRow[]) {
    const list = dependenciesByTask.get(row.tarefa_id) ?? [];
    list.push({ predecessorId: row.predecessora_id, tipo: row.tipo, folgaDias: row.folga_du });
    dependenciesByTask.set(row.tarefa_id, list);
  }

  const tasksByActivity = new Map<string, Task[]>();
  for (const row of (taskRows ?? []) as TaskRow[]) {
    const task: Task = {
      id: row.id,
      rowNumber: row.row_number,
      activityId: row.activity_id,
      name: row.name,
      category: row.category,
      responsavelId: row.responsavel_id ?? undefined,
      dependencies: dependenciesByTask.get(row.id) ?? [],
      plannedStart: row.planned_start,
      plannedEnd: row.planned_end,
      baseStart: row.base_start,
      baseEnd: row.base_end,
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
          planned_start: task.plannedStart,
          planned_end: task.plannedEnd,
          base_start: task.baseStart,
          base_end: task.baseEnd,
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

  // Dependências (Fase 2.7): apaga e reinsere em vez de upsert — uma linha de dependência não
  // tem identidade própria pra preservar (nada referencia o id dela), então delete+insert é mais
  // simples que diffar. Tarefas removidas na etapa acima já levam suas dependências junto (FK
  // com on delete cascade nos dois lados); isto aqui cobre o caso de uma tarefa que continua
  // existindo mas teve a LISTA de dependências alterada.
  if (taskIds.length > 0) {
    const { error: deleteDependenciasError } = await supabase.from('dependencias').delete().in('tarefa_id', taskIds);
    if (deleteDependenciasError) throw deleteDependenciasError;

    const allDependencias = allTasks.flatMap((task) =>
      task.dependencies.map((dep) => ({
        tarefa_id: task.id,
        predecessora_id: dep.predecessorId,
        tipo: dep.tipo,
        folga_du: dep.folgaDias,
      })),
    );
    if (allDependencias.length > 0) {
      const { error: insertDependenciasError } = await supabase.from('dependencias').insert(allDependencias);
      if (insertDependenciasError) throw insertDependenciasError;
    }
  }
}

/** Auditoria de replanejamento (Fase 2.5) — busca o log inteiro, mais simples que paginar por
 * tarefa (55 tarefas hoje; se crescer muito, filtrar por projeto vira necessário). */
export async function fetchReplanejamentos(): Promise<Replanejamento[]> {
  const { data, error } = await supabase.from('replanejamentos').select('*').order('quando');
  if (error) throw error;
  return ((data ?? []) as ReplanejamentoRow[]).map((row) => ({
    id: row.id,
    tarefaId: row.tarefa_id,
    quando: row.quando,
    quemUserId: row.quem_user_id,
    campo: row.campo,
    campoData: row.campo_data,
    de: row.de,
    para: row.para,
    motivo: row.motivo,
  }));
}

/**
 * "Informar real" (Fase 5, Commit 2) — único `update` de 1 linha, nunca toca `activities`/
 * `dependencias`/outras colunas de `tasks`. Isto é o que torna essa ação possível pra quem não é
 * administrador depois do Commit 4: qualquer gravação que passasse por `saveProjectTree` (todo
 * o resto do app) reescreveria o projeto inteiro, incluindo o delete+reinsert de dependências —
 * barrado por RLS pra quem só tem permissão de informar data real. Só as chaves presentes no
 * patch entram no payload (cada campo tem seu próprio `onBlur` em `TaskPanel.tsx`, um por vez).
 */
/** Extraída da função remota só pra ser testável sem mockar o cliente Supabase (o projeto não
 * tem infra de mock pra isso — mesma decisão de preferir função pura testável já registrada na
 * Fase 3). Só as chaves presentes no patch entram — nunca as duas, nunca nenhuma coluna a mais. */
export function buildTaskActualPayload(patch: { actualStart?: string; actualEnd?: string }): Record<string, string | null> {
  const payload: Record<string, string | null> = {};
  if ('actualStart' in patch) payload.actual_start = orNull(patch.actualStart);
  if ('actualEnd' in patch) payload.actual_end = orNull(patch.actualEnd);
  return payload;
}

export async function updateTaskActual(
  taskId: string,
  patch: { actualStart?: string; actualEnd?: string },
): Promise<void> {
  const { error } = await supabase.from('tasks').update(buildTaskActualPayload(patch)).eq('id', taskId);
  if (error) throw error;
}

/**
 * "Replanejar previsto" (Fase 5, Commit 2) — RPC pra `replanejar_tarefa()` (Postgres), que
 * atualiza `tasks` e insere em `replanejamentos` na MESMA transação. Substitui o par
 * `updateTask` + `insertReplanejamentos` (duas chamadas independentes, não atômicas — se uma
 * falhasse depois da outra já ter ido, a tarefa mudava sem log, ou o log gravava sem a tarefa
 * ter mudado de verdade). Sem `security definer` na função — corre com o papel de quem chama,
 * então respeita o trigger/RLS de `tasks` e a RLS de `replanejamentos` normalmente (Commit 4).
 */
export async function replanTaskAtomic(
  taskId: string,
  plannedStart: string,
  plannedEnd: string,
  motivo: string,
): Promise<void> {
  const { error } = await supabase.rpc('replanejar_tarefa', {
    p_tarefa_id: taskId,
    p_planned_start: plannedStart,
    p_planned_end: plannedEnd,
    p_motivo: motivo,
  });
  if (error) throw error;
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
