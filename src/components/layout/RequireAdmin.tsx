import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import { Skeleton } from '../ui';
import { canViewAll, usePapel } from '../../hooks';

/**
 * Restringe as rotas que só quem enxerga tudo alcança — `usuario` (`!canViewAll`) só vê
 * "/tarefas-proximas" no app inteiro. `administrador` e `visualizador` (Fase 7+ — enxerga tudo,
 * não escreve nada) passam os dois — quem trava ESCRITA em cada tela é `usePerfil()`
 * (`eh_administrador()`/RLS), não este guard. `undefined` (papel ainda carregando) conta como
 * travado, mesmo padrão do resto do código — evita renderizar a tela protegida por um instante
 * antes de saber o papel de verdade.
 *
 * `useOutletContext()`/`<Outlet context={...}>`: este componente virou uma camada extra de
 * layout ENTRE `MobileLayout` (que passa `{ year, setYear }` pro `<Outlet>` dele) e as páginas
 * mobile (`MobileProjectsPage`/`MobileSchedulePage`, que leem esse contexto via
 * `useOutletContext<MobileOutletContext>()`). Sem repassar explicitamente, o `<Outlet />` daqui
 * criaria um contexto NOVO (`undefined`), e as páginas mobile quebravam ao desestruturar
 * `{ year }` de `undefined` — achado ao investigar tela em branco reportada pelo usuário.
 */
export function RequireAdmin() {
  const papel = usePapel();
  const outletContext = useOutletContext();

  if (papel === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!canViewAll(papel)) return <Navigate to="/tarefas-proximas" replace />;

  return <Outlet context={outletContext} />;
}
