import { useMemo } from 'react';
import type { OddOneOutAnswer, OddOneOutConfig, OddOneOutItem, RendererProps } from '../types';

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function OddOneOutRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<OddOneOutConfig, OddOneOutAnswer>) {
  const selected = new Set(value?.selected_ids ?? []);
  // Always shuffled: the odd items are naturally authored together, which
  // gives away the answer by position.
  const items = useMemo<OddOneOutItem[]>(() => shuffled(config.items), [config]);

  const toggle = (id: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onAnswerChange({ selected_ids: Array.from(next) });
  };

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={disabled}
          onClick={() => toggle(item.id)}
          className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${
            selected.has(item.id) ? 'border-red-400 bg-red-50 text-red-700' : 'border-surface-200'
          } ${disabled ? 'opacity-60' : 'hover:border-primary-300'}`}
        >
          {item.text}
        </button>
      ))}
    </div>
  );
}
