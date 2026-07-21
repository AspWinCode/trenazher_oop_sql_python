import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api';
import { useAuthStore } from '../store/auth';

export default function GcAuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const id = (params.get('id') || '').trim();
    if (!id) {
      setError('Ссылка недействительна: не указан идентификатор.');
      return;
    }

    // Необязательный deep-link на конкретную задачу: ?course=<id>&task=<id>
    const courseId = (params.get('course') || '').trim();
    const taskId = (params.get('task') || '').trim();
    let target = '/courses';
    if (/^\d+$/.test(courseId)) {
      target = `/course/${courseId}`;
      if (/^\d+$/.test(taskId)) target += `?task=${taskId}`;
    }

    authApi
      .getcourseLogin(id)
      .then(({ data }) => {
        setAuth(data.token, data.refresh_token, data.user);
        navigate(target, { replace: true });
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail;
        setError(detail || 'Не удалось выполнить вход. Обратитесь в поддержку.');
      });
  }, [params, navigate, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        {error ? (
          <>
            <div className="text-4xl mb-4">🔒</div>
            <h1 className="text-lg font-bold text-dark-800 mb-2">Вход не выполнен</h1>
            <p className="text-sm text-surface-500 mb-6">{error}</p>
            <button onClick={() => navigate('/login')} className="btn-primary w-full">
              Перейти ко входу
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 mx-auto mb-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-surface-500">Выполняем вход в тренажёр…</p>
          </>
        )}
      </div>
    </div>
  );
}
