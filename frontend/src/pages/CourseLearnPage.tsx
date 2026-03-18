import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { courseStudentApi, coursesApi, type CourseNodeTree, type NodeTaskProgress } from '../api';
import type { Course } from '../types';
import CodeEditor from '../components/CodeEditor';
import Markdown from '../components/Markdown';
import VerdictBadge from '../components/VerdictBadge';
import { useTaskData } from '../features/task/hooks/useTaskData';
import { useSubmissionWatcher } from '../features/task/hooks/useSubmissionWatcher';

// ── Иконки и цвета для типов узлов ─────────────────────────────────────────
const NODE_ICONS: Record<string, string> = {
  module: '📁',
  submodule: '📂',
  topic: '📄',
  subtopic: '📃',
};

const STATUS_ICON: Record<string, string> = {
  completed: '✅',
  in_progress: '🔄',
  not_started: '⬜',
};

// ── Дерево узлов ─────────────────────────────────────────────────────────────
function NodeTree({
  nodes,
  depth,
  selectedNodeId,
  selectedTaskId,
  expandedNodes,
  nodeTasks,
  onNodeClick,
  onTaskClick,
}: {
  nodes: CourseNodeTree[];
  depth: number;
  selectedNodeId: number | null;
  selectedTaskId: number | null;
  expandedNodes: Set<number>;
  nodeTasks: Record<number, NodeTaskProgress[]>;
  onNodeClick: (node: CourseNodeTree) => void;
  onTaskClick: (taskId: number) => void;
}) {
  return (
    <div className={depth > 0 ? 'ml-3 border-l border-surface-200 pl-2' : ''}>
      {nodes.map((node) => {
        const isExpanded = expandedNodes.has(node.id);
        const isSelected = selectedNodeId === node.id;
        const tasks = nodeTasks[node.id] || [];
        const completedCount = tasks.filter((t) => t.status === 'completed').length;

        return (
          <div key={node.id}>
            {/* Строка узла */}
            <button
              type="button"
              onClick={() => onNodeClick(node)}
              className={`w-full flex items-center gap-1.5 text-left text-sm px-2 py-1.5 rounded mb-0.5 transition-colors ${
                isSelected
                  ? 'bg-primary-100 text-primary-800 font-medium'
                  : 'hover:bg-surface-100 text-surface-700'
              }`}
            >
              {/* Стрелка разворачивания */}
              {node.has_children ? (
                <span className="text-xs text-surface-400 w-3 shrink-0">
                  {isExpanded ? '▾' : '▸'}
                </span>
              ) : (
                <span className="w-3 shrink-0" />
              )}
              <span className="shrink-0">{NODE_ICONS[node.type] || '•'}</span>
              <span className="truncate flex-1">{node.title}</span>
              {/* Бейдж с задачами */}
              {node.task_count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${
                  completedCount === node.task_count && node.task_count > 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-surface-200 text-surface-500'
                }`}>
                  {tasks.length > 0 ? `${completedCount}/${node.task_count}` : node.task_count}
                </span>
              )}
            </button>

            {/* Список задач под узлом */}
            {isSelected && tasks.length > 0 && (
              <div className="ml-6 mb-1 space-y-0.5">
                {tasks.map((t) => (
                  <button
                    key={t.node_task_id}
                    type="button"
                    onClick={() => onTaskClick(t.task_id)}
                    className={`w-full flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded transition-colors ${
                      selectedTaskId === t.task_id
                        ? 'bg-primary-50 text-primary-700 font-medium border border-primary-200'
                        : 'hover:bg-surface-100 text-surface-600'
                    }`}
                  >
                    <span className="shrink-0 text-base leading-none">{STATUS_ICON[t.status]}</span>
                    <span className="truncate flex-1">{t.task_title}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Дочерние узлы */}
            {isExpanded && node.children.length > 0 && (
              <NodeTree
                nodes={node.children}
                depth={depth + 1}
                selectedNodeId={selectedNodeId}
                selectedTaskId={selectedTaskId}
                expandedNodes={expandedNodes}
                nodeTasks={nodeTasks}
                onNodeClick={onNodeClick}
                onTaskClick={onTaskClick}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Решатель задачи (inline) ─────────────────────────────────────────────────
function TaskSolver({ taskId }: { taskId: string }) {
  const {
    task, code, setCode, history, hints, loading,
    showHints, setShowHints, refreshHistory, refreshHints,
  } = useTaskData(taskId);

  const { submission, submitting, submitSolution } = useSubmissionWatcher({
    refreshHistory,
    refreshHints,
  });

  if (loading) return <div className="p-6 text-surface-400">Загрузка задачи...</div>;
  if (!task) return <div className="p-6 text-red-500">Задача не найдена</div>;

  const langMap: Record<string, string> = {
    sql_query: 'sql', cpp_io: 'cpp', js_io: 'javascript',
  };
  const lang = langMap[task.task_type] || 'python';
  const publicTests = task.tests?.filter((t) => t.test_type === 'public') || [];

  return (
    <div className="h-full overflow-y-auto">
      {/* Заголовок задачи */}
      <div className="px-6 py-4 border-b border-surface-100">
        <h2 className="text-xl font-bold">{task.title}</h2>
        <div className="flex gap-2 mt-1">
          <span className="badge-blue">{task.task_type}</span>
          <span className="badge-gray">v{task.version}</span>
        </div>
      </div>

      <div className="px-6 py-4 grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Левая колонка: описание + тесты + подсказки */}
        <div className="space-y-4">
          {task.description && (
            <div className="card">
              <h3 className="text-sm font-semibold text-dark-700 mb-2">Условие</h3>
              <Markdown content={task.description} />
            </div>
          )}
          {publicTests.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-dark-700 mb-2">Примеры</h3>
              <div className="space-y-2">
                {publicTests.map((t, i) => (
                  <div key={t.id} className="bg-surface-50 rounded p-3 text-sm">
                    <div className="font-medium mb-1">Тест {i + 1}</div>
                    {t.input_data && (
                      <div><span className="text-surface-400">Вход:</span> <code className="bg-surface-200 px-1 rounded">{t.input_data}</code></div>
                    )}
                    {t.expected_output && (
                      <div className="mt-1"><span className="text-surface-400">Выход:</span> <code className="bg-surface-200 px-1 rounded">{t.expected_output}</code></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {hints.length > 0 && (
            <div className="card">
              <button
                onClick={() => setShowHints(!showHints)}
                className="text-sm font-semibold text-primary-600 hover:underline"
              >
                {showHints ? 'Скрыть подсказки' : `Подсказки (${hints.length})`}
              </button>
              {showHints && (
                <div className="space-y-2 mt-3">
                  {hints.map((h) => (
                    <div key={h.id} className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                      <div className="font-medium text-yellow-800">Подсказка {h.hint_level}</div>
                      <div className="text-yellow-700 mt-1">{h.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* История отправок */}
          {history.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-dark-700 mb-2">История отправок</h3>
              <div className="space-y-1">
                {history.slice(0, 8).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-surface-100 last:border-0">
                    <span className="text-surface-400">#{s.id}</span>
                    <VerdictBadge verdict={s.verdict} />
                    <span className="text-xs text-surface-400">
                      {new Date(s.created_at).toLocaleString('ru')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Правая колонка: редактор + результат */}
        <div className="space-y-4">
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-dark-800 text-white">
              <span className="text-sm font-medium">Решение ({lang})</span>
              <button
                onClick={() => submitSolution(task.id, code)}
                disabled={submitting}
                className="btn-primary btn-sm"
              >
                {submitting ? 'Проверка...' : 'Отправить ▶'}
              </button>
            </div>
            <CodeEditor value={code} onChange={setCode} language={lang} height="380px" />
          </div>

          {submission && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-dark-700">Результат</h3>
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
                <div className="text-xs text-surface-400 mb-2">Время: {submission.runtime.toFixed(3)}s</div>
              )}
              {submission.error_output && (
                <pre className="bg-red-50 text-red-800 text-xs p-3 rounded overflow-auto max-h-40">
                  {submission.error_output}
                </pre>
              )}
              {submission.test_results && submission.test_results.length > 0 && (
                <div className="space-y-1">
                  {submission.test_results.map((tr, i) => (
                    <div key={tr.id} className="flex items-center gap-3 text-sm bg-surface-50 p-2 rounded">
                      <span className="text-surface-400 w-16">Тест {i + 1}</span>
                      <VerdictBadge verdict={tr.verdict} />
                      {tr.runtime != null && (
                        <span className="text-xs text-surface-400">{tr.runtime.toFixed(3)}s</span>
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
  );
}

// ── Главная страница обучения ─────────────────────────────────────────────────
export default function CourseLearnPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [tree, setTree] = useState<CourseNodeTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [nodeTasks, setNodeTasks] = useState<Record<number, NodeTaskProgress[]>>({});
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Выбранная задача из URL (?task=:id)
  const selectedTaskId = searchParams.get('task') ? Number(searchParams.get('task')) : null;

  // Загрузка курса и дерева
  useEffect(() => {
    if (!courseId) return;
    const id = Number(courseId);
    Promise.all([
      coursesApi.get(id),
      courseStudentApi.getTree(id),
    ])
      .then(([courseRes, treeRes]) => {
        setCourse(courseRes.data);
        setTree(treeRes.data);
      })
      .catch((e) => setError(e.response?.data?.detail || 'Курс не найден'))
      .finally(() => setLoading(false));
  }, [courseId]);

  // Загрузка задач для узла
  const loadNodeTasks = async (nodeId: number) => {
    if (nodeTasks[nodeId]) return; // уже загружены
    setLoadingTasks(true);
    try {
      const { data } = await courseStudentApi.getNodeTasks(nodeId);
      setNodeTasks((prev) => ({ ...prev, [nodeId]: data }));
    } catch {
      // узел без задач или с детьми — игнорируем
    } finally {
      setLoadingTasks(false);
    }
  };

  // Клик по узлу
  const handleNodeClick = (node: CourseNodeTree) => {
    setSelectedNodeId(node.id);
    // Очищаем выбранную задачу при смене узла
    if (selectedNodeId !== node.id) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('task');
        return next;
      });
    }
    // Разворачиваем/сворачиваем
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
    // Загружаем задачи
    void loadNodeTasks(node.id);
  };

  // Клик по задаче
  const handleTaskClick = (taskId: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('task', String(taskId));
      return next;
    });
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-surface-400">Загрузка курса...</div>;
  if (error || !course) return (
    <div className="p-8 text-center">
      <div className="text-red-600 mb-4">{error || 'Курс не найден'}</div>
      <Link to="/" className="btn-secondary">← На главную</Link>
    </div>
  );

  return (
    <div className="-mx-6 -my-6 lg:-mx-8 lg:-my-8 flex overflow-hidden" style={{ height: '100vh' }}>
      {/* ── Левый сайдбар ── */}
      <aside className="w-72 shrink-0 bg-white border-r border-surface-200 flex flex-col overflow-hidden">
        {/* Шапка */}
        <div className="px-4 py-3 border-b border-surface-200">
          <Link to="/" className="text-xs text-primary-600 hover:underline">← Все курсы</Link>
          <h1 className="font-bold text-base mt-1 leading-tight">{course.title}</h1>
          {course.description && (
            <p className="text-xs text-surface-400 mt-1 line-clamp-2">{course.description}</p>
          )}
        </div>

        {/* Дерево */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {tree.length === 0 ? (
            <div className="text-sm text-surface-400 text-center py-8">
              Модули курса ещё не добавлены
            </div>
          ) : (
            <NodeTree
              nodes={tree}
              depth={0}
              selectedNodeId={selectedNodeId}
              selectedTaskId={selectedTaskId}
              expandedNodes={expandedNodes}
              nodeTasks={nodeTasks}
              onNodeClick={handleNodeClick}
              onTaskClick={handleTaskClick}
            />
          )}
          {loadingTasks && (
            <div className="text-xs text-surface-400 text-center py-2">Загрузка задач...</div>
          )}
        </div>
      </aside>

      {/* ── Правая панель ── */}
      <main className="flex-1 overflow-hidden bg-surface-50">
        {selectedTaskId ? (
          <TaskSolver taskId={String(selectedTaskId)} />
        ) : selectedNodeId && !nodeTasks[selectedNodeId] ? (
          <div className="flex items-center justify-center h-full text-surface-400">
            Загрузка...
          </div>
        ) : selectedNodeId && nodeTasks[selectedNodeId]?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-surface-400">
            <span className="text-4xl">📂</span>
            <p className="text-sm">В этом разделе задач нет. Выберите другой.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-surface-400">
            <span className="text-5xl">📚</span>
            <p className="font-medium text-surface-500">Выберите раздел в дереве слева</p>
            <p className="text-sm">Нажмите на узел чтобы увидеть задачи, затем выберите задачу для решения</p>
          </div>
        )}
      </main>
    </div>
  );
}
