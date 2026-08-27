import { Link, useLocation } from 'react-router-dom';
import { CalendarClock, CalendarRange, LayoutDashboard, Users, type LucideIcon } from 'lucide-react';
import { usePapel } from '../../hooks';

interface TabItem {
  to: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}

export function MobileTabBar() {
  const { pathname } = useLocation();
  const papel = usePapel();

  // Só 'usuario' fica restrito a "Tarefas" — administrador e visualizador (Fase 7+) enxergam a
  // barra inteira. Mesmo raciocínio do Sidebar desktop: checa `=== 'usuario'` explícito pra não
  // estreitar a barra por um instante enquanto o papel ainda não resolveu. Sem aba "Projetos" —
  // a pedido do usuário, não precisa dela no mobile.
  const tabItems: TabItem[] =
    papel === 'usuario'
      ? [{ to: '/tarefas-proximas', label: 'Tarefas', icon: CalendarClock, isActive: (p) => p === '/tarefas-proximas' }]
      : [
          {
            to: '/dashboard',
            label: 'Resumo',
            icon: LayoutDashboard,
            isActive: (p) => p === '/dashboard',
          },
          {
            to: '/cronograma',
            label: 'Cronograma',
            icon: CalendarRange,
            isActive: (p) => p.includes('/cronograma'),
          },
          {
            to: '/tarefas-proximas',
            label: 'Tarefas',
            icon: CalendarClock,
            isActive: (p) => p === '/tarefas-proximas',
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
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
