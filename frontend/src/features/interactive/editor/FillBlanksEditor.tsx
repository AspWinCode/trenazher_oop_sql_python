import type { BlankInputMode, EditorProps, FillBlanksConfig } from '../types';

let idCounter = 0;
const nextId = () => `blank_${Date.now()}_${idCounter++}`;

const EMPTY: FillBlanksConfig = { template: '', blanks: [] };

const splitCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function FillBlanksEditor({ config, onChange }: EditorProps<FillBlanksConfig>) {
  const cfg = config ?? EMPTY;

  const addBlank = () => {
    const id = nextId();
    onChange({
      ...cfg,
      template: `${cfg.template}{{${id}}}`,
      blanks: [...cfg.blanks, { id, input_mode: 'text', correct_values: [] }],
    });
  };

  const updateBlank = (id: string, patch: Partial<FillBlanksConfig['blanks'][number]>) => {
    onChange({ ...cfg, blanks: cfg.blanks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  };

  const removeBlank = (id: string) => {
    onChange({ ...cfg, blanks: cfg.blanks.filter((b) => b.id !== id) });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium block mb-1">
          Текст с пропусками (вставляйте {'{{blank_id}}'} вручную или кнопкой ниже)
        </label>
        <textarea
          value={cfg.template}
          onChange={(e) => onChange({ ...cfg, template: e.target.value })}
          rows={3}
          className="w-full border border-surface-300 rounded px-2 py-1 text-sm font-mono"
        />
      </div>
      <div className="space-y-2">
        {cfg.blanks.map((b) => (
          <div key={b.id} className="border border-surface-200 rounded-lg p-2 space-y-1">
            <div className="flex items-center gap-2">
              <code className="text-xs bg-surface-100 px-1 rounded">{`{{${b.id}}}`}</code>
              <select
                value={b.input_mode}
                onChange={(e) => updateBlank(b.id, { input_mode: e.target.value as BlankInputMode })}
                className="border border-surface-300 rounded px-1 py-0.5 text-sm"
              >
                <option value="text">Текст</option>
                <option value="number">Число</option>
                <option value="select">Выбор из списка</option>
                <option value="drag">Перетаскивание (список)</option>
              </select>
              <button type="button" onClick={() => removeBlank(b.id)} className="text-red-500 text-sm ml-auto">
                ✕
              </button>
            </div>
            {(b.input_mode === 'select' || b.input_mode === 'drag') && (
              <input
                type="text"
                placeholder="Варианты через запятую"
                defaultValue={(b.options ?? []).join(', ')}
                onBlur={(e) => updateBlank(b.id, { options: splitCsv(e.target.value) })}
                className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
              />
            )}
            <input
              type="text"
              placeholder={b.input_mode === 'number' ? 'Правильное число' : 'Допустимые ответы через запятую'}
              defaultValue={(b.correct_values ?? []).join(', ')}
              onBlur={(e) => updateBlank(b.id, { correct_values: splitCsv(e.target.value) })}
              className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
            />
            {b.input_mode === 'number' && (
              <input
                type="number"
                placeholder="Допуск (tolerance)"
                defaultValue={b.tolerance ?? 0}
                onBlur={(e) => updateBlank(b.id, { tolerance: Number(e.target.value) || 0 })}
                className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
              />
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addBlank} className="btn-sm border border-surface-300">
        + Пропуск
      </button>
    </div>
  );
}
