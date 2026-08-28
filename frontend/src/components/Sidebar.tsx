import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useCourseLearnStore } from '../store/courseLearn';
import { platformSettingsApi, supportApi } from '../api';
import { SupportSocketClient } from '../services/realtime/supportSocket';

const SUPPORT_ICON = 'M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l.8-3.6A7.94 7.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z';
const SUPPORT_REFRESH_MS = 20_000;

const navItems = [
  { to: '/courses', label: 'Курсы', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { to: '/tasks', label: 'Задачи', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: '/', label: 'Прогресс', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

const adminItems = [
  { to: '/admin/users', label: 'Пользователи', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z' },
  { to: '/admin/courses', label: 'Курсы (админ)', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  { to: '/admin/tasks', label: 'Задачи (админ)', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: '/admin/links', label: 'Ссылки', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
  { to: '/admin/settings', label: 'Настройки', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z' },
  { to: '/admin/metrics', label: 'Метрики', icon: 'M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3' },
];

function StatusDot({ status }: { status?: 'not_started' | 'in_progress' | 'completed' }) {
  if (status === 'completed')
    return (
      <span className="w-4 h-4 shrink-0 rounded-full bg-green-500 flex items-center justify-center">
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  if (status === 'in_progress')
    return (
      <span className="w-4 h-4 shrink-0 rounded-full border-2 border-primary-400 bg-primary-900 flex items-center justify-center">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
      </span>
    );
  return <span className="w-4 h-4 shrink-0 rounded-full border-2 border-dark-600" />;
}

interface SidebarProps {
  // Вызывается после перехода по ссылке/выбора задачи — закрывает мобильный drawer.
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const isGuest = user?.is_guest ?? false;
  // Гостю доступны только курсы — остальные разделы скрываем.
  const visibleNavItems = isGuest ? navItems.filter((i) => i.to === '/courses') : navItems;

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    platformSettingsApi.getLogo().then(({ data }) => setLogoUrl(data.url)).catch(() => {});
  }, []);

  // Счётчик непрочитанных обращений поддержки (только для админа).
  const [supportUnread, setSupportUnread] = useState(0);
  const onSupportPage = location.pathname.startsWith('/admin/support');
  useEffect(() => {
    if (!isAdmin) return;
    const load = () => supportApi.adminUnreadCount().then(({ data }) => setSupportUnread(data.unread)).catch(() => {});
    load();
    const id = setInterval(load, SUPPORT_REFRESH_MS);
    return () => clearInterval(id);
  }, [isAdmin, onSupportPage]);

  useEffect(() => {
    if (!isAdmin || !token) return;
    const socket = new SupportSocketClient({
      token,
      onNewMessage: () => {
        supportApi.adminUnreadCount().then(({ data }) => setSupportUnread(data.unread)).catch(() => {});
      },
    });
    socket.start();
    return () => socket.stop();
  }, [isAdmin, token]);

  const {
    courseId,
    courseTitle,
    coursePrice,
    sidebarItems,
    selectedTaskId,
    completedCount,
    totalCount,
    clear: clearCourse,
  } = useCourseLearnStore();


  const isCourseMode = !!courseId;

  // Закрываем мобильный drawer при переходе на другой маршрут.
  useEffect(() => {
    onNavigate?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleLogout = () => {
    if (!window.confirm('Вы точно хотите выйти?')) return;
    logout();
    navigate('/login');
  };

  const handleSelectTask = (taskId: number) => {
    navigate(`/course/${courseId}?task=${taskId}`);
    onNavigate?.();
  };

  return (
    <aside data-tour="sidebar" className="sf-sidebar w-64 bg-dark-900 text-white h-screen sticky top-0 flex flex-col overflow-y-auto">
      {/* Логотип */}
      <div className="p-4 border-b border-dark-700 flex items-center justify-center">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="max-h-12 object-contain" />
        ) : (
          <span className="text-lg font-bold text-white tracking-wide">Платформа</span>
        )}
      </div>

      {isCourseMode ? (
        /* ── Режим курса: дерево вместо навигации ── */
        <nav className="flex-1 flex flex-col overflow-hidden">
          {/* Кнопка "Все курсы" + название */}
          <div className="px-4 pt-3 pb-2 border-b border-dark-700">
            <button
              onClick={() => { clearCourse(); navigate('/courses'); }}
              className="text-xs text-surface-400 hover:text-white transition-colors mb-2 flex items-center gap-1"
            >
              ← Все курсы
            </button>
            <div className="text-sm font-semibold text-white leading-snug line-clamp-2">
              {courseTitle}
            </div>
            {totalCount > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-surface-400 mb-1">
                  <span>Прогресс по курсу</span>
                  <span className="text-surface-300 font-medium">{completedCount}/{totalCount}</span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalCount ? (completedCount / totalCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Плоский список */}
          <div className="flex-1 overflow-y-auto py-2">
            {sidebarItems.map((item) => {
              if (item.kind === 'section') {
                return (
                  <div
                    key={`s-${item.nodeId}-${item.number}`}
                    className="px-4 pt-3 pb-1"
                    style={{ paddingLeft: `${16 + item.depth * 8}px` }}
                  >
                    <span className="text-xs font-bold text-surface-400 uppercase tracking-wide">
                      {item.number}&nbsp;{item.label}
                    </span>
                  </div>
                );
              }
              const isActive = item.taskId === selectedTaskId;
              return (
                <button
                  key={`t-${item.nodeTaskId}`}
                  type="button"
                  onClick={() => item.taskId && handleSelectTask(item.taskId)}
                  className={`w-full flex items-center gap-2 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-surface-200 hover:bg-dark-700'
                  }`}
                  style={{ paddingLeft: `${16 + item.depth * 8}px`, paddingRight: '12px' }}
                >
                  {item.locked ? (
                    <svg className="w-4 h-4 shrink-0 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : (
                    <StatusDot status={item.status} />
                  )}
                  <span className={`truncate flex-1 ${item.locked ? 'text-surface-500' : ''}`}>
                    <span className={`mr-1 text-xs ${isActive ? 'text-primary-200' : 'text-surface-500'}`}>
                      {item.number}
                    </span>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      ) : (
        /* ── Обычная навигация ── */
        <nav className="flex-1 py-4">
          <div className="px-3 mb-2 text-xs font-semibold text-surface-300 uppercase tracking-wider">Обучение</div>
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to} to={item.to} end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-surface-200 hover:bg-dark-700'}`
              }
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <div className="px-3 mt-6 mb-2 text-xs font-semibold text-surface-300 uppercase tracking-wider">Администрирование</div>
              {adminItems.map((item) => (
                <NavLink
                  key={item.to} to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-surface-200 hover:bg-dark-700'}`
                  }
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </NavLink>
              ))}
              <NavLink
                to="/admin/support"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-surface-200 hover:bg-dark-700'}`
                }
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={SUPPORT_ICON} />
                </svg>
                <span className="flex-1">Поддержка</span>
                {supportUnread > 0 && (
                  <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center">
                    {supportUnread}
                  </span>
                )}
              </NavLink>
            </>
          )}
        </nav>
      )}

      {/* Футер */}
      <div className="p-4 border-t border-dark-700 space-y-2">
        {isGuest && (
          <div className="text-xs text-primary-300 font-medium">Демо-режим (гость)</div>
        )}
        <button onClick={handleLogout} className="w-full text-left text-sm text-surface-300 hover:text-white transition-colors">
          {isGuest ? 'Выйти из демо' : 'Выйти'}
        </button>
      </div>
    </aside>
  );
}
