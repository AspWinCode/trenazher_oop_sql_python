import type { OddOneOutAnswer, OddOneOutConfig, RendererProps } from '../types';

export default function OddOneOutRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<OddOneOutConfig, OddOneOutAnswer>) {
  const selected = new Set(value?.selected_ids ?? []);

  const toggle = (id: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onAnswerChange({ selected_ids: Array.from(next) });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {config.items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={disabled}
          onClick={() => toggle(item.id)}
          className={`px-3 py-2 rounded-lg border text-sm ${
            selected.has(item.id) ? 'border-red-400 bg-red-50 text-red-700' : 'border-surface-200'
          } ${disabled ? 'opacity-60' : 'hover:border-primary-300'}`}
        >
          {item.text}
        </button>
      ))}
    </div>
  );
}
