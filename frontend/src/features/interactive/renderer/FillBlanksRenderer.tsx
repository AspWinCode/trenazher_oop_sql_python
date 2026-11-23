import { useMemo } from 'react';
import type { FillBlanksAnswer, FillBlanksConfig, RendererProps } from '../types';

const BLANK_RE = /\{\{(\w+)\}\}/g;

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function FillBlanksRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<FillBlanksConfig, FillBlanksAnswer>) {
  // Always shuffled: the correct option for a select/drag blank is often
  // authored first, which lets a student just pick the top choice.
  const blanks = useMemo(
    () => config.blanks.map((b) => (b.options ? { ...b, options: shuffled(b.options) } : b)),
    [config],
  );
  const blanksById = new Map(blanks.map((b) => [b.id, b]));
  const filled = value?.blanks ?? {};

  const setBlank = (id: string, val: string) => {
    onAnswerChange({ blanks: { ...filled, [id]: val } });
  };

  const parts: Array<{ text: string } | { blankId: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  BLANK_RE.lastIndex = 0;
  while ((match = BLANK_RE.exec(config.template))) {
    if (match.index > lastIndex) parts.push({ text: config.template.slice(lastIndex, match.index) });
    parts.push({ blankId: match[1] });
    lastIndex = BLANK_RE.lastIndex;
  }
  if (lastIndex < config.template.length) parts.push({ text: config.template.slice(lastIndex) });

  return (
    <div className="leading-relaxed text-base">
      {parts.map((part, i) => {
        if ('text' in part) return <span key={i}>{part.text}</span>;
        const blank = blanksById.get(part.blankId);
        if (!blank) return <span key={i} className="text-red-500">[{part.blankId}?]</span>;
        const current = filled[blank.id] ?? '';

        if (blank.input_mode === 'select' || blank.input_mode === 'drag') {
          return (
            <select
              key={i}
              value={current}
              disabled={disabled}
              onChange={(e) => setBlank(blank.id, e.target.value)}
              className="inline-block mx-1 border border-surface-300 rounded px-1 py-0.5"
            >
              <option value="" disabled>
                — выбрать —
              </option>
              {(blank.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          );
        }

        return (
          <input
            key={i}
            type={blank.input_mode === 'number' ? 'number' : 'text'}
            value={current}
            disabled={disabled}
            onChange={(e) => setBlank(blank.id, e.target.value)}
            className="inline-block mx-1 w-28 border border-surface-300 rounded px-2 py-0.5"
          />
        );
      })}
    </div>
  );
}
