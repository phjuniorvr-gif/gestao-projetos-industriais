import { supabase } from './supabaseClient';
import type { CategoryEntry } from '../types';

export async function fetchCategories(): Promise<CategoryEntry[]> {
  const { data, error } = await supabase.from('categories').select('*').order('position');
  if (error) throw error;
  return data ?? [];
}

export async function saveCategory(entry: CategoryEntry): Promise<void> {
  const { error } = await supabase.from('categories').upsert(entry);
  if (error) throw error;
}
