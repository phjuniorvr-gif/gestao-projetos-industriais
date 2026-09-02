import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarClock, CalendarRange, FolderKanban, KeyRound, LayoutDashboard, ListChecks, LogOut, Menu, Settings, Tag, Trash2, UserCheck, Workflow } from 'lucide-react';
import { AppLogo, ChangePasswordDialog } from '../ui';
import { useAuth, usePapel, usePipelines, useProjects } from '../../hooks';

interface NavItem {
  to: string;
  label: string;
  icon: typeof FolderKanban;
  isActive: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/projetos',
    label: 'Projetos',
    icon: FolderKanban,
    isActive: (pathname) => pathname === '/' || pathname === '/projetos' || pathname === '/novo-projeto',
  },
  {
    to: '/pipeline',
    label: 'Pipeline',
    icon: Workflow,
    isActive: (pathname) => pathname.startsWith('/pipeline'),
  },
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    isActive: (pathname) => pathname === '/dashboard',
  },
  {
    to: '/cronograma',
    label: 'Cronograma',
    icon: CalendarRange,
    isActive: (pathname) => pathname.includes('/cronograma'),
  },
  {
    to: '/tarefas-proximas',
    label: 'Tarefas por vencer',
    icon: CalendarClock,
    isActive: (pathname) => pathname === '/tarefas-proximas',
  },
  {
    to: '/confirmacoes',
    label: 'Confirmações',
    icon: UserCheck,
    isActive: (pathname) => pathname === '/confirmacoes',
  },
];

// Itens de configuração/manutenção, separados do fluxo principal (a pedido do usuário) — ficam
// mais abaixo, perto do e-mail/rodapé, em vez de misturados com a navegação do dia a dia.
const SECONDARY_NAV_ITEMS: NavItem[] = [
  {
    to: '/atividades',
    label: 'Atividades',
    icon: ListChecks,
    isActive: (pathname) => pathname === '/atividades',
  },
  {
    to: '/categorias',
    label: 'Categorias',
    icon: Tag,
    isActive: (pathname) => pathname === '/categorias',
  },
  {
    to: '/excluidos',
    label: 'Excluídos',
    icon: Trash2,
    isActive: (pathname) => pathname === '/excluidos',
  },
  {
    to: '/configuracoes',
    label: 'Configurações',
    icon: Settings,
    isActive: (pathname) => pathname === '/configuracoes',
  },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { session, signOut } = useAuth();
  const papel = usePapel();
  const { projects } = useProjects();
  const { pipelines } = usePipelines();
  const [changingPassword, setChangingPassword] = useState(false);
  // Badge em "Confirmações" — mesma contagem que popula PendingConfirmationsPage.tsx, calculada
  // aqui de novo (sem store compartilhado nesta app, ver useUpcomingTasksData.ts) só pra saber o
  // número sem montar a tela inteira.
  const pendingConfirmationCount = projects.reduce(
    (sum, p) => sum + p.activities.reduce((s, a) => s + a.tasks.filter((t) => t.pendingConfirmation).length, 0),
    0,
  );
  // Badge em "Pipeline" (a pedido do usuário, mesmo padrão de "Confirmações") — quantidade de
  // itens aguardando virar projeto.
  const badgeCountByPath: Record<string, number> = {
    '/confirmacoes': pendingConfirmationCount,
    '/pipeline': pipelines.length,
  };
  // Só 'usuario' fica restrito a "Tarefas por vencer" — administrador e visualizador (Fase 7+)
  // enxergam o menu inteiro. Checa `=== 'usuario'` explícito (não o inverso de canViewAll) pra
  // não estreitar o menu por um instante a cada carregamento de página, enquanto o papel ainda
  // não resolveu (`undefined` conta como "mostra tudo", igual admin/visualizador já resolvidos).
  const navItems = papel === 'usuario' ? NAV_ITEMS.filter((item) => item.to === '/tarefas-proximas') : NAV_ITEMS;
  const secondaryItems = papel === 'usuario' ? [] : SECONDARY_NAV_ITEMS;

  function renderNavItem(item: NavItem) {
    const active = item.isActive(pathname);
    const Icon = item.icon;
    const badgeCount = badgeCountByPath[item.to] ?? 0;
    return (
      <Link
        key={item.label}
        to={item.to}
        title={collapsed ? item.label : undefined}
        className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
          collapsed ? 'justify-center px-0' : ''
        } ${active ? 'bg-white/[.18] text-white' : 'text-white hover:bg-white/10'}`}
      >
        <span className="relative shrink-0">
          <Icon className="h-4 w-4" />
          {badgeCount > 0 && collapsed && (
            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-status-delayed text-[8px] font-bold text-white">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="truncate whitespace-nowrap">{item.label}</span>
            {badgeCount > 0 && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-status-delayed px-1 text-[11px] font-bold text-white">
                {badgeCount}
              </span>
            )}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col bg-gradient-to-b from-sidebar to-sidebar-dark text-white shadow-lg transition-[width] duration-200 ${
        collapsed ? 'w-[76px]' : 'w-[250px]'
      }`}
    >
      <div className={`flex h-16 items-center gap-3 border-b border-white/15 bg-white/5 px-[18px] ${collapsed ? 'justify-center px-0' : ''}`}>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/15 hover:bg-white/25"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        {!collapsed && (
          <div className="flex min-w-0 items-center gap-2">
            <AppLogo className="h-7 w-7 shrink-0" />
            <p className="whitespace-nowrap text-lg font-extrabold">Projetos</p>
          </div>
        )}
      </div>

      <div className="px-2.5 py-4">
        {!collapsed && (
          <p className="px-2.5 pb-2.5 pt-2 text-[11px] uppercase tracking-wider text-white/70">Páginas</p>
        )}
        <nav className="flex flex-col gap-1.5">{navItems.map(renderNavItem)}</nav>
      </div>

      <div className="mt-auto px-2.5 py-4">
        {secondaryItems.length > 0 && (
          <nav className="mb-2 flex flex-col gap-1.5 border-t border-white/15 pt-3">{secondaryItems.map(renderNavItem)}</nav>
        )}
        {!collapsed && session?.user.email && (
          <p className="truncate px-3 pb-2 text-xs text-white/60" title={session.user.email}>
            {session.user.email}
          </p>
        )}
        <button
          type="button"
          onClick={() => setChangingPassword(true)}
          title={collapsed ? 'Trocar senha' : undefined}
          className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10 ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <KeyRound className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">Trocar senha</span>}
        </button>
        <button
          type="button"
          onClick={() => signOut()}
          title={collapsed ? 'Sair' : undefined}
          className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10 ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">Sair</span>}
        </button>
      </div>

      <ChangePasswordDialog open={changingPassword} onClose={() => setChangingPassword(false)} />
    </aside>
  );
}
