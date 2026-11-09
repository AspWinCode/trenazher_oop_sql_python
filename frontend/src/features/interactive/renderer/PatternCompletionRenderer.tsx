import type { PatternCompletionAnswer, PatternCompletionConfig, RendererProps } from '../types';

export default function PatternCompletionRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<PatternCompletionConfig, PatternCompletionAnswer>) {
  const values = value?.values ?? config.next_values.map(() => '');

  const setValue = (index: number, v: string) => {
    const next = [...values];
    next[index] = v;
    onAnswerChange({ values: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-lg font-mono">
        {config.sequence_shown.map((v, i) => (
          <span key={i} className="px-3 py-1.5 rounded-lg bg-surface-100">
            {v}
          </span>
        ))}
        {config.next_values.map((_, i) => (
          <input
            key={i}
            type={config.input_mode === 'number' ? 'number' : 'text'}
            value={values[i] ?? ''}
            disabled={disabled}
            onChange={(e) => setValue(i, e.target.value)}
            className="w-20 px-2 py-1.5 rounded-lg border border-primary-300 text-center"
          />
        ))}
      </div>
    </div>
  );
}
