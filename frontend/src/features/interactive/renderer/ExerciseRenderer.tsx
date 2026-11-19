import { ExerciseRegistry } from '../registry';
import type { MechanicAnswer, MechanicConfig } from '../types';

interface Props {
  mechanic: string | null | undefined;
  config: unknown;
  value: unknown;
  onAnswerChange: (answer: unknown) => void;
  disabled?: boolean;
}

export default function ExerciseRenderer({ mechanic, config, value, onAnswerChange, disabled }: Props) {
  const entry = mechanic ? ExerciseRegistry[mechanic] : undefined;
  if (!entry || !config) {
    return <div className="text-sm text-red-500">Неизвестный тип упражнения: {mechanic ?? '—'}</div>;
  }
  const { Renderer } = entry;
  return (
    <Renderer
      config={config as MechanicConfig}
      value={value as MechanicAnswer | undefined}
      onAnswerChange={onAnswerChange as (answer: MechanicAnswer) => void}
      disabled={disabled}
    />
  );
}
