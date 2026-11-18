import type { CategorizationAnswer, CategorizationConfig, RendererProps } from '../types';

// Same palette used in matching's pair colors — one color per category gives
// a quick visual grouping cue (which rows share a category) without
// restructuring the list into per-category columns.
const CATEGORY_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function CategorizationRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<CategorizationConfig, CategorizationAnswer>) {
  const assignments = value?.assignments ?? {};
  const colorByCategory = new Map(config.categories.map((c, i) => [c.id, CATEGORY_COLORS[i % CATEGORY_COLORS.length]]));

  const assign = (itemId: string, categoryId: string) => {
    onAnswerChange({ assignments: { ...assignments, [itemId]: categoryId } });
  };

  const assignedCount = config.items.filter((i) => assignments[i.id]).length;
  const total = config.items.length;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-surface-400">
          <span>Распределено: {assignedCount} из {total}</span>
          <span>{Math.round((assignedCount / total) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
          <div
            className="h-full bg-primary-500 transition-all"
            style={{ width: `${(assignedCount / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-surface-400">
        {config.categories.map((c) => (
          <span key={c.id} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorByCategory.get(c.id) }} />
            {c.label}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {config.items.map((item) => {
          const assignedCategory = assignments[item.id];
          const color = assignedCategory ? colorByCategory.get(assignedCategory) : undefined;
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 p-2 rounded-lg border-2 bg-white ${!color ? 'border-surface-200' : ''}`}
              style={color ? { borderColor: color, backgroundColor: `${color}0d` } : undefined}
            >
              <span>{item.text}</span>
              <select
                value={assignedCategory ?? ''}
                disabled={disabled}
                onChange={(e) => assign(item.id, e.target.value)}
                className="border border-surface-300 rounded px-2 py-1 text-sm shrink-0"
              >
                <option value="" disabled>
                  — категория —
                </option>
                {config.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
