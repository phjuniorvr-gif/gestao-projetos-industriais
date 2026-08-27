import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout, MobileLayout, ProtectedRoute, RequireAdmin } from './components/layout';
import {
  ActivitiesPage,
  CategoriesPage,
  DashboardPage,
  DeletedProjectsPage,
  LoginPage,
  NewProjectPage,
  ProjectSchedulePage,
  ProjectsPage,
  SettingsPage,
  UpcomingTasksPage,
} from './pages';
import { MobileDashboardPage, MobileProjectsPage, MobileSchedulePage, MobileTeamPage } from './pages/mobile';
import { useIsMobile } from './hooks';

export default function App() {
  const isMobile = useIsMobile();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={isMobile ? <MobileLayout /> : <AppLayout />}>
            {/* Único caminho aberto pra usuário comum (RequireAdmin barra o resto) — pedido do
                usuário: login sem papel administrador só enxerga esta tela. */}
            <Route path="tarefas-proximas" element={<UpcomingTasksPage />} />
            <Route element={<RequireAdmin />}>
              <Route index element={<Navigate to="/projetos" replace />} />
              <Route path="projetos" element={isMobile ? <MobileProjectsPage /> : <ProjectsPage />} />
              <Route path="novo-projeto" element={<NewProjectPage />} />
              <Route path="dashboard" element={isMobile ? <MobileDashboardPage /> : <DashboardPage />} />
              <Route path="cronograma" element={isMobile ? <MobileSchedulePage /> : <ProjectSchedulePage />} />
              <Route path="projetos/:id/cronograma" element={<ProjectSchedulePage />} />
              <Route path="equipe" element={isMobile ? <MobileTeamPage /> : <Navigate to="/dashboard" replace />} />
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
