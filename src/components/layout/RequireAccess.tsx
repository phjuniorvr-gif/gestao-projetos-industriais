import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import { Skeleton } from '../ui';
import { usePapel } from '../../hooks';
import type { Papel } from '../../types';

interface RequireAccessProps {
  /** Decide se o papel atual pode entrar — `canViewAll` (administrador/visualizador) ou
   * `canViewImportacao` (os dois + comprador), conforme o bloco de rotas. */
  allow: (papel: Papel | undefined) => boolean;
}

/**
 * Guard de rota genérico (era `RequireAdmin`, um componente só pra `canViewAll` — generalizado
 * pra aceitar qualquer checagem de papel via prop `allow`, em vez de duplicar este componente
 * inteiro pra cada nova exceção de navegação como `comprador`/Importação). `undefined` (papel
 * ainda carregando) conta como travado, mesmo padrão fail-closed do resto do código — evita
 * renderizar a tela protegida por um instante antes de saber o papel de verdade.
 *
 * Quem é barrado volta pra "/importacao" (comprador) ou "/tarefas-proximas" (qualquer outro papel
 * sem acesso, hoje só 'usuario') — a única página que esse papel de fato alcança.
 *
 * `useOutletContext()`/`<Outlet context={...}>`: este componente é uma camada extra de layout
 * ENTRE `MobileLayout` (que passa `{ year, setYear }` pro `<Outlet>` dele) e as páginas mobile
 * (`MobileProjectsPage`/`MobileSchedulePage`, que leem esse contexto via
 * `useOutletContext<MobileOutletContext>()`). Sem repassar explicitamente, o `<Outlet />` daqui
 * criaria um contexto NOVO (`undefined`), e as páginas mobile quebravam ao desestruturar
 * `{ year }` de `undefined` — achado ao investigar tela em branco reportada pelo usuário.
 */
export function RequireAccess({ allow }: RequireAccessProps) {
  const papel = usePapel();
  const outletContext = useOutletContext();

  if (papel === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!allow(papel)) return <Navigate to={papel === 'comprador' ? '/importacao' : '/tarefas-proximas'} replace />;

  return <Outlet context={outletContext} />;
}
