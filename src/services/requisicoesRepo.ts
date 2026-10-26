import { supabase } from './supabaseClient';
import type { Requisicao, RequisicaoStatus } from '../types';

interface RequisicaoRow {
  id: string;
  item: string;
  quantidade: number;
  valor_estimado: number | null;
  observacao: string | null;
  status: RequisicaoStatus;
  criado_por: string;
  created_at: string;
  project_id: string | null;
}

function fromRow(row: RequisicaoRow): Requisicao {
  return {
    id: row.id,
    item: row.item,
    quantidade: row.quantidade,
    valorEstimado: row.valor_estimado ?? undefined,
    observacao: row.observacao ?? undefined,
    status: row.status,
    criadoPorUserId: row.criado_por,
    createdAt: row.created_at,
    projectId: row.project_id ?? undefined,
  };
}

export async function fetchRequisicoes(): Promise<Requisicao[]> {
  const { data, error } = await supabase.from('requisicoes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RequisicaoRow[]).map(fromRow);
}

export async function createRequisicao(input: {
  item: string;
  quantidade: number;
  valorEstimado?: number;
  observacao?: string;
  criadoPorUserId: string;
  projectId?: string;
}): Promise<Requisicao> {
  const { data, error } = await supabase
    .from('requisicoes')
    .insert({
      item: input.item.trim(),
      quantidade: input.quantidade,
      valor_estimado: input.valorEstimado ?? null,
      observacao: input.observacao?.trim() || null,
      criado_por: input.criadoPorUserId,
      project_id: input.projectId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as RequisicaoRow);
}

/** Edição geral (item/quantidade/valor/observação/status/projeto) — só administrador/
 * gestor_requisicoes passam no trigger `valida_edicao_requisicao`; qualquer outro papel recebe o
 * erro do banco. `projectId: null` desvincula de propósito — `undefined` continua sendo "não
 * mexer nesse campo", mesma convenção de patch parcial já usada em `updatePerson`. */
export async function updateRequisicao(
  id: string,
  patch: Partial<{
    item: string;
    quantidade: number;
    valorEstimado: number | null;
    observacao: string | null;
    status: RequisicaoStatus;
    projectId: string | null;
  }>,
): Promise<Requisicao> {
  const payload: Record<string, unknown> = {};
  if (patch.item !== undefined) payload.item = patch.item.trim();
  if (patch.quantidade !== undefined) payload.quantidade = patch.quantidade;
  if (patch.valorEstimado !== undefined) payload.valor_estimado = patch.valorEstimado;
  if (patch.observacao !== undefined) payload.observacao = patch.observacao?.trim() || null;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.projectId !== undefined) payload.project_id = patch.projectId;

  const { data, error } = await supabase.from('requisicoes').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data as RequisicaoRow);
}

/** Caminho estreito do comprador — mesmo `.update()` acima, mas só com `status`: o trigger do
 * banco é quem decide se a transição é válida (aprovada→comprada→recebida), não precisa de
 * checagem própria aqui. Função separada só pra deixar explícito no call site quem está chamando. */
export async function avancarStatusRequisicao(id: string, status: RequisicaoStatus): Promise<Requisicao> {
  return updateRequisicao(id, { status });
}

export async function deleteRequisicao(id: string): Promise<void> {
  const { error } = await supabase.from('requisicoes').delete().eq('id', id);
  if (error) throw error;
}
