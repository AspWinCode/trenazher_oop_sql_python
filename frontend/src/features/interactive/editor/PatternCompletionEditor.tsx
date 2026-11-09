import type { EditorProps, PatternCompletionConfig } from '../types';

const EMPTY: PatternCompletionConfig = { sequence_shown: [], next_values: [], input_mode: 'number' };
const splitCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function PatternCompletionEditor({ config, onChange }: EditorProps<PatternCompletionConfig>) {
  const cfg = config ?? EMPTY;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium block mb-1">Показанная последовательность (через запятую)</label>
        <input
          type="text"
          defaultValue={cfg.sequence_shown.join(', ')}
          onBlur={(e) => onChange({ ...cfg, sequence_shown: splitCsv(e.target.value) })}
          placeholder="2, 4, 6, 8"
          className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Правильное продолжение (через запятую)</label>
        <input
          type="text"
          defaultValue={cfg.next_values.join(', ')}
          onBlur={(e) => onChange({ ...cfg, next_values: splitCsv(e.target.value) })}
          placeholder="10, 12"
          className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Тип значений:</label>
        <select
          value={cfg.input_mode}
          onChange={(e) => onChange({ ...cfg, input_mode: e.target.value as 'text' | 'number' })}
          className="border border-surface-300 rounded px-2 py-1 text-sm"
        >
          <option value="number">Число</option>
          <option value="text">Текст</option>
        </select>
        {cfg.input_mode === 'number' && (
          <input
            type="number"
            placeholder="Допуск"
            defaultValue={cfg.tolerance ?? 0}
            onBlur={(e) => onChange({ ...cfg, tolerance: Number(e.target.value) || 0 })}
            className="w-28 border border-surface-300 rounded px-2 py-1 text-sm"
          />
        )}
      </div>
    </div>
  );
}
