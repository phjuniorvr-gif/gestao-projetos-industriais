import { supabase } from './supabaseClient';
import type { Papel, Usuario } from '../types';

interface PerfilRow {
  user_id: string;
  email: string;
  papel: Papel;
  created_at: string;
}

function fromRow(row: PerfilRow): Usuario {
  return { userId: row.user_id, email: row.email, papel: row.papel, createdAt: row.created_at };
}

export async function fetchUsuarios(): Promise<Usuario[]> {
  const { data, error } = await supabase.from('perfis').select('*').order('created_at');
  if (error) throw error;
  return ((data ?? []) as PerfilRow[]).map(fromRow);
}

export async function updateUsuarioPapel(userId: string, papel: Papel): Promise<void> {
  const { error } = await supabase.from('perfis').update({ papel }).eq('user_id', userId);
  if (error) throw error;
}

export async function createUsuario(email: string, password: string, papel: Papel): Promise<Usuario> {
  const { data, error } = await supabase.functions.invoke<{
    userId: string;
    email: string;
    papel: Papel;
    error?: string;
  }>('criar-usuario', { body: { email, password, papel } });

  if (error) {
    // FunctionsHttpError (resposta 4xx/5xx): a mensagem de negócio (e-mail duplicado, senha
    // curta, etc.) vem no corpo JSON da resposta, não em error.message — `context` é o Response cru.
    const context = (error as { context?: Response }).context;
    const body = context ? await context.json().catch(() => null) : null;
    throw new Error(body?.error ?? error.message);
  }
  if (!data || data.error) throw new Error(data?.error ?? 'Não foi possível criar o usuário.');

  return { userId: data.userId, email: data.email, papel: data.papel, createdAt: new Date().toISOString() };
}
