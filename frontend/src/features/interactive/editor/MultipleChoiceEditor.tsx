import type { EditorProps, MultipleChoiceConfig } from '../types';

let idCounter = 0;
const nextId = () => `opt_${Date.now()}_${idCounter++}`;

const EMPTY: MultipleChoiceConfig = { mode: 'single', options: [], correct_option_ids: [] };

export default function MultipleChoiceEditor({ config, onChange }: EditorProps<MultipleChoiceConfig>) {
  const cfg = config ?? EMPTY;

  const addOption = () => {
    onChange({ ...cfg, options: [...cfg.options, { id: nextId(), text: '' }] });
  };

  const updateOption = (id: string, text: string) => {
    onChange({ ...cfg, options: cfg.options.map((o) => (o.id === id ? { ...o, text } : o)) });
  };

  const removeOption = (id: string) => {
    onChange({
      ...cfg,
      options: cfg.options.filter((o) => o.id !== id),
      correct_option_ids: cfg.correct_option_ids.filter((c) => c !== id),
    });
  };

  const toggleCorrect = (id: string) => {
    const isCorrect = cfg.correct_option_ids.includes(id);
    if (cfg.mode === 'single') {
      onChange({ ...cfg, correct_option_ids: isCorrect ? [] : [id] });
      return;
    }
    onChange({
      ...cfg,
      correct_option_ids: isCorrect
        ? cfg.correct_option_ids.filter((c) => c !== id)
        : [...cfg.correct_option_ids, id],
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Режим:</label>
        <select
          value={cfg.mode}
          onChange={(e) => onChange({ ...cfg, mode: e.target.value as 'single' | 'multi', correct_option_ids: [] })}
          className="border border-surface-300 rounded px-2 py-1 text-sm"
        >
          <option value="single">Один правильный</option>
          <option value="multi">Несколько правильных</option>
        </select>
      </div>

      <div className="space-y-2">
        {cfg.options.map((opt) => (
          <div key={opt.id} className="flex items-center gap-2">
            <input
              type={cfg.mode === 'single' ? 'radio' : 'checkbox'}
              checked={cfg.correct_option_ids.includes(opt.id)}
              onChange={() => toggleCorrect(opt.id)}
              title="Правильный вариант"
            />
            <input
              type="text"
              value={opt.text}
              onChange={(e) => updateOption(opt.id, e.target.value)}
              placeholder="Текст варианта"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <button type="button" onClick={() => removeOption(opt.id)} className="text-red-500 text-sm">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addOption} className="btn-sm border border-surface-300">
        + Вариант
      </button>
    </div>
  );
}
