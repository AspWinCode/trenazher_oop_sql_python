import type { EditorProps, MultiSelectElementsConfig } from '../types';

let idCounter = 0;
const nextId = () => `item_${Date.now()}_${idCounter++}`;

const EMPTY: MultiSelectElementsConfig = { items: [], correct_ids: [] };

export default function MultiSelectElementsEditor({ config, onChange }: EditorProps<MultiSelectElementsConfig>) {
  const cfg = config ?? EMPTY;

  const addItem = () => {
    onChange({ ...cfg, items: [...cfg.items, { id: nextId(), text: '' }] });
  };
  const updateText = (id: string, text: string) => {
    onChange({ ...cfg, items: cfg.items.map((i) => (i.id === id ? { ...i, text } : i)) });
  };
  const removeItem = (id: string) => {
    onChange({
      ...cfg,
      items: cfg.items.filter((i) => i.id !== id),
      correct_ids: cfg.correct_ids.filter((c) => c !== id),
    });
  };
  const toggleCorrect = (id: string) => {
    onChange({
      ...cfg,
      correct_ids: cfg.correct_ids.includes(id) ? cfg.correct_ids.filter((c) => c !== id) : [...cfg.correct_ids, id],
    });
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={cfg.prompt ?? ''}
        onChange={(e) => onChange({ ...cfg, prompt: e.target.value })}
        placeholder="Условие (необязательно)"
        className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
      />
      <div className="text-xs text-surface-400">Отметьте все правильные элементы.</div>
      {cfg.items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <input type="checkbox" checked={cfg.correct_ids.includes(item.id)} onChange={() => toggleCorrect(item.id)} />
          <input
            type="text"
            value={item.text}
            onChange={(e) => updateText(item.id, e.target.value)}
            placeholder="Текст элемента"
            className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
          />
          <button type="button" onClick={() => removeItem(item.id)} className="text-red-500 text-sm">✕</button>
        </div>
      ))}
      <button type="button" onClick={addItem} className="btn-sm border border-surface-300">+ Элемент</button>
    </div>
  );
}
