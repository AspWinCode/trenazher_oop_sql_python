import type { ParameterAdjustmentAnswer, ParameterAdjustmentConfig, RendererProps } from '../types';

// Tiny safe arithmetic evaluator for the live preview only — mirrors the
// backend's restricted grammar (+-*/^, parens, named variables, numbers).
// The authoritative check always happens server-side; this is just UX.
function safeEvalPreview(expr: string, vars: Record<string, number>): number | null {
  try {
    let i = 0;
    const peek = () => expr[i];
    const isDigit = (c: string) => c >= '0' && c <= '9';
    const isIdentChar = (c: string) => /[a-zA-Z0-9_]/.test(c);
    const skipSpace = () => {
      while (i < expr.length && expr[i] === ' ') i++;
    };
    function parseExpr(): number {
      let value = parseTerm();
      skipSpace();
      while (peek() === '+' || peek() === '-') {
        const op = expr[i++];
        const rhs = parseTerm();
        value = op === '+' ? value + rhs : value - rhs;
        skipSpace();
      }
      return value;
    }
    function parseTerm(): number {
      let value = parseFactor();
      skipSpace();
      while (peek() === '*' || peek() === '/' || peek() === '%') {
        const op = expr[i++];
        const rhs = parseFactor();
        value = op === '*' ? value * rhs : op === '/' ? value / rhs : value % rhs;
        skipSpace();
      }
      return value;
    }
    function parseFactor(): number {
      skipSpace();
      if (peek() === '+' || peek() === '-') {
        const op = expr[i++];
        const v = parseFactor();
        return op === '-' ? -v : v;
      }
      let base = parseAtom();
      skipSpace();
      if (peek() === '^') {
        i++;
        const exp = parseFactor();
        base = Math.pow(base, exp);
      }
      return base;
    }
    function parseAtom(): number {
      skipSpace();
      if (peek() === '(') {
        i++;
        const v = parseExpr();
        skipSpace();
        if (peek() !== ')') throw new Error('expected )');
        i++;
        return v;
      }
      if (peek() && isDigit(peek())) {
        let start = i;
        while (i < expr.length && (isDigit(expr[i]) || expr[i] === '.')) i++;
        return parseFloat(expr.slice(start, i));
      }
      if (peek() && /[a-zA-Z_]/.test(peek())) {
        let start = i;
        while (i < expr.length && isIdentChar(expr[i])) i++;
        const name = expr.slice(start, i);
        if (!(name in vars)) throw new Error(`unknown variable ${name}`);
        return vars[name];
      }
      throw new Error('unexpected token');
    }
    const result = parseExpr();
    skipSpace();
    if (i !== expr.length) return null;
    return result;
  } catch {
    return null;
  }
}

export default function ParameterAdjustmentRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<ParameterAdjustmentConfig, ParameterAdjustmentAnswer>) {
  const values = {
    ...Object.fromEntries(config.parameters.map((p) => [p.id, p.default])),
    ...(value?.values ?? {}),
  };

  const setValue = (id: string, v: number) => {
    onAnswerChange({ values: { ...values, [id]: v } });
  };

  const preview = safeEvalPreview(config.formula, values);

  return (
    <div className="space-y-4">
      {config.prompt && <div className="text-sm text-surface-500">{config.prompt}</div>}
      {config.parameters.map((p) => (
        <div key={p.id} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{p.label}</span>
            <span className="text-surface-400">{values[p.id]}</span>
          </div>
          <input
            type="range"
            min={p.min}
            max={p.max}
            step={p.step}
            value={values[p.id]}
            disabled={disabled}
            onChange={(e) => setValue(p.id, Number(e.target.value))}
            className="w-full"
          />
        </div>
      ))}
      {preview != null && (
        <div className="text-sm bg-surface-50 rounded-lg p-3">
          Результат: <span className="font-semibold">{Math.round(preview * 100) / 100}</span>
        </div>
      )}
    </div>
  );
}
