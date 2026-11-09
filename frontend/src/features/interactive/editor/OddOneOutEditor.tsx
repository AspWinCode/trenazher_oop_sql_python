import type { EditorProps, OddOneOutConfig } from '../types';

let idCounter = 0;
const nextId = () => `item_${Date.now()}_${idCounter++}`;

const EMPTY: OddOneOutConfig = { items: [], correct_odd_ids: [] };

export default function OddOneOutEditor({ config, onChange }: EditorProps<OddOneOutConfig>) {
  const cfg = config ?? EMPTY;

  const addItem = () => {
    onChange({ ...cfg, items: [...cfg.items, { id: nextId(), text: '' }] });
  };
  const updateText = (id: string, text: string) => {
    onChange({ ...cfg, items: cfg.items.map((i) => (i.id === id ? { ...i, text } : i)) });
  };
  const removeItem = (id: string) => {
    onChange({
      items: cfg.items.filter((i) => i.id !== id),
      correct_odd_ids: cfg.correct_odd_ids.filter((c) => c !== id),
    });
  };
  const toggleOdd = (id: string) => {
    onChange({
      ...cfg,
      correct_odd_ids: cfg.correct_odd_ids.includes(id)
        ? cfg.correct_odd_ids.filter((c) => c !== id)
        : [...cfg.correct_odd_ids, id],
    });
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-surface-400">Отметьте галочкой «лишний» элемент (можно несколько).</div>
      {cfg.items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <input type="checkbox" checked={cfg.correct_odd_ids.includes(item.id)} onChange={() => toggleOdd(item.id)} />
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
