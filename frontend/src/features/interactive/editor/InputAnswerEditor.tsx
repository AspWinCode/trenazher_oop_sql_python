import type { EditorProps, InputAnswerConfig } from '../types';

const EMPTY: InputAnswerConfig = { answer_type: 'text', accepted_answers: [] };
const splitCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function InputAnswerEditor({ config, onChange }: EditorProps<InputAnswerConfig>) {
  const cfg = config ?? EMPTY;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Тип ответа:</label>
        <select
          value={cfg.answer_type}
          onChange={(e) => onChange({ ...cfg, answer_type: e.target.value as 'text' | 'number' })}
          className="border border-surface-300 rounded px-2 py-1 text-sm"
        >
          <option value="text">Текст</option>
          <option value="number">Число</option>
        </select>
      </div>

      {cfg.answer_type === 'text' ? (
        <>
          <input
            type="text"
            placeholder="Допустимые ответы через запятую"
            defaultValue={(cfg.accepted_answers ?? []).join(', ')}
            onBlur={(e) => onChange({ ...cfg, accepted_answers: splitCsv(e.target.value) })}
            className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!cfg.case_sensitive}
              onChange={(e) => onChange({ ...cfg, case_sensitive: e.target.checked })}
            />
            Учитывать регистр
          </label>
        </>
      ) : (
        <>
          <input
            type="number"
            placeholder="Правильное число"
            defaultValue={cfg.numeric_value ?? ''}
            onBlur={(e) => onChange({ ...cfg, numeric_value: Number(e.target.value) })}
            className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Допуск"
              defaultValue={cfg.tolerance ?? 0}
              onBlur={(e) => onChange({ ...cfg, tolerance: Number(e.target.value) || 0 })}
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <select
              value={cfg.tolerance_mode ?? 'absolute'}
              onChange={(e) => onChange({ ...cfg, tolerance_mode: e.target.value as 'absolute' | 'relative' })}
              className="border border-surface-300 rounded px-2 py-1 text-sm"
            >
              <option value="absolute">абсолютный</option>
              <option value="relative">относительный</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}
