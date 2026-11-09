import { ExerciseRegistry } from '../registry';
import type { MechanicAnswer, MechanicConfig } from '../types';

interface Props {
  mechanic: string | null | undefined;
  config: unknown;
  value: MechanicAnswer | undefined;
  onAnswerChange: (answer: MechanicAnswer) => void;
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
      value={value}
      onAnswerChange={onAnswerChange}
      disabled={disabled}
    />
  );
}
