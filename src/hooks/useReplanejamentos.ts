import { useCallback, useEffect, useState } from 'react';
import { fetchReplanejamentos } from '../services/projectsRepo';
import type { Replanejamento } from '../types';

/** Auditoria de replanejamento (Fase 2.5) — mesmo formato de `useHolidays`. `refetch` é chamado
 * depois de `replanTask` gravar novas entradas, pra não esperar o próximo mount/reload. */
export function useReplanejamentos() {
  const [replanejamentos, setReplanejamentos] = useState<Replanejamento[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(() => {
    return fetchReplanejamentos()
      .then(setReplanejamentos)
      .catch((err) => console.error('Falha ao carregar histórico de replanejamento do Supabase', err));
  }, []);

  useEffect(() => {
    refetch().finally(() => setLoaded(true));
  }, [refetch]);

  return { replanejamentos, loaded, refetch };
}
