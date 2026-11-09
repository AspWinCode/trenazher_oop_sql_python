import type { FillBlanksAnswer, FillBlanksConfig, RendererProps } from '../types';

const BLANK_RE = /\{\{(\w+)\}\}/g;

export default function FillBlanksRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<FillBlanksConfig, FillBlanksAnswer>) {
  const blanksById = new Map(config.blanks.map((b) => [b.id, b]));
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
