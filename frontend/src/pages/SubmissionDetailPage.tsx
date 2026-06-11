import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { submissionsApi } from '../api';
import type { Submission } from '../types';
import VerdictBadge from '../components/VerdictBadge';
import CodeEditor from '../components/CodeEditor';
import { useSubmissionLive } from '../features/task/hooks/useSubmissionLive';

type Tab = 'error' | 'tests' | 'code';

const ERROR_VERDICTS = new Set(['RE', 'WA', 'CE', 'IE']);

function defaultTab(submission: Submission): Tab {
  if (submission.verdict && ERROR_VERDICTS.has(submission.verdict)) return 'error';
  return 'tests';
}

const langMap: Record<string, string> = {
  sql_query: 'sql',
  cpp_io: 'cpp',
  js_io: 'javascript',
};

export default function SubmissionDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('tests');
  const userPickedTab = useRef(false);

  useEffect(() => {
    if (!submissionId) return;
    userPickedTab.current = false;
    setLoading(true);
    submissionsApi
      .get(Number(submissionId))
      .then(({ data }) => setSubmission(data))
      .catch((err: { response?: { status?: number } }) => {
        if (err.response?.status === 404) setError('Отправка не найдена');
        else if (err.response?.status === 403) setError('Нет доступа к этой отправке');
        else setError('Ошибка загрузки');
      })
      .finally(() => setLoading(false));
  }, [submissionId]);

  // Live-обновление, пока отправка не завершена
  useSubmissionLive(
    submission?.id ?? null,
    submission != null && submission.status !== 'finished',
    setSubmission,
  );

  // Пока ученик сам не выбрал вкладку — держим вкладку по умолчанию,
  // в том числе после того как отправка завершится с ошибкой
  useEffect(() => {
    if (submission && !userPickedTab.current) {
      setTab(defaultTab(submission));
    }
  }, [submission]);

  const selectTab = (key: Tab) => {
    userPickedTab.current = true;
    setTab(key);
  };

  if (loading) return <div className="text-center py-20 text-surface-300">Загрузка...</div>;
  if (error || !submission) {
    return <div className="text-center py-20 text-red-500">{error ?? 'Отправка не найдена'}</div>;
  }

  const isFinished = submission.status === 'finished';
  const passedCount = submission.test_results?.filter((tr) => tr.verdict === 'AC').length ?? 0;
  const totalCount = submission.test_results?.length ?? 0;
  const lang = langMap[submission.task_type ?? ''] ?? 'python';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'error', label: 'Ошибка' },
    { key: 'tests', label: 'Тесты' },
    { key: 'code', label: 'Код' },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-surface-400 mb-5 flex-wrap">
        <Link to={`/task/${submission.task_id}`} className="text-primary-600 hover:underline">
          &larr; Задача #{submission.task_id}
        </Link>
        <span className="text-surface-300">›</span>
        <span>Отправка #{submission.id}</span>
      </div>

      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <h1 className="text-2xl font-bold">Отправка #{submission.id}</h1>
        {isFinished ? (
          <VerdictBadge verdict={submission.verdict} />
        ) : (
          <span className="badge-gray flex items-center gap-1.5">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {submission.status === 'queued' ? 'В очереди' : 'Выполняется'}
          </span>
        )}
      </div>

      <div className="flex gap-4 text-sm text-surface-300 mb-6 flex-wrap">
        <span>{new Date(submission.created_at).toLocaleString('ru')}</span>
        {submission.runtime != null && (
          <span>Время: {submission.runtime.toFixed(3)}s</span>
        )}
        {isFinished && totalCount > 0 && (
          <span>
            Тесты:{' '}
            <span className={passedCount === totalCount ? 'text-green-500' : 'text-red-400'}>
              {passedCount}/{totalCount}
            </span>
          </span>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex border-b border-surface-100">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => selectTab(key)}
              className={`px-5 py-3 text-sm transition-colors flex items-center gap-1.5 ${
                tab === key
                  ? 'border-b-2 border-primary-600 text-primary-600 font-medium -mb-px'
                  : 'text-surface-400 hover:text-dark-700'
              }`}
            >
              {key === 'error' && submission.error_output && (
                <span className="inline-block w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
              )}
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'error' && (
            submission.error_output ? (
              <pre className="bg-red-50 text-red-800 text-xs p-4 rounded-lg overflow-auto whitespace-pre-wrap leading-relaxed">
                {submission.error_output}
              </pre>
            ) : (
              <p className="text-surface-300 text-sm">Ошибок нет</p>
            )
          )}

          {tab === 'tests' && (
            submission.test_results && submission.test_results.length > 0 ? (
              <div className="space-y-2">
                {submission.test_results.map((tr, i) => (
                  <div key={tr.id} className="bg-surface-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-surface-300 text-sm w-16 flex-shrink-0">Тест {i + 1}</span>
                      <VerdictBadge verdict={tr.verdict} />
                      {tr.runtime != null && (
                        <span className="text-xs text-surface-300">{tr.runtime.toFixed(3)}s</span>
                      )}
                    </div>
                    {tr.actual_output && (
                      <pre className="text-xs text-surface-400 font-mono bg-surface-100 rounded p-2 mt-2 overflow-auto whitespace-pre-wrap">
                        {tr.actual_output}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-surface-300 text-sm">Нет данных по тестам</p>
            )
          )}

          {tab === 'code' && (
            <CodeEditor
              value={submission.code}
              onChange={() => {}}
              language={lang}
              height="350px"
              readOnly
            />
          )}
        </div>
      </div>
    </div>
  );
}
