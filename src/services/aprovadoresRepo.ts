import { supabase } from './supabaseClient';
import type { Aprovador } from '../types';

interface AprovadorRow {
  id: string;
  name: string;
}

function fromRow(row: AprovadorRow): Aprovador {
  return { id: row.id, name: row.name };
}

/** Normaliza pra comparação de duplicidade: minúsculas, sem espaço nas pontas, espaços internos
 * colapsados — mesma convenção de `peopleRepo.ts` (`pessoas_nome_unico`), espelhada aqui pelo
 * índice único `aprovadores_nome_unico`. */
function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function fetchAprovadores(): Promise<Aprovador[]> {
  const { data, error } = await supabase.from('aprovadores').select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

/**
 * Busca antes de inserir (evita duplicidade de grafia). Se o aprovador já existir (comparação
 * normalizada), retorna o existente. Se o insert esbarrar no índice único mesmo assim (corrida
 * entre abas), busca de novo em vez de propagar o erro — mesmo padrão de `peopleRepo.createPerson`.
 */
export async function createAprovador(name: string): Promise<Aprovador> {
  const trimmed = name.trim();
  const target = normalize(trimmed);

  const { data: existing, error: fetchError } = await supabase.from('aprovadores').select('*');
  if (fetchError) throw fetchError;
  const match = (existing ?? []).find((row) => normalize(row.name) === target);
  if (match) return fromRow(match);

  const { data, error } = await supabase.from('aprovadores').insert({ name: trimmed }).select().single();
  if (error) {
    if (error.code === '23505') {
      const { data: retry, error: retryError } = await supabase
        .from('aprovadores')
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
