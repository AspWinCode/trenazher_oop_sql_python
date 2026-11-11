import type { DecisionOption, DecisionPathAnswer, DecisionPathConfig, DecisionStep, RendererProps } from '../types';

export default function DecisionPathRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<DecisionPathConfig, DecisionPathAnswer>) {
  const path = value?.path ?? [];
  const stepsById = new Map<string, DecisionStep>(config.steps.map((s) => [s.id, s]));

  // Walk the path so far to find the current step.
  let currentStepId: string | null = config.start_step_id;
  for (const optionId of path) {
    const step: DecisionStep | undefined = currentStepId ? stepsById.get(currentStepId) : undefined;
    const option: DecisionOption | undefined = step?.options.find((o) => o.id === optionId);
    currentStepId = option?.next_step_id ?? null;
  }
  const currentStep = currentStepId ? stepsById.get(currentStepId) : undefined;

  const choose = (optionId: string) => {
    if (disabled) return;
    onAnswerChange({ path: [...path, optionId] });
  };

  const restart = () => {
    if (disabled) return;
    onAnswerChange({ path: [] });
  };

  return (
    <div className="space-y-3">
      {path.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-surface-400">
          {path.map((optId, i) => (
            <span key={i} className="bg-surface-100 rounded px-2 py-0.5">
              Шаг {i + 1}
            </span>
          ))}
          <button type="button" onClick={restart} disabled={disabled} className="text-primary-600 hover:underline ml-2">
            ↺ Начать заново
          </button>
        </div>
      )}

      {currentStep ? (
        <div className="space-y-2">
          <div className="font-medium text-sm">{currentStep.prompt}</div>
          <div className="space-y-2">
            {currentStep.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => choose(opt.id)}
                className="w-full text-left px-3 py-2 rounded-lg border border-surface-200 hover:border-primary-300 text-sm"
              >
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm text-surface-500">Маршрут пройден. Можно отправить ответ или начать заново.</div>
      )}
    </div>
  );
}
