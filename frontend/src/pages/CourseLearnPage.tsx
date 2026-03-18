import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { courseStudentApi, coursesApi, type CourseNodeTree, type NodeTaskProgress } from '../api';
import type { Course } from '../types';
import CodeEditor from '../components/CodeEditor';
import Markdown from '../components/Markdown';
import VerdictBadge from '../components/VerdictBadge';
import { useTaskData } from '../features/task/hooks/useTaskData';
import { useSubmissionWatcher } from '../features/task/hooks/useSubmissionWatcher';

// ── Типы для плоского списка боковой панели ───────────────────────────────────
interface SidebarSection {
  kind: 'section';
  nodeId: number;
  number: string;
  label: string;
  depth: number;
}
interface SidebarTask {
  kind: 'task';
  nodeId: number;
  taskId: number;
  nodeTaskId: number;
  number: string;
  label: string;
  status: 'not_started' | 'in_progress' | 'completed';
  depth: number;
}
type SidebarItem = SidebarSection | SidebarTask;

// ── Рекурсивное сплющивание дерева в плоский список ──────────────────────────
function flattenTree(
  nodes: CourseNodeTree[],
  nodeTasks: Record<number, NodeTaskProgress[]>,
  prefix = '',
  depth = 0,
): SidebarItem[] {
  const items: SidebarItem[] = [];
  nodes.forEach((node, idx) => {
    const num = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
    items.push({ kind: 'section', nodeId: node.id, number: num, label: node.title, depth });
    // Задачи этого узла
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
    // Рекурсия в дочерние узлы
    if (node.children.length > 0) {
      items.push(...flattenTree(node.children, nodeTasks, num, depth + 1));
    }
  });
  return items;
}

// Собрать все id узлов из дерева
function collectNodeIds(nodes: CourseNodeTree[]): number[] {
  const ids: number[] = [];
  nodes.forEach((n) => {
    ids.push(n.id);
    if (n.children.length > 0) ids.push(...collectNodeIds(n.children));
  });
  return ids;
}

