import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { FilterSelect } from '../projects';
import { MobileTabBar } from './MobileTabBar';
import { useAuth, useProjects } from '../../hooks';

const TITLE_BY_PATH: { test: (pathname: string) => boolean; title: string }[] = [
  { test: (p) => p === '/dashboard', title: 'Resumo Próximos 90 dias' },
  { test: (p) => p === '/' || p === '/projetos' || p === '/novo-projeto', title: 'Projetos' },
  { test: (p) => p.includes('/cronograma'), title: 'Cronograma' },
  { test: (p) => p === '/equipe', title: 'Equipe' },
];

/** Filtro de ano só faz sentido nas duas abas com lista de projeto (Projetos/Cronograma) —
 * Resumo e Equipe não têm essa noção de "ano do projeto" na tela. */
function showsYearFilter(pathname: string): boolean {
  return pathname === '/' || pathname === '/projetos' || pathname.includes('/cronograma');
}

export interface MobileOutletContext {
  /** Ano selecionado no cabeçalho (string vazia = "Todos"). Só populado nas rotas que mostram o
   * seletor — as demais páginas simplesmente não leem esse valor do outlet context. */
  year: string;
  /** Pra "Limpar filtro" da página também zerar o ano, já que o seletor mora no cabeçalho
   * (`MobileLayout`), fora da própria página. */
  setYear: (year: string) => void;
}

/** Barra de abas embaixo, igual à Fase 6 original (sidebar e barra de abas não convivem numa
 * árvore só — tentativa de barra lateral revertida a pedido do usuário). Cabeçalho e barra de
 * abas ganharam a cor navy do Sidebar desktop, também a pedido do usuário. */
export function MobileLayout() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const { projects } = useProjects();
  const [year, setYear] = useState('');
  const title = TITLE_BY_PATH.find((entry) => entry.test(pathname))?.title ?? 'Projetos';
  const years = useMemo(
    () =>
      Array.from(new Set(projects.map((p) => p.plannedStart?.slice(0, 4)).filter((y): y is string => Boolean(y)))).sort(),
    [projects],
  );

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header
        className="sticky top-0 z-30 flex min-h-11 items-center justify-between gap-2 bg-gradient-to-b from-sidebar to-sidebar-dark px-4 py-2"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
      >
        <p className="min-w-0 truncate text-base font-bold text-white">{title}</p>
        <div className="flex shrink-0 items-center gap-1">
          {showsYearFilter(pathname) && (
            <FilterSelect label="Ano" value={year} onChange={setYear} options={years} className="min-h-11 w-32" />
          )}
          <button
            type="button"
            onClick={() => signOut()}
            aria-label="Sair"
            title="Sair"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-white/80 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        <Outlet context={{ year, setYear } satisfies MobileOutletContext} />
      </main>

      {/* key=pathname: useProjects() não tem store compartilhado (nenhuma página do app tem —
          cada uma busca fresco no mount, mesmo padrão de ProjectsPage/DashboardPage). Sem isso,
          MobileTabBar (dentro do layout persistente, nunca desmonta ao trocar de aba) buscaria só
          uma vez por sessão e o badge de atrasados nunca atualizaria depois de uma ação. */}
      <MobileTabBar key={pathname} />
    </div>
  );
}
