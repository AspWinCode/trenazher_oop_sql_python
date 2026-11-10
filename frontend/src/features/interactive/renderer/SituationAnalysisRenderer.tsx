import type { RendererProps, SituationAnalysisAnswer, SituationAnalysisConfig } from '../types';

export default function SituationAnalysisRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<SituationAnalysisConfig, SituationAnalysisAnswer>) {
  const selected = new Set(value?.selected_option_ids ?? []);
  const isSingle = (config.correct_option_ids?.length ?? 1) === 1;

  const toggleOption = (id: string) => {
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
    <div className="space-y-3">
      <div className="text-sm bg-surface-50 rounded-lg p-3 whitespace-pre-wrap">{config.description}</div>
      <div className="font-medium text-sm">{config.question}</div>
      {config.mode === 'choice' ? (
        <div className="space-y-2">
          {(config.options ?? []).map((opt) => (
            <label
              key={opt.id}
              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                selected.has(opt.id) ? 'border-primary-500 bg-primary-50' : 'border-surface-200'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary-300'}`}
            >
              <input
                type={isSingle ? 'radio' : 'checkbox'}
                name="situation_analysis"
                checked={selected.has(opt.id)}
                disabled={disabled}
                onChange={() => toggleOption(opt.id)}
              />
              <span>{opt.text}</span>
            </label>
          ))}
        </div>
      ) : (
        <input
          type="text"
          value={value?.answer ?? ''}
          disabled={disabled}
          onChange={(e) => onAnswerChange({ answer: e.target.value })}
          placeholder="Ваш ответ"
          className="w-full border border-surface-300 rounded-lg px-3 py-2"
        />
      )}
    </div>
  );
}
