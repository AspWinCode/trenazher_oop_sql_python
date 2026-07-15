import { useState } from 'react';
import { paymentsApi } from '../api';

interface Props {
  courseId: number;
  courseTitle: string;
  onClose: () => void;
}

export default function GuestUpgradeDialog({ courseId, courseTitle, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuy = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await paymentsApi.initPayment(courseId);
      window.location.href = data.payment_url;
    } catch {
      setError('Не удалось инициировать платёж. Попробуйте позже.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Затемнение */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Карточка */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        <div className="text-4xl mb-4">🎉</div>

        <h2 className="text-xl font-bold text-dark-800 mb-2">
          Вы прошли демо-версию курса!
        </h2>
        <p className="text-surface-500 text-sm mb-6">
          Отличная работа. В полном курсе «{courseTitle}» вас ждут десятки задач
          с нарастающей сложностью и сохранение всего прогресса.
        </p>

        <button
          onClick={handleBuy}
          disabled={loading}
          className="w-full btn-primary py-3 text-base font-semibold rounded-xl mb-3 disabled:opacity-60"
        >
          {loading ? 'Переход к оплате...' : 'Купить полный курс →'}
        </button>

        {error && (
          <p className="text-red-500 text-sm mb-3">{error}</p>
        )}

        <button
          onClick={onClose}
          className="w-full text-sm text-surface-400 hover:text-surface-600 transition-colors py-1"
        >
          Продолжить в демо-режиме
        </button>
      </div>
    </div>
  );
}
