import type { MultipleChoiceAnswer, MultipleChoiceConfig, RendererProps } from '../types';

export default function MultipleChoiceRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<MultipleChoiceConfig, MultipleChoiceAnswer>) {
  const selected = new Set(value?.selected_option_ids ?? []);
  const isSingle = config.mode === 'single';

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
      {config.options.map((opt) => (
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
