/**
 * Страница-заглушка для Redirect URL приватной интеграции amoCRM.
 * Отправка лидов работает по долгосрочному токену и этот адрес не использует —
 * страница нужна лишь чтобы amoCRM дал сохранить интеграцию (адрес отвечает 200).
 */
export default function AmoRedirectPage() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-10 text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-xl font-bold text-dark-800 mb-2">Интеграция amoCRM</h1>
        <p className="text-surface-500 text-sm">Адрес перенаправления настроен. Это окно можно закрыть.</p>
      </div>
    </div>
  );
}
