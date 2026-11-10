import type { FindErrorAnswer, FindErrorConfig, RendererProps } from '../types';

export default function FindErrorRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<FindErrorConfig, FindErrorAnswer>) {
  const selected = new Set(value?.selected_ids ?? []);

  const toggle = (id: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onAnswerChange({ selected_ids: Array.from(next) });
  };

  return (
    <div className="space-y-2">
      {config.items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={disabled}
          onClick={() => toggle(item.id)}
          className={`w-full text-left px-3 py-2 rounded-lg border font-mono text-sm ${
            selected.has(item.id) ? 'border-red-400 bg-red-50 text-red-700' : 'border-surface-200'
          } ${disabled ? 'opacity-60' : 'hover:border-primary-300'}`}
        >
          {item.text}
        </button>
      ))}
    </div>
  );
}
