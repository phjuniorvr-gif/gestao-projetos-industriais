import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar />
      <main className="flex-1 min-w-0 px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
