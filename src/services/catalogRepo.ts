import { supabase } from './supabaseClient';
import type { ActivityTemplate, Category, TaskTemplate } from '../types';

interface ActivityTemplateRow {
  id: string;
  name: string;
  category: Category;
  active: boolean;
}

interface TaskTemplateRow {
  id: string;
  activity_template_id: string;
  name: string;
  position: number;
}

export async function fetchCatalog(): Promise<ActivityTemplate[]> {
  const [{ data: activityRows, error: activityError }, { data: taskRows, error: taskError }] = await Promise.all([
    supabase.from('activity_templates').select('*').order('name'),
    supabase.from('task_templates').select('*').order('position'),
  ]);
  if (activityError) throw activityError;
  if (taskError) throw taskError;

  const tasksByTemplate = new Map<string, TaskTemplate[]>();
  for (const row of (taskRows ?? []) as TaskTemplateRow[]) {
    const list = tasksByTemplate.get(row.activity_template_id) ?? [];
    list.push({ id: row.id, name: row.name });
    tasksByTemplate.set(row.activity_template_id, list);
  }

  return ((activityRows ?? []) as ActivityTemplateRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    active: row.active,
    tasks: tasksByTemplate.get(row.id) ?? [],
  }));
}

/** Upsert do template + substituição completa das tarefas associadas. */
export async function saveTemplate(entry: ActivityTemplate): Promise<void> {
  const { error: templateError } = await supabase.from('activity_templates').upsert({
    id: entry.id,
    name: entry.name,
    category: entry.category,
    active: entry.active,
  });
  if (templateError) throw templateError;

  const { error: deleteError } = await supabase.from('task_templates').delete().eq('activity_template_id', entry.id);
  if (deleteError) throw deleteError;

  if (entry.tasks.length > 0) {
    const { error: insertError } = await supabase.from('task_templates').insert(
      entry.tasks.map((task, index) => ({
        id: task.id,
        activity_template_id: entry.id,
        name: task.name,
        position: index,
      })),
    );
    if (insertError) throw insertError;
  }
}

export async function deleteTemplateRemote(id: string): Promise<void> {
  const { error } = await supabase.from('activity_templates').delete().eq('id', id);
  if (error) throw error;
}
