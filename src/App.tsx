import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout, MobileLayout, ProtectedRoute, RequireAccess } from './components/layout';
import {
  ActivitiesPage,
  CategoriesPage,
  DashboardPage,
  DeletedProjectsPage,
  LoginPage,
  NewPipelinePage,
  NewProjectPage,
  PendingConfirmationsPage,
  PipelinesPage,
  ProjectSchedulePage,
  ProjectsPage,
  SettingsPage,
  TeamKanbanPage,
  UpcomingTasksPage,
} from './pages';
import { MobileDashboardPage, MobilePipelinesPage, MobileProjectsPage, MobileSchedulePage, MobileTeamPage, MobileUpcomingTasksPage } from './pages/mobile';
import { canViewAll, canViewImportacao, useIsMobile } from './hooks';

export default function App() {
  const isMobile = useIsMobile();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={isMobile ? <MobileLayout /> : <AppLayout />}>
            {/* Único caminho aberto pra usuário comum (RequireAccess allow={canViewAll} barra o
                resto) — pedido do usuário: login sem papel administrador só enxerga esta tela. */}
            <Route path="tarefas-proximas" element={isMobile ? <MobileUpcomingTasksPage /> : <UpcomingTasksPage />} />
            {/* Único caminho aberto pro comprador (RequireAccess allow={canViewImportacao} barra o
                resto) — pedido do usuário: login com papel Comprador só enxerga esta tela. */}
            <Route element={<RequireAccess allow={canViewImportacao} />}>
              <Route path="importacao" element={<ProjectSchedulePage />} />
            </Route>
            <Route element={<RequireAccess allow={canViewAll} />}>
              <Route index element={<Navigate to="/projetos" replace />} />
              <Route path="projetos" element={isMobile ? <MobileProjectsPage /> : <ProjectsPage />} />
              <Route path="novo-projeto" element={<NewProjectPage />} />
              <Route path="pipeline" element={isMobile ? <MobilePipelinesPage /> : <PipelinesPage />} />
              <Route path="pipeline/novo" element={<NewPipelinePage />} />
              <Route path="dashboard" element={isMobile ? <MobileDashboardPage /> : <DashboardPage />} />
              <Route path="cronograma" element={isMobile ? <MobileSchedulePage /> : <ProjectSchedulePage />} />
              <Route path="projetos/:id/cronograma" element={<ProjectSchedulePage />} />
              {/* Desktop: Kanban da Equipe (pedido do usuário) — admin-only, guarda própria dentro
                  do componente (mesmo padrão de `NewProjectPage.tsx`), já que este grupo
                  `canViewAll` também libera visualizador. Mobile continua com `MobileTeamPage`
                  (Fase 6, admin+visualizador). */}
              <Route path="equipe" element={isMobile ? <MobileTeamPage /> : <TeamKanbanPage />} />
              <Route path="confirmacoes" element={<PendingConfirmationsPage />} />
              <Route path="atividades" element={<ActivitiesPage />} />
              <Route path="categorias" element={<CategoriesPage />} />
              <Route path="excluidos" element={<DeletedProjectsPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
