import { useState } from 'react';
import type { GroupingAnswer, GroupingConfig, RendererProps } from '../types';

// Click-based grouping (no drag-and-drop): select chips from the pool, then
// "Создать группу" turns the current selection into a new group. Simpler and
// more touch/keyboard-friendly than free-form dragging for an open-ended
// number of groups.
export default function GroupingRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<GroupingConfig, GroupingAnswer>) {
  const groups = value?.groups ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const assigned = new Set(groups.flat());
  const pool = config.items.filter((i) => !assigned.has(i.id));
  const itemsById = new Map(config.items.map((i) => [i.id, i]));

  const toggleSelect = (id: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const createGroup = () => {
    if (disabled || selected.size === 0) return;
    onAnswerChange({ groups: [...groups, Array.from(selected)] });
    setSelected(new Set());
  };

  const removeItemFromGroup = (groupIndex: number, itemId: string) => {
    if (disabled) return;
    const next = groups.map((g, i) => (i === groupIndex ? g.filter((id) => id !== itemId) : g)).filter((g) => g.length > 0);
    onAnswerChange({ groups: next });
  };

  const removeGroup = (groupIndex: number) => {
    if (disabled) return;
    onAnswerChange({ groups: groups.filter((_, i) => i !== groupIndex) });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-surface-400 mb-1">Выберите элементы и нажмите «Создать группу»:</div>
        <div className="flex flex-wrap gap-2">
          {pool.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => toggleSelect(item.id)}
              className={`px-3 py-1.5 rounded-lg border text-sm ${
                selected.has(item.id) ? 'border-primary-500 bg-primary-50' : 'border-surface-200'
              } ${disabled ? 'opacity-60' : 'hover:border-primary-300'}`}
            >
              {item.text}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={disabled || selected.size === 0}
          onClick={createGroup}
          className="btn-sm border border-primary-300 text-primary-600 mt-2 disabled:opacity-40"
        >
          + Создать группу из выбранных ({selected.size})
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {groups.map((group, gi) => (
          <div key={gi} className="border border-surface-200 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-surface-400">Группа {gi + 1}</span>
              <button type="button" disabled={disabled} onClick={() => removeGroup(gi)} className="text-red-500 text-xs">
                Удалить группу
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => removeItemFromGroup(gi, id)}
                  className="px-2 py-1 rounded bg-surface-100 text-sm hover:bg-surface-200"
                  title="Убрать из группы"
                >
                  {itemsById.get(id)?.text ?? id} ✕
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
