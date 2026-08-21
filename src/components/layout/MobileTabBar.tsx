import { Link, useLocation } from 'react-router-dom';
import { CalendarRange, FolderKanban, LayoutDashboard, Users } from 'lucide-react';
import { useProjects } from '../../hooks';
import { computeStatusDistribution } from '../../utils/portfolio';

interface TabItem {
  to: string;
  label: string;
  icon: typeof FolderKanban;
  isActive: (pathname: string) => boolean;
  /** Só a aba Projetos tem badge — contagem de atrasados (mesmo dado da faixa de saúde). */
  badgeCount?: number;
}

export function MobileTabBar() {
  const { pathname } = useLocation();
  const { projects } = useProjects();
  const delayedCount = computeStatusDistribution(projects).find((d) => d.status === 'delayed')?.count ?? 0;

  const tabItems: TabItem[] = [
    {
      to: '/dashboard',
      label: 'Resumo',
      icon: LayoutDashboard,
      isActive: (p) => p === '/dashboard',
    },
    {
      to: '/projetos',
      label: 'Projetos',
      icon: FolderKanban,
      isActive: (p) => p === '/' || p === '/projetos' || p === '/novo-projeto',
      badgeCount: delayedCount,
    },
    {
      to: '/cronograma',
      label: 'Cronograma',
      icon: CalendarRange,
      isActive: (p) => p.includes('/cronograma'),
    },
    {
      to: '/equipe',
      label: 'Equipe',
      icon: Users,
      isActive: (p) => p === '/equipe',
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex bg-gradient-to-b from-sidebar to-sidebar-dark"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabItems.map((item) => {
        const active = item.isActive(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold ${
              active ? 'text-white' : 'text-white/60'
            }`}
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {!!item.badgeCount && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-delayed px-1 text-[9px] font-bold text-white">
                  {item.badgeCount}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
