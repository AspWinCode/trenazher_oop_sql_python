import { useEffect, useState } from 'react';
import { usersApi } from '../api';
import type { User } from '../types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ login: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => usersApi.list().then(({ data }) => setUsers(data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await usersApi.create(form);
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

  if (loading) return <div className="text-center py-20 text-surface-300">Загрузка...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">+ Добавить</button>
      </div>
      {showCreate && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Логин</label>
              <input className="input" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Пароль</label>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
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
            {users.map((u) => (
              <tr key={u.id} className="border-t border-surface-100">
                <td className="px-4 py-3">{u.id}</td>
                <td className="px-4 py-3 font-medium">{u.login}</td>
                <td className="px-4 py-3"><span className={u.role === 'admin' ? 'badge-blue' : 'badge-gray'}>{u.role}</span></td>
                <td className="px-4 py-3"><span className={u.status === 'active' ? 'badge-green' : 'badge-red'}>{u.status}</span></td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleStatus(u)} className="text-xs text-primary-600 hover:underline">
                    {u.status === 'active' ? 'Заблокировать' : 'Разблокировать'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
