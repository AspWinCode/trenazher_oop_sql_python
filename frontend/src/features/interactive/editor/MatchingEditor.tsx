import type { EditorProps, MatchingConfig } from '../types';

let idCounter = 0;
const nextId = (side: string) => `${side}_${Date.now()}_${idCounter++}`;

const EMPTY: MatchingConfig = { left: [], right: [], correct_pairs: [] };

export default function MatchingEditor({ config, onChange }: EditorProps<MatchingConfig>) {
  const cfg = config ?? EMPTY;

  const addPair = () => {
    const l = nextId('l');
    const r = nextId('r');
    onChange({
      left: [...cfg.left, { id: l, text: '' }],
      right: [...cfg.right, { id: r, text: '' }],
      correct_pairs: [...cfg.correct_pairs, [l, r]],
    });
  };

  const updateText = (side: 'left' | 'right', id: string, text: string) => {
    onChange({ ...cfg, [side]: cfg[side].map((i) => (i.id === id ? { ...i, text } : i)) });
  };

  const removePair = (index: number) => {
    const [l, r] = cfg.correct_pairs[index];
    onChange({
      left: cfg.left.filter((i) => i.id !== l),
      right: cfg.right.filter((i) => i.id !== r),
      correct_pairs: cfg.correct_pairs.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-surface-400">Каждая строка — одна правильная пара (слева ↔ справа), 1:1.</div>
      {cfg.correct_pairs.map(([l, r], index) => {
        const leftItem = cfg.left.find((i) => i.id === l);
        const rightItem = cfg.right.find((i) => i.id === r);
        return (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={leftItem?.text ?? ''}
              onChange={(e) => updateText('left', l, e.target.value)}
              placeholder="Левый элемент"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <span className="text-surface-300">↔</span>
            <input
              type="text"
              value={rightItem?.text ?? ''}
              onChange={(e) => updateText('right', r, e.target.value)}
              placeholder="Правый элемент"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <button type="button" onClick={() => removePair(index)} className="text-red-500 text-sm">
              ✕
            </button>
          </div>
        );
      })}
      <button type="button" onClick={addPair} className="btn-sm border border-surface-300">
        + Пара
      </button>
    </div>
  );
}
