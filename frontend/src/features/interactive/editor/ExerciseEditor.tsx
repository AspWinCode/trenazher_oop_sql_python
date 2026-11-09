import { ExerciseRegistry } from '../registry';
import type { MechanicConfig } from '../types';

interface Props {
  mechanic: string | null | undefined;
  config: unknown;
  onChange: (config: MechanicConfig) => void;
}

export default function ExerciseEditor({ mechanic, config, onChange }: Props) {
  const entry = mechanic ? ExerciseRegistry[mechanic] : undefined;
  if (!entry) {
    return <div className="text-sm text-surface-400">Выберите механику, чтобы настроить упражнение.</div>;
  }
  const { Editor } = entry;
  return <Editor config={(config as MechanicConfig) ?? null} onChange={onChange} />;
}
