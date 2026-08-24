import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import SupportWidget from './SupportWidget';
import { authApi } from '../api';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Пинг активности при загрузке приложения — для метрик сессий.
  // Бэкенд сам решает, считать ли это новой сессией (простой > 30 мин).
  useEffect(() => {
    authApi.activityPing().catch(() => {});
  }, []);

  // Гостевой тур (GuestFirstTaskTour) на первом шаге подсвечивает сайдбар —
  // на мобильном он по умолчанию скрыт за гамбургером, поэтому тур просит
  // раскрыть его на время этого шага через кастомное событие.
  useEffect(() => {
    const onTourSidebar = (e: Event) => {
      setSidebarOpen((e as CustomEvent<boolean>).detail);
    };
    window.addEventListener('guest-tour:sidebar', onTourSidebar);
    return () => window.removeEventListener('guest-tour:sidebar', onTourSidebar);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Мобильная шапка с гамбургером — сайдбар на md+ виден постоянно */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-white border-b border-surface-200">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Открыть меню"
            className="w-9 h-9 -ml-1 rounded-lg text-dark-700 hover:bg-surface-100 flex items-center justify-center shrink-0"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-dark-800 truncate">Платформа</span>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
      <SupportWidget />
    </div>
  );
}
