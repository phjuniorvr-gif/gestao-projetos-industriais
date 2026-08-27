import { Navigate, Outlet } from 'react-router-dom';
import { Skeleton } from '../ui';
import { usePerfil } from '../../hooks';

/**
 * Restringe as rotas admin-only — usuário comum (`isAdmin !== true`) só enxerga
 * "/tarefas-proximas" no app inteiro (pedido do usuário). `undefined` (papel ainda carregando)
 * conta como travado, mesmo padrão de `isAdmin` usado no resto do código — evita renderizar a
 * tela protegida por um instante antes de saber o papel de verdade.
 */
export function RequireAdmin() {
  const isAdmin = usePerfil();

  if (isAdmin === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/tarefas-proximas" replace />;

  return <Outlet />;
}
