import type { CategorizationConfig, EditorProps } from '../types';

let idCounter = 0;
const nextId = (p: string) => `${p}_${Date.now()}_${idCounter++}`;

const EMPTY: CategorizationConfig = { categories: [], items: [], correct_assignments: {} };

export default function CategorizationEditor({ config, onChange }: EditorProps<CategorizationConfig>) {
  const cfg = config ?? EMPTY;

  const addCategory = () => {
    onChange({ ...cfg, categories: [...cfg.categories, { id: nextId('cat'), label: '' }] });
  };
  const updateCategory = (id: string, label: string) => {
    onChange({ ...cfg, categories: cfg.categories.map((c) => (c.id === id ? { ...c, label } : c)) });
  };
  const removeCategory = (id: string) => {
    const assignments = { ...cfg.correct_assignments };
    for (const k of Object.keys(assignments)) assignments[k] = assignments[k].filter((c) => c !== id);
    onChange({ ...cfg, categories: cfg.categories.filter((c) => c.id !== id), correct_assignments: assignments });
  };

  const addItem = () => {
    const id = nextId('item');
    onChange({ ...cfg, items: [...cfg.items, { id, text: '' }], correct_assignments: { ...cfg.correct_assignments, [id]: [] } });
  };
  const updateItemText = (id: string, text: string) => {
    onChange({ ...cfg, items: cfg.items.map((i) => (i.id === id ? { ...i, text } : i)) });
  };
  const removeItem = (id: string) => {
    const assignments = { ...cfg.correct_assignments };
    delete assignments[id];
    onChange({ ...cfg, items: cfg.items.filter((i) => i.id !== id), correct_assignments: assignments });
  };
  const toggleCorrectCategory = (itemId: string, catId: string) => {
    const current = cfg.correct_assignments[itemId] ?? [];
    const next = current.includes(catId) ? current.filter((c) => c !== catId) : [...current, catId];
    onChange({ ...cfg, correct_assignments: { ...cfg.correct_assignments, [itemId]: next } });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Категории</label>
          <button type="button" onClick={addCategory} className="btn-sm border border-surface-300">+ Категория</button>
        </div>
        <div className="space-y-1">
          {cfg.categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <input
                type="text"
                value={c.label}
                onChange={(e) => updateCategory(c.id, e.target.value)}
                placeholder="Название категории"
                className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
              />
              <button type="button" onClick={() => removeCategory(c.id)} className="text-red-500 text-sm">✕</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Элементы</label>
          <button type="button" onClick={addItem} className="btn-sm border border-surface-300">+ Элемент</button>
        </div>
        <div className="space-y-2">
          {cfg.items.map((item) => (
            <div key={item.id} className="border border-surface-200 rounded-lg p-2 space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.text}
                  onChange={(e) => updateItemText(item.id, e.target.value)}
                  placeholder="Текст элемента"
                  className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
                />
                <button type="button" onClick={() => removeItem(item.id)} className="text-red-500 text-sm">✕</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {cfg.categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={(cfg.correct_assignments[item.id] ?? []).includes(c.id)}
                      onChange={() => toggleCorrectCategory(item.id, c.id)}
                    />
                    {c.label || '(без названия)'}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
