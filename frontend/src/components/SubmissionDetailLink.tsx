import { Link } from 'react-router-dom';
import type { Verdict } from '../types';

interface Props {
  submissionId: number;
  verdict: Verdict | null;
}

/**
 * Кнопка-призыв на панели результата: ведёт на /submissions/:id, где
 * ученик видит полный traceback и разбор по тестам. При ошибке оформлена
 * акцентно, при успехе — мягко. Общий компонент для TaskPage и CourseLearnPage.
 */
export default function SubmissionDetailLink({ submissionId, verdict }: Props) {
  const isError = verdict != null && verdict !== 'AC';

  const className = isError
    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
    : 'border-surface-200 bg-white text-primary-600 hover:bg-surface-50';

  return (
    <Link
      to={`/submissions/${submissionId}`}
      className={`mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors ${className}`}
    >
      {isError && (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      )}
      <span>{isError ? 'Посмотреть, что пошло не так' : 'Открыть подробный разбор'}</span>
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </Link>
  );
}
