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
export default function SubmissionDetailLink({ submissionId }: Props) {
  // Основной разбор (вывод vs ожидание по тестам) теперь виден прямо в блоке
  // результата, поэтому ссылка нейтральная — на полную страницу с кодом и историей.
  return (
    <Link
      to={`/submissions/${submissionId}`}
      className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-surface-200 bg-white text-primary-600 hover:bg-surface-50 text-sm font-semibold transition-colors"
    >
      <span>Открыть подробный разбор</span>
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </Link>
  );
}
