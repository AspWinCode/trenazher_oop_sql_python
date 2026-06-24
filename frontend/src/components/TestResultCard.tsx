import VerdictBadge from './VerdictBadge';
import type { SubmissionTestResult } from '../types';

interface Props {
  index: number;
  result: SubmissionTestResult;
}

interface DiffRow {
  actual: string;
  expected: string;
  diff: boolean;
}

function stripTrailingNewline(s: string): string {
  return s.replace(/\n+$/, '');
}

/** Построчное сравнение вывода с ожидаемым для подсветки различий. */
function buildDiff(actual: string, expected: string): DiffRow[] {
  const a = stripTrailingNewline(actual).split('\n');
  const e = stripTrailingNewline(expected).split('\n');
  const n = Math.max(a.length, e.length);
  const rows: DiffRow[] = [];
  for (let i = 0; i < n; i++) {
    const actualLine = a[i] ?? '';
    const expectedLine = e[i] ?? '';
    rows.push({ actual: actualLine, expected: expectedLine, diff: actualLine !== expectedLine });
  }
  return rows;
}

function OutputColumn({
  title,
  rows,
  side,
  empty,
}: {
  title: string;
  rows: DiffRow[];
  side: 'actual' | 'expected';
  empty?: string;
}) {
  const hasContent = rows.some((r) => (side === 'actual' ? r.actual : r.expected) !== '');
  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium text-surface-400 mb-1">{title}</div>
      <pre className="bg-white border border-surface-200 rounded-lg text-xs font-mono overflow-auto max-h-48 leading-relaxed">
        {!hasContent && empty ? (
          <div className="px-2 py-1.5 text-surface-300 italic">{empty}</div>
        ) : (
          rows.map((r, i) => {
            const line = side === 'actual' ? r.actual : r.expected;
            const hl = r.diff
              ? side === 'actual'
                ? 'bg-red-100 text-red-800'
                : 'bg-green-100 text-green-800'
              : 'text-dark-700';
            return (
              <div key={i} className={`px-2 ${hl}`}>
                {line === '' ? ' ' : line}
              </div>
            );
          })
        )}
      </pre>
    </div>
  );
}

/**
 * Карточка результата одного теста: вердикт + две колонки «ваш вывод» / «ожидается»
 * с подсветкой расхождений. Ожидаемое показывается только когда бэкенд его отдал
 * (публичные тесты IO-задач); у скрытых тестов правая колонка маскируется.
 * Общий компонент для TaskPage и CourseLearnPage.
 */
export default function TestResultCard({ index, result }: Props) {
  const isPass = result.verdict === 'AC';
  const isHidden = result.test_type === 'hidden';
  const hasExpected = result.expected_output != null;
  const actual = result.actual_output ?? '';

  const rows = hasExpected ? buildDiff(actual, result.expected_output ?? '') : [];

  return (
    <div
      className={`rounded-xl border p-3 ${
        isPass ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-medium text-dark-700">Тест {index + 1}</span>
        {isHidden && <span className="text-xs text-surface-400">🔒 скрытый</span>}
        <VerdictBadge verdict={result.verdict} />
        {result.runtime != null && (
          <span className="text-xs text-surface-400 ml-auto">{result.runtime.toFixed(3)}с</span>
        )}
      </div>

      {hasExpected ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <OutputColumn title="Результат вашего кода" rows={rows} side="actual" empty="нет вывода" />
          <OutputColumn title="Какой результат должен быть" rows={rows} side="expected" />
        </div>
      ) : (
        <div>
          <div className="text-xs font-medium text-surface-400 mb-1">Результат вашего кода</div>
          <pre className="bg-white border border-surface-200 rounded-lg text-xs font-mono overflow-auto max-h-48 leading-relaxed px-2 py-1.5 text-dark-700 whitespace-pre-wrap">
            {actual || <span className="text-surface-300 italic">нет вывода</span>}
          </pre>
          {isHidden && (
            <div className="text-xs text-surface-400 mt-1">
              🔒 Это скрытый тест — ожидаемый результат не показывается.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
