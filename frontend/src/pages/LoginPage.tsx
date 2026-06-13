import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, guestApi } from '../api';
import { useAuthStore } from '../store/auth';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestEnabled, setGuestEnabled] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    guestApi.getConfig()
      .then(({ data }) => setGuestEnabled(data.enabled))
      .catch(() => setGuestEnabled(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login(login, password);
      setAuth(data.token, data.refresh_token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError('');
    setGuestLoading(true);
    try {
      const { data } = await authApi.guestLogin();
      setAuth(data.token, data.refresh_token, data.user);
      navigate('/courses');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Гостевой режим недоступен');
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-surface-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-dark-900">ITPractikum</h1>
          <p className="text-surface-300 mt-1">Платформа для обучения</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1.5">Логин</label>
            <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} autoFocus required />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-1.5">Пароль</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Вход...' : 'Войти'}
          </button>
          {guestEnabled && (
            <>
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-surface-200" />
                <span className="mx-3 text-xs text-surface-300">или</span>
                <div className="flex-grow border-t border-surface-200" />
              </div>
              <button
                type="button"
                onClick={handleGuest}
                disabled={guestLoading}
                className="btn-secondary w-full"
              >
                {guestLoading ? 'Входим...' : 'Войти как гость (демо)'}
              </button>
              <p className="text-center text-xs text-surface-300">
                Демо-доступ к части задач без регистрации
              </p>
            </>
          )}
          <p className="text-center text-xs text-surface-300 pt-1">
            <Link to="/forgot-password" className="text-primary-600 hover:underline">Забыли пароль?</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
