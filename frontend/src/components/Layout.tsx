import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import SupportWidget from './SupportWidget';
import { authApi } from '../api';

export default function Layout() {
  // Пинг активности при загрузке приложения — для метрик сессий.
  // Бэкенд сам решает, считать ли это новой сессией (простой > 30 мин).
  useEffect(() => {
    authApi.activityPing().catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
      <SupportWidget />
    </div>
  );
}
