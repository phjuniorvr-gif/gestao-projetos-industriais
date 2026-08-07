import { useCallback, useEffect, useState } from 'react';
import { deleteProjectRemote, fetchDeletedProjects, restoreProjectRemote } from '../services/projectsRepo';
import type { Project } from '../types';

export function useDeletedProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    fetchDeletedProjects()
      .then(setProjects)
      .catch((err) => console.error('Falha ao carregar projetos excluídos do Supabase', err))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const restoreProject = useCallback(
    (projectId: string) => {
      setProjects((current) => current.filter((p) => p.id !== projectId));
      restoreProjectRemote(projectId).catch((err) => console.error('Falha ao restaurar projeto no Supabase', err));
    },
    [],
  );

  const permanentlyDeleteProject = useCallback((projectId: string) => {
    setProjects((current) => current.filter((p) => p.id !== projectId));
    deleteProjectRemote(projectId).catch((err) => console.error('Falha ao excluir projeto no Supabase', err));
  }, []);

  return { projects, loaded, restoreProject, permanentlyDeleteProject };
}
