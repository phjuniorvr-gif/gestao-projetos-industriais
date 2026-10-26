import { Link, useLocation } from 'react-router-dom';
import { CalendarClock, CalendarRange, ClipboardList, LayoutDashboard, Ship, Workflow, type LucideIcon } from 'lucide-react';
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

  // 'usuario' fica restrito a "Tarefas" + "Requisições" (pedido seguinte — "liberar a aba pra todo
  // mundo", `canViewRequisicoes` agora inclui `usuario`); 'comprador' fica restrito a "Importação"
  // + "Requisições" (sessão 2026-10-13 — avançar aprovada→comprada→recebida é tarefa dele,
  // provável de acontecer pelo celular); 'gestor_requisicoes' (mesma sessão) fica restrito a
  // "Importação" + "Requisições" + "Tarefas" — administrador e visualizador (Fase 7+) enxergam a
  // barra inteira. Mesmo raciocínio do Sidebar desktop: checa cada papel explícito pra não
  // estreitar a barra por um instante enquanto o papel ainda não resolveu. Sem aba "Projetos" nem
  // "Equipe" — a pedido do usuário, não precisa delas no mobile (a rota `/equipe` continua
  // existindo, só sem entrada direta na barra). "Pipeline" (a pedido do usuário) segue a mesma
  // exceção de permissão do desktop (administrador OU visualizador, não é admin-only). Requisições
  // não tem layout mobile dedicado ainda (decisão da sessão — "só desktop por agora"), mas o grid
  // já é responsivo (mesma técnica do Kanban da Importação/Equipe), então funciona sem ajuste
  // nenhum, só não é otimizado.
  const tabItems: TabItem[] =
    papel === 'usuario'
      ? [
          { to: '/tarefas-proximas', label: 'Tarefas', icon: CalendarClock, isActive: (p) => p === '/tarefas-proximas' },
          { to: '/requisicoes', label: 'Requisições', icon: ClipboardList, isActive: (p) => p === '/requisicoes' },
        ]
      : papel === 'comprador'
        ? [
            { to: '/importacao', label: 'Importação', icon: Ship, isActive: (p) => p === '/importacao' },
            { to: '/requisicoes', label: 'Requisições', icon: ClipboardList, isActive: (p) => p === '/requisicoes' },
          ]
        : papel === 'gestor_requisicoes'
          ? [
              { to: '/importacao', label: 'Importação', icon: Ship, isActive: (p) => p === '/importacao' },
              { to: '/requisicoes', label: 'Requisições', icon: ClipboardList, isActive: (p) => p === '/requisicoes' },
              { to: '/tarefas-proximas', label: 'Tarefas', icon: CalendarClock, isActive: (p) => p === '/tarefas-proximas' },
            ]
          : [
            {
              to: '/dashboard',
              label: 'Resumo',
              icon: LayoutDashboard,
              isActive: (p) => p === '/dashboard',
            },
            {
              to: '/pipeline',
              label: 'Pipeline',
              icon: Workflow,
              isActive: (p) => p.startsWith('/pipeline'),
            },
            {
              to: '/cronograma',
              label: 'Cronograma',
              icon: CalendarRange,
              isActive: (p) => p.includes('/cronograma'),
            },
            {
              to: '/importacao',
              label: 'Importação',
              icon: Ship,
              isActive: (p) => p === '/importacao',
            },
            {
              to: '/tarefas-proximas',
              label: 'Tarefas',
              icon: CalendarClock,
              isActive: (p) => p === '/tarefas-proximas',
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
