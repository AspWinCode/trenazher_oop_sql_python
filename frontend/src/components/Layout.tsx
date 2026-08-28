import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import SupportWidget from './SupportWidget';
import { authApi } from '../api';

const MOBILE_BREAKPOINT = 900;

const MENU_ICON = 'M4 7h16M4 12h16M4 17h16';
const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const COLLAPSE_ICON = 'M14.5 6l-6 6 6 6';

// Просим Monaco (automaticLayout: true) пересчитать раскладку после того,
// как CSS-переход сайдбара (.24s) завершится — иначе редактор может
// остаться со старой шириной контейнера.
function relayoutEditors() {
  window.dispatchEvent(new Event('resize'));
}

export default function Layout() {
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const isMobile = windowWidth <= MOBILE_BREAKPOINT;
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Пинг активности при загрузке приложения — для метрик сессий.
  // Бэкенд сам решает, считать ли это новой сессией (простой > 30 мин).
  useEffect(() => {
    authApi.activityPing().catch(() => {});
  }, []);

  // windowWidth — единственный источник правды про isMobile. Слушаем и
  // 'resize', и ResizeObserver на <html> — в некоторых окружениях/вебвью
  // 'resize' не срабатывает при программном изменении вьюпорта, а
  // ResizeObserver реагирует на изменение самого layout-бокса напрямую.
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    ro?.observe(document.documentElement);
    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, []);

  // При переходе с телефона на десктоп mobile drawer сбрасываем.
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  // Гостевой тур (GuestFirstTaskTour) на первом шаге подсвечивает сайдбар —
  // он может быть скрыт (мобильный drawer) или свёрнут (десктоп), поэтому
  // тур просит временно его раскрыть через кастомное событие.
  useEffect(() => {
    const onTourSidebar = (e: Event) => {
      const wantOpen = (e as CustomEvent<boolean>).detail;
      if (isMobile) setMobileOpen(wantOpen);
      else setDesktopCollapsed(!wantOpen);
    };
    window.addEventListener('guest-tour:sidebar', onTourSidebar);
    return () => window.removeEventListener('guest-tour:sidebar', onTourSidebar);
  }, [isMobile]);

  const closeMobile = () => {
    if (!mobileOpen) return;
    setMobileOpen(false);
    setTimeout(relayoutEditors, 260);
  };

  const handleToggle = () => {
    if (isMobile) setMobileOpen((v) => !v);
    else setDesktopCollapsed((v) => !v);
    setTimeout(relayoutEditors, 60);
    setTimeout(relayoutEditors, 280);
  };

  const opened = isMobile ? mobileOpen : !desktopCollapsed;
  const toggleIcon = isMobile ? (mobileOpen ? CLOSE_ICON : MENU_ICON) : (desktopCollapsed ? MENU_ICON : COLLAPSE_ICON);

  let toggleLeft: string;
  if (isMobile) {
    const drawerWidth = Math.min(windowWidth * 0.86, 320);
    toggleLeft = mobileOpen ? `${Math.max(12, drawerWidth - 54)}px` : '12px';
  } else {
    const sidebarWidth = windowWidth <= 1180 ? 220 : 256;
    toggleLeft = desktopCollapsed ? '12px' : `${sidebarWidth + 12}px`;
  }

  return (
    <div
      className={`sf-shell flex min-h-screen ${!isMobile && desktopCollapsed ? 'sf-sidebar-collapsed' : ''} ${isMobile && mobileOpen ? 'sf-mobile-open' : ''}`}
    >
      <Sidebar onNavigate={closeMobile} />
      <main className="sf-main flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      <button
        id="sf-sidebar-toggle"
        type="button"
        title="Открыть / скрыть меню"
        aria-label="Открыть / скрыть меню"
        aria-expanded={opened}
        style={{ left: toggleLeft }}
        onClick={handleToggle}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d={toggleIcon} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        id="sf-sidebar-overlay"
        className={isMobile && mobileOpen ? 'sf-show' : ''}
        onClick={closeMobile}
        aria-hidden="true"
      />

      <SupportWidget />
    </div>
  );
}
