import { Link, useSearchParams } from 'react-router-dom';

export default function PaymentFailPage() {
  const [params] = useSearchParams();
  const courseId = params.get('course_id');

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-10 text-center">
        <div className="text-6xl mb-6">❌</div>
        <h1 className="text-2xl font-bold text-dark-800 mb-3">Платёж не прошёл</h1>
        <p className="text-surface-500 mb-8">
          К сожалению, оплата не была завершена. Вы можете попробовать ещё раз или
          продолжить в демо-режиме.
        </p>
        <div className="flex flex-col gap-3">
          {courseId ? (
            <Link to={`/course/${courseId}`} className="btn-primary py-2.5 rounded-xl text-center">
              Попробовать снова
            </Link>
          ) : (
            <Link to="/courses" className="btn-primary py-2.5 rounded-xl text-center">
              Вернуться к курсам
            </Link>
          )}
          <Link to="/courses" className="text-sm text-surface-400 hover:text-surface-600 transition-colors">
            Продолжить в демо-режиме
          </Link>
        </div>
      </div>
    </div>
  );
}
