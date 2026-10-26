import { useCallback, useEffect, useState } from 'react';
import {
  avancarStatusRequisicao,
  createRequisicao as createRequisicaoRemote,
  deleteRequisicao as deleteRequisicaoRemote,
  fetchRequisicoes,
  updateRequisicao as updateRequisicaoRemote,
} from '../services/requisicoesRepo';
import type { Requisicao, RequisicaoStatus } from '../types';

/** Sem Context/Provider — diferente de `useProjects`/`usePipelines`, só a página `/requisicoes`
 * consome isso hoje (nenhum badge de menu depende de ver o dado atualizado em duas telas ao
 * mesmo tempo); mesmo raciocínio simples de `usePeople`/`useHolidays`. Se um badge de contagem
 * for pedido depois, aí sim vale migrar pro padrão Provider (ver nota em `useProjects.ts`). */
export function useRequisicoes() {
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchRequisicoes()
      .then(setRequisicoes)
      .catch((err) => console.error('Falha ao carregar requisições do Supabase', err))
      .finally(() => setLoaded(true));
  }, []);

  const createRequisicao = useCallback(
    async (input: {
      item: string;
      quantidade: number;
      valorEstimado?: number;
      observacao?: string;
      criadoPorUserId: string;
      projectId?: string;
    }) => {
      const created = await createRequisicaoRemote(input);
      setRequisicoes((current) => [created, ...current]);
      return created;
    },
    [],
  );

  const updateRequisicao = useCallback(
    async (
      id: string,
      patch: Partial<{
        item: string;
        quantidade: number;
        valorEstimado: number | null;
        observacao: string | null;
        status: RequisicaoStatus;
        projectId: string | null;
      }>,
    ) => {
      const updated = await updateRequisicaoRemote(id, patch);
      setRequisicoes((current) => current.map((r) => (r.id === id ? updated : r)));
      return updated;
    },
    [],
  );

  const avancarStatus = useCallback(async (id: string, status: RequisicaoStatus) => {
    const updated = await avancarStatusRequisicao(id, status);
    setRequisicoes((current) => current.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const deleteRequisicao = useCallback(async (id: string) => {
    await deleteRequisicaoRemote(id);
    setRequisicoes((current) => current.filter((r) => r.id !== id));
  }, []);

  return { requisicoes, loaded, createRequisicao, updateRequisicao, avancarStatus, deleteRequisicao };
}
