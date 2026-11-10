import type { EditorProps, GroupingConfig } from '../types';

let idCounter = 0;
const nextId = () => `item_${Date.now()}_${idCounter++}`;

const EMPTY: GroupingConfig = { items: [], correct_groups: [[], []] };

export default function GroupingEditor({ config, onChange }: EditorProps<GroupingConfig>) {
  const cfg = config ?? EMPTY;

  const groupIndexOf = (itemId: string): number =>
    cfg.correct_groups.findIndex((g) => g.includes(itemId));

  const addItem = () => {
    const id = nextId();
    const groups = [...cfg.correct_groups];
    if (groups.length === 0) groups.push([]);
    groups[0] = [...groups[0], id];
    onChange({ items: [...cfg.items, { id, text: '' }], correct_groups: groups });
  };

  const updateText = (id: string, text: string) => {
    onChange({ ...cfg, items: cfg.items.map((i) => (i.id === id ? { ...i, text } : i)) });
  };

  const removeItem = (id: string) => {
    onChange({
      items: cfg.items.filter((i) => i.id !== id),
      correct_groups: cfg.correct_groups.map((g) => g.filter((x) => x !== id)),
    });
  };

  const moveToGroup = (itemId: string, groupIndex: number) => {
    const groups = cfg.correct_groups.map((g) => g.filter((x) => x !== itemId));
    groups[groupIndex] = [...(groups[groupIndex] ?? []), itemId];
    onChange({ ...cfg, correct_groups: groups });
  };

  const addGroup = () => onChange({ ...cfg, correct_groups: [...cfg.correct_groups, []] });
  const removeGroup = (index: number) => {
    const removedItemIds = cfg.correct_groups[index] ?? [];
    const groups = cfg.correct_groups.filter((_, i) => i !== index);
    if (groups.length > 0) groups[0] = [...groups[0], ...removedItemIds];
    onChange({ ...cfg, correct_groups: groups });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Группы ({cfg.correct_groups.length})</label>
        <button type="button" onClick={addGroup} className="btn-sm border border-surface-300">+ Группа</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {cfg.correct_groups.map((_, gi) => (
          <div key={gi} className="flex items-center gap-1 bg-surface-100 rounded px-2 py-1 text-xs">
            Группа {gi + 1}
            {cfg.correct_groups.length > 1 && (
              <button type="button" onClick={() => removeGroup(gi)} className="text-red-500">✕</button>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {cfg.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <input
              type="text"
              value={item.text}
              onChange={(e) => updateText(item.id, e.target.value)}
              placeholder="Текст элемента"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <select
              value={groupIndexOf(item.id)}
              onChange={(e) => moveToGroup(item.id, Number(e.target.value))}
              className="border border-surface-300 rounded px-2 py-1 text-sm"
            >
              {cfg.correct_groups.map((_, gi) => (
                <option key={gi} value={gi}>
                  Группа {gi + 1}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => removeItem(item.id)} className="text-red-500 text-sm">✕</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addItem} className="btn-sm border border-surface-300">+ Элемент</button>
    </div>
  );
}
