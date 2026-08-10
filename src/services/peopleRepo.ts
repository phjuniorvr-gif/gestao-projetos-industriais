import { supabase } from './supabaseClient';
import type { Person } from '../types';

interface PersonRow {
  id: string;
  name: string;
  active: boolean;
  user_id: string | null;
}

function fromRow(row: PersonRow): Person {
  return { id: row.id, name: row.name, active: row.active, userId: row.user_id ?? undefined };
}

/** Normaliza pra comparação de duplicidade: minúsculas, sem espaço nas pontas, espaços internos colapsados. */
function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function fetchPeople(): Promise<Person[]> {
  const { data, error } = await supabase.from('pessoas').select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

/**
 * Busca antes de inserir (evita duplicidade de grafia). Se a pessoa já existir (comparação
 * normalizada), retorna a existente. Se o insert esbarrar no índice único mesmo assim (corrida
 * entre abas), busca de novo em vez de propagar o erro.
 */
export async function createPerson(name: string): Promise<Person> {
  const trimmed = name.trim();
  const target = normalize(trimmed);

  const { data: existing, error: fetchError } = await supabase.from('pessoas').select('*');
  if (fetchError) throw fetchError;
  const match = (existing ?? []).find((row) => normalize(row.name) === target);
  if (match) return fromRow(match);

  const { data, error } = await supabase.from('pessoas').insert({ name: trimmed }).select().single();
  if (error) {
    if (error.code === '23505') {
      const { data: retry, error: retryError } = await supabase
        .from('pessoas')
        .select('*')
        .ilike('name', trimmed)
        .limit(1)
        .maybeSingle();
      if (retryError) throw retryError;
      if (retry) return fromRow(retry);
    }
    throw error;
  }
  return fromRow(data);
}

export async function updatePerson(id: string, patch: { name?: string; active?: boolean }): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name.trim();
  if (patch.active !== undefined) payload.active = patch.active;
  const { error } = await supabase.from('pessoas').update(payload).eq('id', id);
  if (error) throw error;
}
