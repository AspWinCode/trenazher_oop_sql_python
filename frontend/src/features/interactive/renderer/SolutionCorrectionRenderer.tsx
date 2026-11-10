import type { RendererProps, SolutionCorrectionAnswer, SolutionCorrectionConfig } from '../types';

export default function SolutionCorrectionRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<SolutionCorrectionConfig, SolutionCorrectionAnswer>) {
  const content = value?.corrected_content ?? config.initial_content;

  return (
    <div className="space-y-2">
      {config.prompt && <div className="text-sm text-surface-500">{config.prompt}</div>}
      <div className="text-xs text-surface-400">Исходное (неверное) решение — исправьте его ниже:</div>
      <pre className="bg-surface-50 text-surface-500 text-sm p-3 rounded-lg overflow-auto whitespace-pre-wrap">
        {config.initial_content}
      </pre>
      <textarea
        value={content}
        disabled={disabled}
        onChange={(e) => onAnswerChange({ corrected_content: e.target.value })}
        rows={4}
        className="w-full border border-surface-300 rounded-lg px-3 py-2 font-mono text-sm"
      />
    </div>
  );
}
