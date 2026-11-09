import type { CategorizationAnswer, CategorizationConfig, RendererProps } from '../types';

export default function CategorizationRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<CategorizationConfig, CategorizationAnswer>) {
  const assignments = value?.assignments ?? {};

  const assign = (itemId: string, categoryId: string) => {
    onAnswerChange({ assignments: { ...assignments, [itemId]: categoryId } });
  };

  return (
    <div className="space-y-2">
      {config.items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-surface-200">
          <span>{item.text}</span>
          <select
            value={assignments[item.id] ?? ''}
            disabled={disabled}
            onChange={(e) => assign(item.id, e.target.value)}
            className="border border-surface-300 rounded px-2 py-1 text-sm"
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
      ))}
    </div>
  );
}
