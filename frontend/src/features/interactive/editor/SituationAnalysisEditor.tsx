import type { EditorProps, SituationAnalysisConfig } from '../types';

let idCounter = 0;
const nextId = () => `opt_${Date.now()}_${idCounter++}`;
const splitCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

const EMPTY: SituationAnalysisConfig = {
  description: '', question: '', mode: 'choice', options: [], correct_option_ids: [],
};

export default function SituationAnalysisEditor({ config, onChange }: EditorProps<SituationAnalysisConfig>) {
  const cfg = config ?? EMPTY;

  const addOption = () => {
    onChange({ ...cfg, options: [...(cfg.options ?? []), { id: nextId(), text: '' }] });
  };
  const updateOption = (id: string, text: string) => {
    onChange({ ...cfg, options: (cfg.options ?? []).map((o) => (o.id === id ? { ...o, text } : o)) });
  };
  const removeOption = (id: string) => {
    onChange({
      ...cfg,
      options: (cfg.options ?? []).filter((o) => o.id !== id),
      correct_option_ids: (cfg.correct_option_ids ?? []).filter((c) => c !== id),
    });
  };
  const toggleCorrect = (id: string) => {
    const current = cfg.correct_option_ids ?? [];
    onChange({
      ...cfg,
      correct_option_ids: current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium block mb-1">Описание ситуации</label>
        <textarea
          value={cfg.description}
          onChange={(e) => onChange({ ...cfg, description: e.target.value })}
          rows={3}
          className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
        />
      </div>
      <input
        type="text"
        value={cfg.question}
        onChange={(e) => onChange({ ...cfg, question: e.target.value })}
        placeholder="Вопрос"
        className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
      />
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Тип ответа:</label>
        <select
          value={cfg.mode}
          onChange={(e) => onChange({ ...cfg, mode: e.target.value as 'choice' | 'text' })}
          className="border border-surface-300 rounded px-2 py-1 text-sm"
        >
          <option value="choice">Выбор варианта</option>
          <option value="text">Короткий ответ</option>
        </select>
      </div>

      {cfg.mode === 'choice' ? (
        <div className="space-y-2">
          {(cfg.options ?? []).map((opt) => (
            <div key={opt.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={(cfg.correct_option_ids ?? []).includes(opt.id)}
                onChange={() => toggleCorrect(opt.id)}
              />
              <input
                type="text"
                value={opt.text}
                onChange={(e) => updateOption(opt.id, e.target.value)}
                placeholder="Текст варианта"
                className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
              />
              <button type="button" onClick={() => removeOption(opt.id)} className="text-red-500 text-sm">✕</button>
            </div>
          ))}
          <button type="button" onClick={addOption} className="btn-sm border border-surface-300">+ Вариант</button>
        </div>
      ) : (
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
      )}
    </div>
  );
}
