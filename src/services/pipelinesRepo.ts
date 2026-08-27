import { supabase } from './supabaseClient';
import type { Pipeline } from '../types';

interface PipelineRow {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  created_at: string;
}

function fromRow(row: PipelineRow): Pipeline {
  return { id: row.id, name: row.name, description: row.description ?? undefined, unit: row.unit, createdAt: row.created_at };
}

export async function fetchPipelines(): Promise<Pipeline[]> {
  const { data, error } = await supabase.from('pipelines').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as PipelineRow[]).map(fromRow);
}

export async function createPipeline(input: { name: string; description?: string; unit: string }): Promise<Pipeline> {
  const { data, error } = await supabase
    .from('pipelines')
    .insert({ name: input.name.trim(), description: input.description?.trim() || null, unit: input.unit })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as PipelineRow);
}

export async function deletePipeline(id: string): Promise<void> {
  const { error } = await supabase.from('pipelines').delete().eq('id', id);
  if (error) throw error;
}
