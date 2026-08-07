import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout';
import {
  ActivitiesPage,
  DashboardPage,
  NewProjectPage,
  ProjectSchedulePage,
  ProjectsPage,
  SettingsPage,
} from './pages';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/projetos" replace />} />
          <Route path="projetos" element={<ProjectsPage />} />
          <Route path="novo-projeto" element={<NewProjectPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="cronograma" element={<ProjectSchedulePage />} />
          <Route path="projetos/:id/cronograma" element={<ProjectSchedulePage />} />
          <Route path="atividades" element={<ActivitiesPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
