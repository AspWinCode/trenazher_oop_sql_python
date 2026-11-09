import type { EditorProps, OrderingConfig } from '../types';

let idCounter = 0;
const nextId = () => `item_${Date.now()}_${idCounter++}`;

const EMPTY: OrderingConfig = { items: [], correct_order: [] };

export default function OrderingEditor({ config, onChange }: EditorProps<OrderingConfig>) {
  const cfg = config ?? EMPTY;

  const addItem = () => {
    const id = nextId();
    onChange({ items: [...cfg.items, { id, text: '' }], correct_order: [...cfg.correct_order, id] });
  };

  const updateText = (id: string, text: string) => {
    onChange({ ...cfg, items: cfg.items.map((i) => (i.id === id ? { ...i, text } : i)) });
  };

  const removeItem = (id: string) => {
    onChange({
      items: cfg.items.filter((i) => i.id !== id),
      correct_order: cfg.correct_order.filter((i) => i !== id),
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...cfg.correct_order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...cfg, correct_order: next });
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-surface-400">Порядок строк ниже — правильная последовательность.</div>
      {cfg.correct_order.map((id, index) => {
        const item = cfg.items.find((i) => i.id === id);
        return (
          <div key={id} className="flex items-center gap-2">
            <span className="w-6 text-center text-xs text-surface-400">{index + 1}</span>
            <input
              type="text"
              value={item?.text ?? ''}
              onChange={(e) => updateText(id, e.target.value)}
              placeholder="Текст шага"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <button type="button" onClick={() => move(index, -1)} className="text-surface-400 text-sm">
              ↑
            </button>
            <button type="button" onClick={() => move(index, 1)} className="text-surface-400 text-sm">
              ↓
            </button>
            <button type="button" onClick={() => removeItem(id)} className="text-red-500 text-sm">
              ✕
            </button>
          </div>
        );
      })}
      <button type="button" onClick={addItem} className="btn-sm border border-surface-300">
        + Шаг
      </button>
    </div>
  );
}
