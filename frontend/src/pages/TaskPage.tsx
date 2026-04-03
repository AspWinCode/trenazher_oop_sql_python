import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { tasksApi } from '../api';
import type { TaskCourseContext } from '../api';
import CodeEditor from '../components/CodeEditor';
import Markdown from '../components/Markdown';
import VerdictBadge from '../components/VerdictBadge';
import { useSubmissionWatcher } from '../features/task/hooks/useSubmissionWatcher';
import { useTaskData } from '../features/task/hooks/useTaskData';

export default function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [courseContext, setCourseContext] = useState<TaskCourseContext[]>([]);

  useEffect(() => {
    if (!taskId) return;
    tasksApi.getCourseContext(Number(taskId))
      .then(({ data }) => setCourseContext(data))
      .catch(() => {});
  }, [taskId]);

  const {
    task,
    code,
    setCode,
    history,
    hints,
    loading,
    showHints,
    setShowHints,
    refreshHistory,
    refreshHints,
    draftSavedAt,
    clearDraft,
  } = useTaskData(taskId);

  const { submission, submitting, submitSolution } = useSubmissionWatcher({
    refreshHistory,
    refreshHints,
  });

  const [saveFlash, setSaveFlash] = useState(false);

  const handleSubmit = async () => {
    if (!task) return;
    await submitSolution(task.id, code);
  };

  const handleSave = useCallback(() => {
    setCode(code); // triggers localStorage save
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  }, [code, setCode]);

  if (loading) return <div className="text-center py-20 text-surface-300">Загрузка...</div>;
  if (!task) return <div className="text-center py-20 text-red-500">Задача не найдена</div>;

  const langMap: Record<string, string> = { sql_query: 'sql', cpp_io: 'cpp', js_io: 'javascript' };
  const lang = langMap[task.task_type] || 'python';
  const publicTests = task.tests?.filter((t) => t.test_type === 'public') || [];

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-1">
        <Link to="/tasks" className="text-sm text-primary-600 hover:underline">&larr; К задачам</Link>
        {courseContext.map((ctx) => (
          <Link
            key={ctx.course_id}
            to={`/course/${ctx.course_id}`}
            className="text-sm text-surface-400 hover:text-primary-600 flex items-center gap-1"
          >
            <span>📚</span>
            <span>{ctx.course_title}</span>
            {ctx.node_title && <span className="text-surface-300">› {ctx.node_title}</span>}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <div className="flex gap-2 mt-1">
            <span className="badge-blue">{task.task_type}</span>
            <span className="badge-gray">v{task.version}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          {task.description && (
            <div className="card">
              <h2 className="text-sm font-semibold text-dark-700 mb-3">Описание</h2>
              <Markdown content={task.description} />
            </div>
          )}
          {task.task_type === 'sql_query' && (task.sql_schema || task.sql_seed) && (
            <div className="card">
              <h2 className="text-sm font-semibold text-dark-700 mb-3">Структура базы данных</h2>
              {task.sql_schema && (
                <div className="mb-3">
                  <div className="text-xs text-surface-400 mb-1 font-medium">Схема таблиц:</div>
                  <pre className="bg-dark-900 text-green-400 rounded-lg p-3 text-xs font-mono overflow-auto whitespace-pre-wrap">{task.sql_schema}</pre>
                </div>
              )}
              {task.sql_seed && (
                <div>
                  <div className="text-xs text-surface-400 mb-1 font-medium">Начальные данные:</div>
                  <pre className="bg-dark-900 text-blue-300 rounded-lg p-3 text-xs font-mono overflow-auto whitespace-pre-wrap">{task.sql_seed}</pre>
                </div>
              )}
            </div>
          )}
          {publicTests.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-dark-700 mb-3">Примеры</h2>
              <div className="space-y-3">
                {publicTests.map((t, i) => {
                  // For pytest/SQL tasks the expected_output is internal code — hide from students
                  const isCodeTest = task.task_type === 'python_oop'
                    || task.task_type === 'python_numpy'
                    || task.task_type === 'sql_query';
                  if (isCodeTest) return null;
                  return (
                    <div key={t.id} className="bg-surface-50 rounded-lg p-3 text-sm">
                      <div className="font-medium text-dark-700 mb-1">Тест {i + 1}</div>
                      {t.input_data && <div><span className="text-surface-300">Вход:</span> <code className="bg-surface-200 px-1 rounded">{t.input_data}</code></div>}
                      {t.expected_output && <div className="mt-1"><span className="text-surface-300">Ожидаемый выход:</span> <code className="bg-surface-200 px-1 rounded">{t.expected_output}</code></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {task.lectures && task.lectures.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-dark-700 mb-3">Материалы</h2>
              {task.lectures.map((l) => (
                <Markdown key={l.id} content={l.content} />
              ))}
            </div>
          )}
          {hints.length > 0 && (
            <div className="card">
              <button onClick={() => setShowHints(!showHints)} className="text-sm font-semibold text-primary-600 hover:underline">
                {showHints ? 'Скрыть подсказки' : `Показать подсказки (${hints.length})`}
              </button>
              {showHints && (
                <div className="space-y-2 mt-3">
                  {hints.map((h) => (
                    <div key={h.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                      <div className="font-medium text-yellow-800">Подсказка {h.hint_level}</div>
                      <div className="text-yellow-700 mt-1">{h.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-dark-800 text-white">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Решение</span>
                {draftSavedAt && (
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Черновик сохранён
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {draftSavedAt && (
                  <button
                    type="button"
                    onClick={clearDraft}
                    className="text-xs text-surface-400 hover:text-white transition-colors"
                    title="Сбросить код к начальному шаблону"
                  >
                    Сбросить
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  className={`btn-sm border transition-all ${
                    saveFlash
                      ? 'border-green-400 text-green-400'
                      : 'border-surface-500 text-surface-300 hover:text-white hover:border-white'
                  }`}
                >
                  {saveFlash ? '✓ Сохранено' : 'Сохранить'}
                </button>
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary btn-sm">
                  {submitting ? 'Проверка...' : 'Отправить'}
                </button>
              </div>
            </div>
            <CodeEditor value={code} onChange={setCode} language={lang} height="350px" />
          </div>

          {submission && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-dark-700">Результат</h2>
                <div className="flex items-center gap-2">
                  {submission.status !== 'finished' && (
                    <div className="flex items-center gap-1 text-sm text-primary-600">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {submission.status === 'queued' ? 'В очереди...' : 'Выполняется...'}
                    </div>
                  )}
                  <VerdictBadge verdict={submission.verdict} />
                </div>
              </div>
              {submission.runtime != null && (
                <div className="text-xs text-surface-300 mb-3">Время: {submission.runtime.toFixed(3)}s</div>
              )}
              {submission.error_output && (
                <pre className="bg-red-50 text-red-800 text-xs p-3 rounded-lg overflow-auto max-h-40">{submission.error_output}</pre>
              )}
              {submission.test_results && submission.test_results.length > 0 && (
                <div className="space-y-2">
                  {submission.test_results.map((tr, i) => (
                    <div key={tr.id} className="flex items-center gap-3 text-sm bg-surface-50 p-2 rounded-lg">
                      <span className="text-surface-300 w-16">Тест {i + 1}</span>
                      <VerdictBadge verdict={tr.verdict} />
                      {tr.runtime != null && <span className="text-xs text-surface-300">{tr.runtime.toFixed(3)}s</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {history.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-dark-700 mb-3">История отправок</h2>
              <div className="space-y-1">
                {history.slice(0, 10).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-surface-100 last:border-0">
                    <span className="text-surface-300">#{s.id}</span>
                    <VerdictBadge verdict={s.verdict} />
                    <span className="text-xs text-surface-300">{new Date(s.created_at).toLocaleString('ru')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
