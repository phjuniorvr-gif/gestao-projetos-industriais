import { Link, useLocation } from 'react-router-dom';
import { CalendarRange, FolderKanban, LayoutDashboard, Users } from 'lucide-react';

interface TabItem {
  to: string;
  label: string;
  icon: typeof FolderKanban;
  isActive: (pathname: string) => boolean;
}

const TAB_ITEMS: TabItem[] = [
  {
    to: '/dashboard',
    label: 'Resumo',
    icon: LayoutDashboard,
    isActive: (pathname) => pathname === '/dashboard',
  },
  {
    to: '/projetos',
    label: 'Projetos',
    icon: FolderKanban,
    isActive: (pathname) => pathname === '/' || pathname === '/projetos' || pathname === '/novo-projeto',
  },
  {
    to: '/cronograma',
    label: 'Cronograma',
    icon: CalendarRange,
    isActive: (pathname) => pathname.includes('/cronograma'),
  },
  {
    to: '/equipe',
    label: 'Equipe',
    icon: Users,
    isActive: (pathname) => pathname === '/equipe',
  },
];

export function MobileTabBar() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TAB_ITEMS.map((item) => {
        const active = item.isActive(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold ${
              active ? 'text-action' : 'text-text-muted'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
