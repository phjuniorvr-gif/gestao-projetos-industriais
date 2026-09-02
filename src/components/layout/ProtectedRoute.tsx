import { Navigate, Outlet } from 'react-router-dom';
import { Skeleton } from '../ui';
import { useAuth, PipelinesProvider, ProjectsProvider } from '../../hooks';

/** `ProjectsProvider`/`PipelinesProvider` montados uma vez aqui (não em `App.tsx` — só depois de
 * confirmar sessão, mesmo raciocínio de sempre: nenhum fetch de dado do app antes de saber que
 * tem usuário logado) — toda página e o `Sidebar`/`MobileTabBar` passam a enxergar a MESMA
 * instância viva de `useProjects()`/`usePipelines()`, em vez de cada um buscar sua própria cópia
 * (era por isso que o badge de "Confirmações"/"Pipeline" no menu não atualizava sem F5). */
export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return (
    <ProjectsProvider>
      <PipelinesProvider>
        <Outlet />
      </PipelinesProvider>
    </ProjectsProvider>
  );
}
