import { useCallback, useEffect, useState } from 'react';
import { createAprovador as createAprovadorRemote, fetchAprovadores } from '../services/aprovadoresRepo';
import type { Aprovador } from '../types';

/** Lista PRÓPRIA de aprovadores (sessão de 2026-10-28, pedido do usuário — "não é essa lista
 * [pessoas], será uma lista nova... a pessoa pode criar o aprovador e vai criando a lista"),
 * mesmo padrão simples de `usePeople`/`useRequisicoes` — sem Context, só a `RequisicoesPage.tsx`
 * consome isso hoje. */
export function useAprovadores() {
  const [aprovadores, setAprovadores] = useState<Aprovador[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchAprovadores()
      .then(setAprovadores)
      .catch((err) => console.error('Falha ao carregar aprovadores do Supabase', err))
      .finally(() => setLoaded(true));
  }, []);

  const createAprovador = useCallback(async (name: string) => {
    const created = await createAprovadorRemote(name);
    setAprovadores((current) =>
      current.some((a) => a.id === created.id) ? current : [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    );
    return created;
  }, []);

  return { aprovadores, loaded, createAprovador };
}
