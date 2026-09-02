import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPipeline as createPipelineRemote, deletePipeline as deletePipelineRemote, fetchPipelines } from '../services/pipelinesRepo';
import type { Pipeline } from '../types';

/** Interna — não exportada diretamente. `useProjects.ts` tem o mesmo raciocínio comentado com
 * mais detalhe: sem Context, cada tela teria sua própria cópia de `pipelines`, e criar/excluir um
 * item não atualizaria o badge do menu lateral até um F5. */
function usePipelinesState() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchPipelines()
      .then(setPipelines)
      .catch((err) => console.error('Falha ao carregar pipelines do Supabase', err))
      .finally(() => setLoaded(true));
  }, []);

  const createPipeline = useCallback(async (input: { name: string; description?: string; unit: string }) => {
    const created = await createPipelineRemote(input);
    setPipelines((current) => [created, ...current]);
    return created;
  }, []);

  const deletePipeline = useCallback(async (id: string) => {
    await deletePipelineRemote(id);
    setPipelines((current) => current.filter((p) => p.id !== id));
  }, []);

  return { pipelines, loaded, createPipeline, deletePipeline };
}

const PipelinesContext = createContext<ReturnType<typeof usePipelinesState> | undefined>(undefined);

export function PipelinesProvider({ children }: { children: ReactNode }) {
  const state = usePipelinesState();
  return createElement(PipelinesContext.Provider, { value: state }, children);
}

export function usePipelines() {
  const ctx = useContext(PipelinesContext);
  if (!ctx) throw new Error('usePipelines precisa ser chamado dentro de <PipelinesProvider>.');
  return ctx;
}
