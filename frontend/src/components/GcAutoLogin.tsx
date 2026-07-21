import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useAuthStore } from '../store/auth';

const PARAM = 'utm_StudentId';

/**
 * Глобальный перехватчик бесшовной авторизации.
 *
 * Если в URL любой страницы есть ?utm_StudentId=<id> — выполняет автовход
 * по этому GetCourse ID, затем убирает параметр из адреса и оставляет
 * пользователя на той же странице (например, прямо на задаче урока).
 *
 * Ссылки вида:
 *   /course/2?task=192&utm_StudentId=84065123
 */
export default function GcAutoLogin({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();

  const studentId = (new URLSearchParams(location.search).get(PARAM) || '').trim();
  const [working, setWorking] = useState(false);
  const handledFor = useRef<string | null>(null);

  useEffect(() => {
    if (!studentId) return;

    // Убирает utm_StudentId из URL, сохраняя остальные параметры и путь.
    const stripParam = () => {
      const sp = new URLSearchParams(location.search);
      sp.delete(PARAM);
      const qs = sp.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`, { replace: true });
    };

    // Уже вошли под нужным студентом — просто чистим адрес.
    if (user && user.getcourse_id === studentId) {
      stripParam();
      return;
    }

    // Защита от повторного запуска для одного и того же id.
    if (handledFor.current === studentId) return;
    handledFor.current = studentId;

    setWorking(true);
    authApi
      .getcourseLogin(studentId)
      .then(({ data }) => {
        setAuth(data.token, data.refresh_token, data.user);
      })
      .catch(() => {
        // Не удалось — оставляем как есть: ProtectedRoute отправит на /login.
      })
      .finally(() => {
        setWorking(false);
        stripParam();
      });
  }, [studentId, user, location.pathname, location.search, location.hash, navigate, setAuth]);

  // Пока идёт вход — показываем лоадер вместо страницы, чтобы не мигал редирект на /login.
  if (studentId && working) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-10 h-10 mx-auto mb-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-surface-500">Выполняем вход в тренажёр…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
