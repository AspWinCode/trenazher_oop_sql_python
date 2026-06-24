import { useEffect, useMemo, useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  courseStudentApi,
  coursesApi,
  guestApi,
  type CourseNodeTree,
  type NodeTaskProgress,
} from '../api';
import { useAuthStore } from '../store/auth';
import CodeEditor from '../components/CodeEditor';
import Markdown from '../components/Markdown';
import VerdictBadge from '../components/VerdictBadge';
import SubmissionDetailLink from '../components/SubmissionDetailLink';
import TestResultCard from '../components/TestResultCard';
import { useTaskData } from '../features/task/hooks/useTaskData';
import { useSubmissionWatcher } from '../features/task/hooks/useSubmissionWatcher';
import { useCourseLearnStore, type CourseSidebarItem } from '../store/courseLearn';

// ── Утилиты ───────────────────────────────────────────────────────────────────

function collectNodeIds(nodes: CourseNodeTree[]): number[] {
  const ids: number[] = [];
  nodes.forEach((n) => {
    ids.push(n.id);
    if (n.children.length > 0) ids.push(...collectNodeIds(n.children));
  });
  return ids;
}

function flattenTree(
  nodes: CourseNodeTree[],
  nodeTasks: Record<number, NodeTaskProgress[]>,
  prefix = '',
  depth = 0,
): CourseSidebarItem[] {
  const items: CourseSidebarItem[] = [];
  nodes.forEach((node, idx) => {
    const num = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
    items.push({ kind: 'section', nodeId: node.id, number: num, label: node.title, depth });
    const tasks = nodeTasks[node.id] ?? [];
    tasks.forEach((t, ti) => {
      items.push({
        kind: 'task',
        nodeId: node.id,
        taskId: t.task_id,
        nodeTaskId: t.node_task_id,
        number: `${num}.${ti + 1}`,
        label: t.task_title || `Задача #${t.task_id}`,
        status: t.status,
        depth: depth + 1,
      });
    });
    if (node.children.length > 0) {
      items.push(...flattenTree(node.children, nodeTasks, num, depth + 1));
    }
  });
  return items;
}

