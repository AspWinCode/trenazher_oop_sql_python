import type { EditorProps, SolutionCorrectionConfig } from '../types';

const EMPTY: SolutionCorrectionConfig = { initial_content: '', correct_values: [] };
const splitLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

export default function SolutionCorrectionEditor({ config, onChange }: EditorProps<SolutionCorrectionConfig>) {
  const cfg = config ?? EMPTY;

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={cfg.prompt ?? ''}
        onChange={(e) => onChange({ ...cfg, prompt: e.target.value })}
        placeholder="Условие (необязательно)"
        className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
      />
      <div>
        <label className="text-sm font-medium block mb-1">Исходное (неверное) решение</label>
        <textarea
          value={cfg.initial_content}
          onChange={(e) => onChange({ ...cfg, initial_content: e.target.value })}
          rows={3}
          className="w-full border border-surface-300 rounded px-2 py-1 text-sm font-mono"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Допустимые исправленные варианты (по одному на строку)</label>
        <textarea
          defaultValue={cfg.correct_values.join('\n')}
          onBlur={(e) => onChange({ ...cfg, correct_values: splitLines(e.target.value) })}
          rows={3}
          className="w-full border border-surface-300 rounded px-2 py-1 text-sm font-mono"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!cfg.case_sensitive}
          onChange={(e) => onChange({ ...cfg, case_sensitive: e.target.checked })}
        />
        Учитывать регистр
      </label>
    </div>
  );
}
