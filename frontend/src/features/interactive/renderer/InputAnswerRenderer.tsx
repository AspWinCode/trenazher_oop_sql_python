import type { InputAnswerAnswer, InputAnswerConfig, RendererProps } from '../types';

export default function InputAnswerRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<InputAnswerConfig, InputAnswerAnswer>) {
  const current = value?.answer ?? '';
  return (
    <input
      type={config.answer_type === 'number' ? 'number' : 'text'}
      value={current}
      disabled={disabled}
      onChange={(e) => onAnswerChange({ answer: e.target.value })}
      placeholder="Ваш ответ"
      className="w-full border border-surface-300 rounded-lg px-3 py-2"
    />
  );
}