// ── Иконки статуса задачи ─────────────────────────────────────────────────────
function StatusDot({ status }: { status: 'not_started' | 'in_progress' | 'completed' }) {
  if (status === 'completed')
    return (
      <span className="w-5 h-5 shrink-0 rounded-full bg-green-500 flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  if (status === 'in_progress')
    return (
      <span className="w-5 h-5 shrink-0 rounded-full border-2 border-primary-500 bg-primary-100 flex items-center justify-center">
        <span className="w-2 h-2 rounded-full bg-primary-500" />
      </span>
    );
  return <span className="w-5 h-5 shrink-0 rounded-full border-2 border-surface-300 bg-white" />;
}

// ── Решатель задачи ───────────────────────────────────────────────────────────
function TaskSolver({
  taskId,
  taskNumber,
  totalTasks,
  onNext,
  onPrev,
}: {
  taskId: string;
  taskNumber: number;
  totalTasks: number;
  onNext: () => void;
  onPrev: () => void;
}) {
  const {
    task, code, setCode, history, hints, loading,
    showHints, setShowHints, refreshHistory, refreshHints,
  } = useTaskData(taskId);

  const { submission, submitting, submitSolution } = useSubmissionWatcher({
    refreshHistory,
    refreshHints,
  });

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

  const isCorrect = submission?.verdict === 'correct';
  const completedCount = history.filter((s) => s.verdict === 'correct').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Топбар с прогрессом */}
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

      {/* Основной контент — скроллируемый */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Левая колонка: условие + примеры + подсказки + история */}
          <div className="space-y-4">
            {task.description && (
              <div>
                <Markdown content={task.description} />
              </div>
            )}

            {publicTests.length > 0 && (
              <div className="space-y-3">
                {publicTests.map((t, i) => (
                  <div key={t.id} className="rounded-lg border border-surface-100 overflow-hidden text-sm">
                    {t.input_data && (
                      <div className="px-4 py-2 bg-surface-50 border-b border-surface-100">
                        <div className="text-xs font-semibold text-surface-400 uppercase mb-1">Sample Input:</div>
                        <code className="text-dark-700 font-mono whitespace-pre-wrap">{t.input_data}</code>
                      </div>
                    )}
                    {t.expected_output && (
                      <div className="px-4 py-2 bg-white">
                        <div className="text-xs font-semibold text-surface-400 uppercase mb-1">Sample Output:</div>
                        <code className="text-dark-700 font-mono whitespace-pre-wrap">{t.expected_output}</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {hints.length > 0 && (
              <div>
                <button
                  onClick={() => setShowHints(!showHints)}
                  className="text-sm text-primary-600 hover:underline font-medium"
                >
                  {showHints ? 'Скрыть подсказки' : `💡 Подсказки (${hints.length})`}
                </button>
                {showHints && (
                  <div className="space-y-2 mt-2">
                    {hints.map((h) => (
                      <div key={h.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                        <div className="font-medium text-yellow-800 mb-1">Подсказка {h.hint_level}</div>
                        <div className="text-yellow-700">{h.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {history.length > 0 && (
              <details className="group">
                <summary className="text-sm text-surface-400 cursor-pointer hover:text-surface-600 select-none">
                  История отправок ({history.length})
                </summary>
                <div className="mt-2 space-y-1">
                  {history.slice(0, 10).map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-surface-100 last:border-0">
                      <span className="text-surface-400">#{s.id}</span>
                      <VerdictBadge verdict={s.verdict} />
                      <span className="text-xs text-surface-400">
                        {new Date(s.created_at).toLocaleString('ru')}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Правая колонка: редактор + результат */}
          <div className="space-y-4">
            <div className="rounded-xl border border-surface-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 bg-dark-800 text-white">
                <span className="text-sm font-medium">
                  Напишите программу{lang !== 'python' ? ` (${lang})` : ''}
                </span>
              </div>
              <CodeEditor value={code} onChange={setCode} language={lang} height="340px" />
            </div>

            {/* Результат проверки */}
            {submission && (
              <div className={`rounded-xl border p-4 ${
                isCorrect
                  ? 'border-green-200 bg-green-50'
                  : submission.status !== 'finished'
                  ? 'border-primary-200 bg-primary-50'
                  : 'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {submission.status !== 'finished' && (
                      <svg className="w-4 h-4 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {isCorrect && <span className="text-green-600 font-medium">Так точно! ✅</span>}
                    {!isCorrect && submission.status === 'finished' && (
                      <span className="text-red-600 font-medium">Неверно ❌</span>
                    )}
                    {submission.status !== 'finished' && (
                      <span className="text-primary-600 text-sm">
                        {submission.status === 'queued' ? 'В очереди...' : 'Выполняется...'}
                      </span>
                    )}
                  </div>
                  <VerdictBadge verdict={submission.verdict} />
                </div>
                {submission.runtime != null && (
                  <div className="text-xs text-surface-400 mb-2">Время: {submission.runtime.toFixed(3)}с</div>
                )}
                {submission.error_output && (
                  <pre className="bg-white border border-red-100 text-red-800 text-xs p-3 rounded overflow-auto max-h-36 mt-2">
                    {submission.error_output}
                  </pre>
                )}
                {submission.test_results && submission.test_results.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {submission.test_results.map((tr, i) => (
                      <div key={tr.id} className="flex items-center gap-3 text-sm bg-white rounded px-3 py-1.5">
                        <span className="text-surface-400 w-14 text-xs">Тест {i + 1}</span>
                        <VerdictBadge verdict={tr.verdict} />
                        {tr.runtime != null && (
                          <span className="text-xs text-surface-400 ml-auto">{tr.runtime.toFixed(3)}с</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Нижняя панель с кнопками навигации */}
      <div className="shrink-0 px-6 py-4 border-t border-surface-100 bg-white flex items-center gap-3">
        <button
          onClick={() => submitSolution(task.id, code)}
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? 'Проверка...' : '▶ Отправить решение'}
        </button>
        {isCorrect && taskNumber < totalTasks && (
          <button onClick={onNext} className="btn-success">
            Следующий шаг →
          </button>
        )}
        {!isCorrect && history.length > 0 && (
          <button onClick={() => setCode(code)} className="btn-secondary text-sm">
            Решить снова
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={taskNumber <= 1}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            ← Назад
          </button>
          <button
            onClick={onNext}
            disabled={taskNumber >= totalTasks}
            className="btn-secondary text-sm disabled:opacity-40"
          >
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [course, setCourse] = useState<Course | null>(null);
  const [tree, setTree] = useState<CourseNodeTree[]>([]);
  const [nodeTasks, setNodeTasks] = useState<Record<number, NodeTaskProgress[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasksLoaded, setTasksLoaded] = useState(false);

  const selectedTaskId = searchParams.get('task') ? Number(searchParams.get('task')) : null;

  // Загрузка курса и дерева
  useEffect(() => {
    if (!courseId) return;
    const id = Number(courseId);
    Promise.all([coursesApi.get(id), courseStudentApi.getTree(id)])
      .then(([cRes, tRes]) => {
        setCourse(cRes.data);
        setTree(tRes.data);
      })
      .catch((e) => setError(e.response?.data?.detail || 'Курс не найден'))
      .finally(() => setLoading(false));
  }, [courseId]);

  // После загрузки дерева — параллельно грузим задачи всех узлов
  useEffect(() => {
    if (tree.length === 0) return;
    const allNodeIds = collectNodeIds(tree);
    Promise.allSettled(
      allNodeIds.map((nid) =>
        courseStudentApi.getNodeTasks(nid).then((r) => ({ nid, tasks: r.data })),
      ),
    ).then((results) => {
      const map: Record<number, NodeTaskProgress[]> = {};
      results.forEach((r) => {
        if (r.status === 'fulfilled') map[r.value.nid] = r.value.tasks;
      });
      setNodeTasks(map);
      setTasksLoaded(true);
    });
  }, [tree]);

  // Плоский список для боковой панели
  const sidebarItems = useMemo(
    () => flattenTree(tree, nodeTasks),
    [tree, nodeTasks],
  );

  // Только задачи (для навигации вперёд/назад)
  const taskItems = useMemo(
    () => sidebarItems.filter((i): i is SidebarTask => i.kind === 'task'),
    [sidebarItems],
  );

  const currentTaskIndex = taskItems.findIndex((t) => t.taskId === selectedTaskId);

  const selectTask = useCallback(
    (taskId: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('task', String(taskId));
        return next;
      });
    },
    [setSearchParams],
  );

  const goNext = useCallback(() => {
    if (currentTaskIndex < taskItems.length - 1)
      selectTask(taskItems[currentTaskIndex + 1].taskId);
  }, [currentTaskIndex, taskItems, selectTask]);

  const goPrev = useCallback(() => {
    if (currentTaskIndex > 0) selectTask(taskItems[currentTaskIndex - 1].taskId);
  }, [currentTaskIndex, taskItems, selectTask]);

  // Авто-выбор первой задачи
  useEffect(() => {
    if (!selectedTaskId && taskItems.length > 0) {
      selectTask(taskItems[0].taskId);
    }
  }, [taskItems, selectedTaskId, selectTask]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen text-surface-400 gap-2">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Загрузка курса...
      </div>
    );

  if (error || !course)
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 mb-4">{error ?? 'Курс не найден'}</div>
        <Link to="/courses" className="btn-secondary">← К курсам</Link>
      </div>
    );

  const completedTasks = taskItems.filter((t) => t.status === 'completed').length;

  return (
    <div className="-mx-6 -my-6 lg:-mx-8 lg:-my-8 flex overflow-hidden" style={{ height: '100vh' }}>
      {/* ── Левый сайдбар (Stepik-стиль) ── */}
      <aside className="w-72 shrink-0 bg-white border-r border-surface-200 flex flex-col overflow-hidden">
        {/* Шапка курса */}
        <div className="px-4 py-4 border-b border-surface-200 bg-dark-900 text-white">
          <Link to="/courses" className="text-xs text-surface-400 hover:text-white transition-colors">
            ← Все курсы
          </Link>
          <h1 className="font-bold text-sm mt-1 leading-snug line-clamp-2">{course.title}</h1>
          {tasksLoaded && taskItems.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-surface-400 mb-1">
                <span>Прогресс по курсу</span>
                <span className="text-white font-medium">{completedTasks}/{taskItems.length}</span>
              </div>
              <div className="w-full bg-dark-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${taskItems.length ? (completedTasks / taskItems.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Список */}
        <div className="flex-1 overflow-y-auto">
          {sidebarItems.length === 0 && !tasksLoaded ? (
            <div className="text-xs text-surface-400 text-center py-8">Загрузка...</div>
          ) : sidebarItems.length === 0 ? (
            <div className="text-xs text-surface-400 text-center py-8">Модули курса ещё не добавлены</div>
          ) : (
            <div className="py-2">
              {sidebarItems.map((item) => {
                if (item.kind === 'section') {
                  // Заголовок раздела
                  return (
                    <div
                      key={`section-${item.nodeId}`}
                      className="px-4 pt-4 pb-1"
                      style={{ paddingLeft: `${16 + item.depth * 8}px` }}
                    >
                      <div className="text-xs font-bold text-dark-700 uppercase tracking-wide truncate">
                        <span className="text-surface-400 mr-1">{item.number}</span>
                        {item.label}
                      </div>
                    </div>
                  );
                }
                // Задача
                const isActive = item.taskId === selectedTaskId;
                return (
                  <button
                    key={`task-${item.nodeTaskId}`}
                    type="button"
                    onClick={() => selectTask(item.taskId)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-dark-800 text-white'
                        : 'text-surface-600 hover:bg-surface-50'
                    }`}
                    style={{ paddingLeft: `${16 + item.depth * 8}px` }}
                  >
                    <StatusDot status={item.status} />
                    <span className="truncate flex-1">
                      <span className={`mr-1.5 ${isActive ? 'text-surface-400' : 'text-surface-300'}`}>
                        {item.number}
                      </span>
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="shrink-0 text-surface-400">◀</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── Правая панель ── */}
      <main className="flex-1 overflow-hidden bg-surface-50">
        {selectedTaskId ? (
          <TaskSolver
            key={selectedTaskId}
            taskId={String(selectedTaskId)}
            taskNumber={currentTaskIndex + 1}
            totalTasks={taskItems.length}
            onNext={goNext}
            onPrev={goPrev}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-surface-400">
            <span className="text-5xl">📚</span>
            <p className="font-medium text-surface-500">
              {tasksLoaded && taskItems.length === 0
                ? 'В этом курсе пока нет задач'
                : 'Выберите задачу в списке слева'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
