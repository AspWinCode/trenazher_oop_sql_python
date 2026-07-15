import { Link, useSearchParams } from 'react-router-dom';

export default function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const courseId = params.get('course_id');

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-10 text-center">
        <div className="text-6xl mb-6">✅</div>
        <h1 className="text-2xl font-bold text-dark-800 mb-3">Оплата прошла!</h1>
        <p className="text-surface-500 mb-2">
          Ваш платёж успешно принят. Доступ к полному курсу откроется автоматически.
        </p>
        <p className="text-surface-400 text-sm mb-8">
          Если доступ не появился в течение нескольких минут — обратитесь в поддержку.
        </p>
        <div className="flex flex-col gap-3">
          {courseId ? (
            <Link to={`/course/${courseId}`} className="btn-primary py-2.5 rounded-xl text-center">
              Перейти к курсу
            </Link>
          ) : (
            <Link to="/courses" className="btn-primary py-2.5 rounded-xl text-center">
              К курсам
            </Link>
          )}
          <Link to="/login" className="text-sm text-surface-400 hover:text-surface-600 transition-colors">
            Войти в аккаунт
          </Link>
        </div>
      </div>
    </div>
  );
}
