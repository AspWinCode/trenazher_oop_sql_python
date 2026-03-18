import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

const navItems = [
  { to: '/tasks', label: 'Задачи', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: '/', label: 'Прогресс', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

const adminItems = [
  { to: '/admin/users', label: 'Пользователи', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z' },
  { to: '/admin/courses', label: 'Курсы (админ)', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  { to: '/admin/tasks', label: 'Задачи (админ)', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: '/admin/links', label: 'Ссылки', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className="w-64 bg-dark-900 text-white min-h-screen flex flex-col">
      <div className="p-5 border-b border-dark-700">
        <h1 className="text-lg font-bold tracking-tight">Task Checker</h1>
        <p className="text-sm text-surface-300 mt-1">{user?.login} ({user?.role})</p>
      </div>
      <nav className="flex-1 py-4">
        <div className="px-3 mb-2 text-xs font-semibold text-surface-300 uppercase tracking-wider">Обучение</div>
        {navItems.map((item) => (
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
          </>
        )}
      </nav>
      <div className="p-4 border-t border-dark-700">
        <button onClick={handleLogout} className="w-full text-left text-sm text-surface-300 hover:text-white transition-colors">
          Выйти
        </button>
      </div>
    </aside>
  );
}