// ── Решатель задачи ───────────────────────────────────────────────────────────
function TaskSolver({
  taskId,
  taskNumber,
  totalTasks,
  onNext,
  onPrev,
  onSolved,
}: {
  taskId: string;
  taskNumber: number;
  totalTasks: number;
  onNext: () => void;
  onPrev: () => void;
  onSolved?: () => void;
}) {
  const {
    task, code, setCode, history, hints, loading,
    showHints, setShowHints, refreshHistory, refreshHints,
    draftSavedAt, clearDraft,
  } = useTaskData(taskId);

  const { submission, submitting, submitSolution } = useSubmissionWatcher({
    refreshHistory,
    refreshHints,
  });

  const [saveFlash, setSaveFlash] = useState(false);
  const handleSave = useCallback(() => {
    setCode(code);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  }, [code, setCode]);

  // При успешном решении (AC) обновляем сайдбар курса
  useEffect(() => {
    if (submission?.status === 'finished' && submission?.verdict === 'AC' && onSolved) {
      onSolved();
    }
  }, [submission?.status, submission?.verdict, onSolved]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-full text-surface-400 gap-2">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Загрузка задачи...
      </div>
    );
  if (!task)
    return <div className="flex items-center justify-center h-full text-red-500">Задача не найдена</div>;

  const langMap: Record<string, string> = { sql_query: 'sql', cpp_io: 'cpp', js_io: 'javascript' };
  const lang = langMap[task.task_type] || 'python';
  const publicTests = task.tests?.filter((t) => t.test_type === 'public') ?? [];
  const isCorrect = submission?.verdict === 'AC';
  const completedCount = history.filter((s) => s.verdict === 'AC').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Топбар */}
      <div className="shrink-0 px-6 py-3 border-b border-surface-100 bg-white flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold text-dark-700 truncate">{task.title}</span>
          <span className="badge-blue shrink-0">{task.task_type}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-sm text-surface-400">
          {history.length > 0 && (
            <span>{completedCount > 0 ? '✅' : '🔄'} {history.length} попыток</span>
          )}
          <span className="text-surface-300">Задача {taskNumber} из {totalTasks}</span>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ── Левая колонка: условие + примеры + подсказки + история ── */}
          <div className="space-y-4">
            {task.description && (
              <div className="prose prose-sm max-w-none">
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
              <div className="space-y-3">
                {publicTests.map((t) => {
                  // For pytest/SQL tasks the expected_output is code — don't show it to students
                  const isCodeTest = task.task_type === 'python_oop'
                    || task.task_type === 'python_numpy'
                    || task.task_type === 'sql_query';
                  if (isCodeTest) return null;
                  return (
                    <div key={t.id} className="rounded-xl border border-surface-100 overflow-hidden text-sm">
                      {t.input_data && (
                        <div className="px-4 py-2.5 bg-surface-50 border-b border-surface-100">
                          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-1">Sample Input:</div>
                          <code className="text-dark-700 font-mono whitespace-pre-wrap">{t.input_data}</code>
                        </div>
                      )}
                      {t.expected_output && (
                        <div className="px-4 py-2.5 bg-white">
                          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-1">Sample Output:</div>
                          <code className="text-dark-700 font-mono whitespace-pre-wrap">{t.expected_output}</code>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {hints.length > 0 && (
              <div>
                <button
                  onClick={() => setShowHints(!showHints)}
                  className="text-sm text-primary-500 hover:text-primary-600 font-medium"
                >
                  {showHints ? 'Скрыть подсказки' : `💡 Подсказки (${hints.length})`}
                </button>
                {showHints && (
                  <div className="space-y-2 mt-2">
                    {hints.map((h) => (
                      <div key={h.id} className="bg-warning-50 border border-warning-200 rounded-xl p-3 text-sm">
                        <div className="font-semibold text-warning-800 mb-1">Подсказка {h.hint_level}</div>
                        <div className="text-warning-700">{h.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {history.length > 0 && (
              <details>
                <summary className="text-sm text-surface-400 cursor-pointer hover:text-surface-500 select-none">
                  История отправок ({history.length})
                </summary>
                <div className="mt-2 space-y-1">
                  {history.slice(0, 10).map((s) => (
                    <Link
                      key={s.id}
                      to={`/submissions/${s.id}`}
                      className="flex items-center justify-between text-sm py-1.5 border-b border-surface-100 last:border-0 hover:bg-surface-50 rounded transition-colors px-1 -mx-1"
                    >
                      <span className="text-surface-400 text-xs">#{s.id}</span>
                      <VerdictBadge verdict={s.verdict} />
                      <span className="flex items-center gap-1 text-xs text-surface-400">
                        {new Date(s.created_at).toLocaleString('ru')}
                        <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* ── Правая колонка: редактор с кнопкой + результат ── */}
          <div className="space-y-3">
            {/* Редактор */}
            <div className="rounded-xl border border-surface-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-dark-900 text-white text-sm font-medium flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span>Напишите программу{lang !== 'python' ? ` (${lang})` : ''}</span>
                  {draftSavedAt && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Черновик сохранён
                    </span>
                  )}
                </div>
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
              </div>
              <CodeEditor value={code} onChange={setCode} language={lang} height="320px" />
              {/* Кнопки сохранения и отправки */}
              <div className="px-4 py-3 bg-dark-800 border-t border-dark-700 flex items-center gap-3">
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
                <button
                  onClick={() => submitSolution(task.id, code)}
                  disabled={submitting}
                  className="btn-primary flex-1"
                >
                  {submitting
                    ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Проверка...</>
                    : '▶  Отправить решение'}
                </button>
                {isCorrect && taskNumber < totalTasks && (
                  <button onClick={onNext} className="btn-success">
                    Следующий шаг →
                  </button>
                )}
              </div>
            </div>

            {/* Результат проверки */}
            {submission && (
              <div className={`rounded-xl border p-4 text-sm ${
                isCorrect
                  ? 'border-accent-300 bg-accent-50'
                  : submission.status !== 'finished'
                  ? 'border-sky-200 bg-sky-50'
                  : 'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {submission.status !== 'finished' && (
                      <svg className="w-4 h-4 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    )}
                    <span className={`font-semibold ${isCorrect ? 'text-accent-700' : submission.status !== 'finished' ? 'text-primary-600' : 'text-red-600'}`}>
                      {isCorrect ? 'Верно! ✅'
                        : submission.status !== 'finished'
                        ? (submission.status === 'queued' ? 'В очереди...' : 'Выполняется...')
                        : 'Неверно ❌'}
                    </span>
                  </div>
                  <VerdictBadge verdict={submission.verdict} />
                </div>
                {submission.runtime != null && (
                  <div className="text-xs text-surface-400 mb-2">Время: {submission.runtime.toFixed(3)}с</div>
                )}
                {submission.error_output && (
                  <details className="mt-2" open>
                    <summary className="cursor-pointer text-xs font-medium text-red-600 mb-1">
                      Подробности ошибки (трассировка)
                    </summary>
                    <pre className="bg-white border border-red-100 text-red-800 text-xs p-3 rounded-lg overflow-auto max-h-36 font-mono">
                      {submission.error_output}
                    </pre>
                  </details>
                )}
                {submission.test_results && submission.test_results.length > 0 && (
                  <div className="space-y-3 mt-3">
                    {submission.test_results.map((tr, i) => (
                      <TestResultCard key={tr.id} index={i} result={tr} />
                    ))}
                  </div>
                )}
                {submission.status === 'finished' && (
                  <SubmissionDetailLink submissionId={submission.id} verdict={submission.verdict} />
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Нижняя панель — только навигация */}
      <div className="shrink-0 px-6 py-3 border-t border-surface-100 bg-white flex items-center justify-between">
        <span className="text-xs text-surface-400">Задача {taskNumber} из {totalTasks}</span>
        <div className="flex items-center gap-2">
          <button onClick={onPrev} disabled={taskNumber <= 1} className="btn-secondary btn-sm disabled:opacity-40">
            ← Назад
          </button>
          <button onClick={onNext} disabled={taskNumber >= totalTasks} className="btn-secondary btn-sm disabled:opacity-40">
            Вперёд →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Главная страница ──────────────────────────────────────────────────────────
export default function CourseLearnPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const isGuest = useAuthStore((s) => s.user?.is_guest ?? false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const { setCourseData, setSelectedTaskId, clear } = useCourseLearnStore();
  const selectedTaskId = searchParams.get('task') ? Number(searchParams.get('task')) : null;

  const reloadCourseData = useCallback(() => {
    setReloadTrigger((n) => n + 1);
  }, []);

  // Очистка стора при уходе со страницы курса
  useEffect(() => {
    return () => { clear(); };
  }, []);

  // Загрузка курса + дерева + задач всех узлов
  useEffect(() => {
    if (!courseId) return;
    const id = Number(courseId);

    Promise.all([coursesApi.get(id), courseStudentApi.getTree(id)])
      .then(async ([cRes, tRes]) => {
        const course = cRes.data;
        const tree: CourseNodeTree[] = tRes.data;
        const allNodeIds = collectNodeIds(tree);

        // Параллельно грузим задачи всех узлов
        const results = await Promise.allSettled(
          allNodeIds.map((nid) =>
            courseStudentApi.getNodeTasks(nid).then((r) => ({ nid, tasks: r.data })),
          ),
        );
        const nodeTasks: Record<number, NodeTaskProgress[]> = {};
        results.forEach((r) => {
          if (r.status === 'fulfilled') nodeTasks[r.value.nid] = r.value.tasks;
        });

        const items = flattenTree(tree, nodeTasks);

        // Для гостя блокируем задачи сверх лимита (первые N в порядке курса доступны).
        if (isGuest) {
          let limit = 0;
          try {
            limit = (await guestApi.getConfig()).data.task_limit;
          } catch {
            limit = 0;
          }
          let taskIdx = 0;
          items.forEach((it) => {
            if (it.kind === 'task') {
              it.locked = taskIdx >= limit;
              taskIdx += 1;
            }
          });
        }

        const taskItems = items.filter((i) => i.kind === 'task');
        const completed = taskItems.filter((i) => i.status === 'completed').length;

        setCourseData(id, course.title, items, completed, taskItems.length);

        // Авто-выбор первой задачи (только при первой загрузке)
        if (reloadTrigger === 0 && !searchParams.get('task') && taskItems.length > 0 && taskItems[0].taskId) {
          setSearchParams({ task: String(taskItems[0].taskId) }, { replace: true });
        }
      })
      .catch(console.error);

    return () => { if (reloadTrigger === 0) clear(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, reloadTrigger]);

  // Синхронизируем выбранную задачу со store
  useEffect(() => {
    setSelectedTaskId(selectedTaskId);
  }, [selectedTaskId, setSelectedTaskId]);

  // Список задач для навигации
  const { sidebarItems } = useCourseLearnStore();
  const taskItems = useMemo(
    () => sidebarItems.filter((i) => i.kind === 'task'),
    [sidebarItems],
  );
  const currentIndex = taskItems.findIndex((t) => t.taskId === selectedTaskId);
  const selectedLocked = currentIndex >= 0 && !!taskItems[currentIndex]?.locked;

  const selectTask = useCallback(
    (taskId: number) => {
      setSearchParams({ task: String(taskId) });
    },
    [setSearchParams],
  );

  const goNext = useCallback(() => {
    if (currentIndex < taskItems.length - 1 && taskItems[currentIndex + 1].taskId)
      selectTask(taskItems[currentIndex + 1].taskId!);
  }, [currentIndex, taskItems, selectTask]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0 && taskItems[currentIndex - 1].taskId)
      selectTask(taskItems[currentIndex - 1].taskId!);
  }, [currentIndex, taskItems, selectTask]);

  if (!courseId)
    return (
      <div className="p-8 text-center">
        <Link to="/courses" className="btn-secondary">← К курсам</Link>
      </div>
    );

  return (
    <div className="-mx-6 -my-6 lg:-mx-8 lg:-my-8 overflow-hidden bg-surface-50" style={{ height: 'calc(100vh - 0px)' }}>
      {selectedTaskId && selectedLocked ? (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
          <span className="text-5xl">🔒</span>
          <div>
            <p className="font-semibold text-surface-600 text-lg">Задача недоступна в демо-режиме</p>
            <p className="text-surface-400 text-sm mt-1 max-w-md">
              В гостевом режиме открыты только первые задачи курса.
              Зарегистрируйтесь, чтобы решать все задачи и сохранять прогресс.
            </p>
          </div>
        </div>
      ) : selectedTaskId ? (
        <TaskSolver
          key={selectedTaskId}
          taskId={String(selectedTaskId)}
          taskNumber={currentIndex + 1}
          totalTasks={taskItems.length}
          onNext={goNext}
          onPrev={goPrev}
          onSolved={reloadCourseData}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-surface-400">
          <span className="text-5xl">📚</span>
          <p className="font-medium text-surface-500">
            {taskItems.length === 0 ? 'В курсе пока нет задач' : 'Выберите задачу в списке слева'}
          </p>
        </div>
      )}
    </div>
  );
}
