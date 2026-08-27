import { useCallback, useEffect, useState } from 'react';
import { createPipeline as createPipelineRemote, deletePipeline as deletePipelineRemote, fetchPipelines } from '../services/pipelinesRepo';
import type { Pipeline } from '../types';

export function usePipelines() {
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
