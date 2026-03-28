import { useEffect, useState } from 'react';
import { coursesApi, usersApi } from '../api';
import type { CourseEnrollment } from '../api';
import type { Course, User } from '../types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ login: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [createdCredentials, setCreatedCredentials] = useState<{ login: string; password: string } | null>(null);

  // Reset password modal
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');

  // Course enrollment modal
  const [enrollUserId, setEnrollUserId] = useState<number | null>(null);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(false);

  const load = () => usersApi.list().then(({ data }) => setUsers(data)).finally(() => setLoading(false));

  useEffect(() => {
    load();
    coursesApi.list().then(({ data }) => setAllCourses(data)).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await usersApi.create(form);
      setCreatedCredentials({ login: form.login, password: form.password });
      setForm({ login: '', password: '', role: 'student' });
      setShowCreate(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка');
    }
  };

  const toggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'blocked' : 'active';
    await usersApi.update(user.id, { status: newStatus } as any);
    load();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (!resetUserId) return;
    try {
      await usersApi.resetPassword(resetUserId, resetPassword);
      setResetUserId(null);
      setResetPassword('');
    } catch (err: any) {
      setResetError(err.response?.data?.detail || 'Ошибка');
    }
  };

  const openEnrollments = async (userId: number) => {
    setEnrollUserId(userId);
    setEnrollLoading(true);
    try {
      const { data } = await usersApi.getEnrollments(userId);
      setEnrollments(data);
    } catch {
      setEnrollments([]);
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleEnroll = async (courseId: number) => {
    if (!enrollUserId) return;
    await usersApi.enroll(enrollUserId, courseId);
    const { data } = await usersApi.getEnrollments(enrollUserId);
    setEnrollments(data);
  };

  const handleUnenroll = async (courseId: number) => {
    if (!enrollUserId) return;
    await usersApi.unenroll(enrollUserId, courseId);
    const { data } = await usersApi.getEnrollments(enrollUserId);
    setEnrollments(data);
  };

  const filteredUsers = users.filter((u) =>
    u.login.toLowerCase().includes(search.toLowerCase())
  );

  const enrolledIds = new Set(enrollments.map((e) => e.course_id));
  const enrollUser = users.find((u) => u.id === enrollUserId);

  if (loading) return <div className="text-center py-20 text-surface-300">Загрузка...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <button onClick={() => { setShowCreate(!showCreate); setCreatedCredentials(null); }} className="btn-primary">+ Добавить</button>
      </div>

      {/* Форма создания */}
      {showCreate && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Логин</label>
              <input className="input" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Пароль</label>
              <input className="input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="Введите пароль" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Роль</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="student">Студент</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary btn-sm">Создать</button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary btn-sm">Отмена</button>
          </div>
        </form>
      )}

      {/* Учётные данные после создания */}
      {createdCredentials && (
        <div className="card mb-6 bg-green-50 border border-green-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-green-800 mb-2">✅ Пользователь создан — передайте данные для входа:</div>
              <div className="space-y-1 text-sm">
                <div><span className="text-surface-400">Логин:</span> <code className="bg-white px-2 py-0.5 rounded border border-green-200 font-mono select-all">{createdCredentials.login}</code></div>
                <div><span className="text-surface-400">Пароль:</span> <code className="bg-white px-2 py-0.5 rounded border border-green-200 font-mono select-all">{createdCredentials.password}</code></div>
              </div>
            </div>
            <button onClick={() => setCreatedCredentials(null)} className="text-surface-400 hover:text-dark-900 text-lg leading-none">×</button>
          </div>
        </div>
      )}

      {/* Поиск */}
      <div className="mb-4">
        <input
          className="input max-w-xs"
          placeholder="Поиск по логину..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Таблица */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-50 text-left">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Логин</th>
              <th className="px-4 py-3 font-medium">Роль</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-surface-300">
                  {search ? 'Пользователи не найдены' : 'Нет пользователей'}
                </td>
              </tr>
            ) : filteredUsers.map((u) => (
              <tr key={u.id} className="border-t border-surface-100">
                <td className="px-4 py-3 text-surface-400">{u.id}</td>
                <td className="px-4 py-3 font-medium">{u.login}</td>
                <td className="px-4 py-3"><span className={u.role === 'admin' ? 'badge-blue' : 'badge-gray'}>{u.role}</span></td>
                <td className="px-4 py-3"><span className={u.status === 'active' ? 'badge-green' : 'badge-red'}>{u.status}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 flex-wrap">
                    <button onClick={() => toggleStatus(u)} className="text-xs text-primary-600 hover:underline">
                      {u.status === 'active' ? 'Заблокировать' : 'Разблокировать'}
                    </button>
                    <button onClick={() => { setResetUserId(u.id); setResetPassword(''); setResetError(''); }} className="text-xs text-orange-600 hover:underline">
                      Сбросить пароль
                    </button>
                    {u.role === 'student' && (
                      <button onClick={() => openEnrollments(u.id)} className="text-xs text-purple-600 hover:underline">
                        Доступ к курсам
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модал сброса пароля */}
      {resetUserId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Сбросить пароль</h2>
            <p className="text-sm text-surface-400 mb-4">
              Пользователь: <span className="font-medium text-dark-900">{users.find(u => u.id === resetUserId)?.login}</span>
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Новый пароль</label>
                <input
                  className="input"
                  type="text"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  placeholder="Введите новый пароль"
                />
              </div>
              {resetError && <div className="text-red-600 text-sm">{resetError}</div>}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary btn-sm flex-1">Сохранить</button>
                <button type="button" onClick={() => setResetUserId(null)} className="btn-secondary btn-sm flex-1">Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модал управления курсами */}
      {enrollUserId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Доступ к курсам</h2>
              <button onClick={() => setEnrollUserId(null)} className="text-surface-400 hover:text-dark-900 text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-surface-400 mb-4">
              Пользователь: <span className="font-medium text-dark-900">{enrollUser?.login}</span>
            </p>
            <p className="text-xs text-surface-300 mb-4">
              Если курсы не назначены — студент видит все публичные курсы. При назначении хотя бы одного — только назначенные.
            </p>
            {enrollLoading ? (
              <div className="text-center py-4 text-surface-300">Загрузка...</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {allCourses.filter(c => c.status === 'published').map((c) => {
                  const enrolled = enrolledIds.has(c.id);
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-100 hover:bg-surface-50">
                      <span className="text-sm font-medium">{c.title}</span>
                      <button
                        onClick={() => enrolled ? handleUnenroll(c.id) : handleEnroll(c.id)}
                        className={`btn-sm ${enrolled ? 'btn-secondary text-red-600' : 'btn-primary'}`}
                      >
                        {enrolled ? 'Убрать доступ' : 'Дать доступ'}
                      </button>
                    </div>
                  );
                })}
                {allCourses.filter(c => c.status === 'published').length === 0 && (
                  <div className="text-center py-4 text-surface-300">Нет опубликованных курсов</div>
                )}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-surface-100">
              <button onClick={() => setEnrollUserId(null)} className="btn-secondary btn-sm w-full">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
