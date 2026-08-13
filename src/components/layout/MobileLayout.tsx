import { Outlet, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { MobileTabBar } from './MobileTabBar';
import { useAuth } from '../../hooks';

const TITLE_BY_PATH: { test: (pathname: string) => boolean; title: string }[] = [
  { test: (p) => p === '/dashboard', title: 'Resumo' },
  { test: (p) => p === '/' || p === '/projetos' || p === '/novo-projeto', title: 'Projetos' },
  { test: (p) => p.includes('/cronograma'), title: 'Cronograma' },
  { test: (p) => p === '/equipe', title: 'Equipe' },
];

export function MobileLayout() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const title = TITLE_BY_PATH.find((entry) => entry.test(pathname))?.title ?? 'Projetos';

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header
        className="sticky top-0 z-30 flex min-h-11 items-center justify-between border-b border-border bg-card px-4 py-2"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
      >
        <p className="text-base font-bold text-text">{title}</p>
        <button
          type="button"
          onClick={() => signOut()}
          aria-label="Sair"
          title="Sair"
          className="flex h-11 w-11 items-center justify-center text-text-muted hover:text-text"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        <Outlet />
      </main>

      <MobileTabBar />
    </div>
  );
}
