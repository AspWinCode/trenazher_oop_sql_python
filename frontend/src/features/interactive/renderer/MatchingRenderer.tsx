import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MatchingAnswer, MatchingConfig, MatchingItem, RendererProps } from '../types';

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Click-to-pair UX (select a left item, then a right item) instead of drag-and-drop —
// simpler and fully keyboard/touch friendly for a 1:1 matching exercise. Each
// formed pair gets its own color, shared by its left/right border and by a
// connecting line drawn between them, so multiple simultaneous pairs stay
// visually distinguishable instead of all turning the same generic "matched" color.
const PAIR_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

interface Line {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export default function MatchingRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<MatchingConfig, MatchingAnswer>) {
  const pairs = value?.pairs ?? [];
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);

  // Shuffled once per task: the admin naturally lists left/right in matching
  // order (l1↔r1, l2↔r2, ...), which without this would let a student match
  // everything correctly just by position, never reading the content.
  const shuffledLeft = useMemo<MatchingItem[]>(() => shuffled(config.left), [config]);
  const shuffledRight = useMemo<MatchingItem[]>(() => shuffled(config.right), [config]);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef(new Map<string, HTMLButtonElement>());
  const rightRefs = useRef(new Map<string, HTMLButtonElement>());

  const matchedLeft = new Map(pairs);

  const colorOf = (leftId: string, rightId: string) => {
    const idx = pairs.findIndex(([l, r]) => l === leftId && r === rightId);
    return PAIR_COLORS[(idx < 0 ? 0 : idx) % PAIR_COLORS.length];
  };

  const recomputeLines = () => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const next: Line[] = [];
    pairs.forEach(([l, r], i) => {
      const leftEl = leftRefs.current.get(l);
      const rightEl = rightRefs.current.get(r);
      if (!leftEl || !rightEl) return;
      const leftRect = leftEl.getBoundingClientRect();
      const rightRect = rightEl.getBoundingClientRect();
      next.push({
        key: `${l}:${r}`,
        x1: leftRect.right - containerRect.left,
        y1: leftRect.top + leftRect.height / 2 - containerRect.top,
        x2: rightRect.left - containerRect.left,
        y2: rightRect.top + rightRect.height / 2 - containerRect.top,
        color: PAIR_COLORS[i % PAIR_COLORS.length],
      });
    });
    setLines(next);
  };

  useLayoutEffect(() => {
    recomputeLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs.map((p) => p.join(':')).join(',')]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(recomputeLines);
    observer.observe(container);
    window.addEventListener('resize', recomputeLines);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recomputeLines);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs.map((p) => p.join(':')).join(',')]);

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
    <div ref={containerRef} className="relative">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        {lines.map((line) => (
          <g key={line.key}>
            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={line.color} strokeWidth={2} />
            <circle cx={line.x1} cy={line.y1} r={3} fill={line.color} />
            <circle cx={line.x2} cy={line.y2} r={3} fill={line.color} />
          </g>
        ))}
      </svg>
      <div className="relative grid grid-cols-2 gap-4" style={{ zIndex: 2 }}>
        <div className="space-y-2">
          {shuffledLeft.map((item) => {
            const matchedTo = matchedLeft.get(item.id);
            const color = matchedTo ? colorOf(item.id, matchedTo) : undefined;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                ref={(el) => {
                  if (el) leftRefs.current.set(item.id, el);
                  else leftRefs.current.delete(item.id);
                }}
                onClick={() => (matchedTo ? removePair(item.id) : pickLeft(item.id))}
                className={`w-full min-h-[3rem] flex items-center text-left p-2 rounded-lg border-2 bg-white ${
                  selectedLeft === item.id ? 'border-primary-500 bg-primary-50' : !color ? 'border-surface-200' : ''
                } ${disabled ? 'opacity-60' : 'hover:border-primary-300'}`}
                style={color ? { borderColor: color, backgroundColor: `${color}14` } : undefined}
              >
                {item.text}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {shuffledRight.map((item) => {
            const pairEntry = pairs.find(([, r]) => r === item.id);
            const color = pairEntry ? colorOf(pairEntry[0], item.id) : undefined;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                ref={(el) => {
                  if (el) rightRefs.current.set(item.id, el);
                  else rightRefs.current.delete(item.id);
                }}
                onClick={() => pickRight(item.id)}
                className={`w-full min-h-[3rem] flex items-center text-left p-2 rounded-lg border-2 bg-white ${
                  !color ? 'border-surface-200' : ''
                } ${disabled ? 'opacity-60' : 'hover:border-primary-300'}`}
                style={color ? { borderColor: color, backgroundColor: `${color}14` } : undefined}
              >
                {item.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
