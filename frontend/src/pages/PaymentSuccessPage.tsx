import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { paymentsApi } from '../api';
import { useAuthStore } from '../store/auth';

// Оплата подтверждается вебхуком Т-Банка асинхронно — даём ему время прийти.
const MAX_ATTEMPTS = 10;
const RETRY_MS = 2000;

export default function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const orderId = params.get('order_id');

  const [phase, setPhase] = useState<'working' | 'done' | 'timeout'>('working');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!orderId) {
      setPhase('timeout');
      return;
    }

    let attempts = 0;
    let cancelled = false;

    const tick = async () => {
      attempts += 1;
      try {
        const { data } = await paymentsApi.complete(orderId);
        if (cancelled) return;
        setAuth(data.token, data.refresh_token, data.user);
        setPhase('done');
        const target = data.course_id ? `/course/${data.course_id}` : '/courses';
        setTimeout(() => navigate(target, { replace: true }), 800);
      } catch (err: any) {
        if (cancelled) return;
        // 409 — оплата ещё обрабатывается, повторяем. Прочие ошибки — тоже повторяем до лимита.
        if (attempts < MAX_ATTEMPTS) {
          setTimeout(tick, RETRY_MS);
        } else {
          setPhase('timeout');
        }
      }
    };

    tick();
    return () => { cancelled = true; };
  }, [orderId, navigate, setAuth]);

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-10 text-center">
        {phase === 'working' && (
          <>
            <div className="w-12 h-12 mx-auto mb-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <h1 className="text-2xl font-bold text-dark-800 mb-3">Подтверждаем оплату…</h1>
            <p className="text-surface-500">
              Это займёт несколько секунд. Не закрывайте страницу — доступ откроется автоматически.
            </p>
          </>
        )}

        {phase === 'done' && (
          <>
            <div className="text-6xl mb-6">✅</div>
            <h1 className="text-2xl font-bold text-dark-800 mb-3">Оплата прошла!</h1>
            <p className="text-surface-500">Открываем курс…</p>
          </>
        )}

        {phase === 'timeout' && (
          <>
            <div className="text-6xl mb-6">⏳</div>
            <h1 className="text-2xl font-bold text-dark-800 mb-3">Платёж обрабатывается</h1>
            <p className="text-surface-500 mb-2">
              Оплата принята. Доступ откроется в течение нескольких минут, а данные для входа придут на почту.
            </p>
            <p className="text-surface-400 text-sm mb-8">
              Если доступ не появился — обратитесь в поддержку.
            </p>
            <div className="flex flex-col gap-3">
              <Link to="/login" className="btn-primary py-2.5 rounded-xl text-center">
                Войти в аккаунт
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
