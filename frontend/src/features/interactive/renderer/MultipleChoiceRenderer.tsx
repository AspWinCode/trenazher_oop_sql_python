import { useMemo } from 'react';
import type { MultipleChoiceAnswer, MultipleChoiceConfig, MultipleChoiceOption, RendererProps } from '../types';

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function MultipleChoiceRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<MultipleChoiceConfig, MultipleChoiceAnswer>) {
  const selected = new Set(value?.selected_option_ids ?? []);
  const isSingle = config.mode === 'single';
  // Always shuffled: an admin naturally lists the correct option first/last
  // just by habit, which would let a student spot a pattern across repeated
  // attempts — same reasoning as ordering/matching.
  const options = useMemo<MultipleChoiceOption[]>(() => shuffled(config.options), [config]);

  const toggle = (id: string) => {
    if (disabled) return;
    if (isSingle) {
      onAnswerChange({ selected_option_ids: [id] });
      return;
    }
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onAnswerChange({ selected_option_ids: Array.from(next) });
  };

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.id}
          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
            selected.has(opt.id) ? 'border-primary-500 bg-primary-50' : 'border-surface-200'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary-300'}`}
        >
          <input
            type={isSingle ? 'radio' : 'checkbox'}
            name="multiple_choice"
            checked={selected.has(opt.id)}
            disabled={disabled}
            onChange={() => toggle(opt.id)}
          />
          <span>{opt.text}</span>
        </label>
      ))}
    </div>
  );
}
