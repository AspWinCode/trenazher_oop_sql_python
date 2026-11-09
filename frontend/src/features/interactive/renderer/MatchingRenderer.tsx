import { useState } from 'react';
import type { MatchingAnswer, MatchingConfig, RendererProps } from '../types';

// Click-to-pair UX (select a left item, then a right item) instead of drag-and-drop —
// simpler and fully keyboard/touch friendly for a 1:1 matching exercise.
export default function MatchingRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<MatchingConfig, MatchingAnswer>) {
  const pairs = value?.pairs ?? [];
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  const matchedLeft = new Map(pairs);
  const matchedRightIds = new Set(pairs.map(([, r]) => r));

  const pickLeft = (id: string) => {
    if (disabled) return;
    setSelectedLeft(id === selectedLeft ? null : id);
  };

  const pickRight = (rightId: string) => {
    if (disabled || !selectedLeft) return;
    const next = pairs.filter(([l, r]) => l !== selectedLeft && r !== rightId);
    next.push([selectedLeft, rightId]);
    onAnswerChange({ pairs: next });
    setSelectedLeft(null);
  };

  const removePair = (leftId: string) => {
    if (disabled) return;
    onAnswerChange({ pairs: pairs.filter(([l]) => l !== leftId) });
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        {config.left.map((item) => {
          const matchedTo = matchedLeft.get(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => (matchedTo ? removePair(item.id) : pickLeft(item.id))}
              className={`w-full text-left p-2 rounded-lg border ${
                selectedLeft === item.id
                  ? 'border-primary-500 bg-primary-50'
                  : matchedTo
                  ? 'border-green-400 bg-green-50'
                  : 'border-surface-200'
              } ${disabled ? 'opacity-60' : 'hover:border-primary-300'}`}
            >
              {item.text}
              {matchedTo && <span className="text-xs text-green-600 ml-2">✓ связано</span>}
            </button>
          );
        })}
      </div>
      <div className="space-y-2">
        {config.right.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => pickRight(item.id)}
            className={`w-full text-left p-2 rounded-lg border ${
              matchedRightIds.has(item.id) ? 'border-green-400 bg-green-50' : 'border-surface-200'
            } ${disabled ? 'opacity-60' : 'hover:border-primary-300'}`}
          >
            {item.text}
          </button>
        ))}
      </div>
    </div>
  );
}
