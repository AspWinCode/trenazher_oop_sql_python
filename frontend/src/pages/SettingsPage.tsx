import { useState } from 'react';
import { authApi } from '../api';
import { useAuthStore } from '../store/auth';

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-primary-600' : 'bg-surface-200'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [savingKey, setSavingKey] = useState<'reveal_hidden_tests' | 'reveal_all_hints' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (key: 'reveal_hidden_tests' | 'reveal_all_hints', value: boolean) => {
    setError(null);
    setSavingKey(key);
    // Применяем сразу — откатываем, только если запрос не прошёл.
    updateUser({ [key]: value });
    try {
      const { data } = await authApi.updatePreferences({ [key]: value });
      updateUser(data);
    } catch (err: any) {
      updateUser({ [key]: !value });
      setError(err.response?.data?.detail || 'Не удалось сохранить настройку');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Настройки</h1>

      <div className="card max-w-xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">Прохождение задач</h2>
          <p className="text-sm text-surface-400">
            Действует сразу на все задачи во всех курсах. Можно менять в любой момент, в том числе
            по ходу решения задачи.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium">Показывать скрытые тесты</div>
            <p className="text-sm text-surface-400 mt-0.5">
              Если включено, сразу видны результаты всех тестов, включая те, что админ пометил как
              скрытые. Если выключено — скрытые тесты остаются скрытыми, как обычно.
            </p>
          </div>
          <Toggle
            checked={!!user?.reveal_hidden_tests}
            disabled={savingKey === 'reveal_hidden_tests'}
            onChange={(v) => toggle('reveal_hidden_tests', v)}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium">Показывать все подсказки сразу</div>
            <p className="text-sm text-surface-400 mt-0.5">
              Если включено, все подсказки к задаче открыты сразу, без постепенной разблокировки
              по количеству попыток. Если выключено — подсказки открываются как обычно.
            </p>
          </div>
          <Toggle
            checked={!!user?.reveal_all_hints}
            disabled={savingKey === 'reveal_all_hints'}
            onChange={(v) => toggle('reveal_all_hints', v)}
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </div>
  );
}
