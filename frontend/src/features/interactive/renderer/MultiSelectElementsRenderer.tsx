import type { MultiSelectElementsAnswer, MultiSelectElementsConfig, RendererProps } from '../types';

export default function MultiSelectElementsRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<MultiSelectElementsConfig, MultiSelectElementsAnswer>) {
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
      {config.prompt && <div className="text-sm text-surface-500 mb-2">{config.prompt}</div>}
      <div className="flex flex-wrap gap-2">
        {config.items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(item.id)}
            className={`px-3 py-2 rounded-lg border text-sm ${
              selected.has(item.id) ? 'border-primary-500 bg-primary-50' : 'border-surface-200'
            } ${disabled ? 'opacity-60' : 'hover:border-primary-300'}`}
          >
            {item.text}
          </button>
        ))}
      </div>
    </div>
  );
}
