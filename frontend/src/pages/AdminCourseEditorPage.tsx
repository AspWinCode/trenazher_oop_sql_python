import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  adminCoursesApi,
  type AdminCourse,
  type CourseNodeDetails,
  type CourseNodeTask,
  type CourseNodeTree,
} from '../api';

export default function AdminCourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<AdminCourse | null>(null);
  const [tree, setTree] = useState<CourseNodeTree[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<CourseNodeDetails | null>(null);
  const [nodeTasks, setNodeTasks] = useState<CourseNodeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCourse = async () => {
    if (!courseId) return;
    setError(null);
    try {
      const [courseRes, treeRes] = await Promise.all([
        adminCoursesApi.get(Number(courseId)),
        adminCoursesApi.getTree(Number(courseId)),
      ]);
      setCourse(courseRes.data);
      setTree(treeRes.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка загрузки курса');
    } finally {
      setLoading(false);
    }
  };

  const loadNode = async (nodeId: number) => {
    try {
      const [nodeRes, tasksRes] = await Promise.all([
        adminCoursesApi.getNode(nodeId),
        adminCoursesApi.getNodeTasks(nodeId),
      ]);
      setSelectedNode(nodeRes.data);
      setNodeTasks(tasksRes.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка загрузки узла');
    }
  };

  useEffect(() => {
    void loadCourse();
  }, [courseId]);

  useEffect(() => {
    if (selectedNodeId != null) {
      void loadNode(selectedNodeId);
    } else {
      setSelectedNode(null);
      setNodeTasks([]);
    }
  }, [selectedNodeId]);

  const handleUpdateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    setSaving(true);
    try {
      await adminCoursesApi.updateNode(selectedNode.id, {
        title: selectedNode.title,
        description: selectedNode.description || undefined,
        sort_order: selectedNode.sort_order,
        status: selectedNode.status,
      });
      // обновим дерево и сам узел
      await loadCourse();
      await loadNode(selectedNode.id);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка сохранения узла');
    } finally {
      setSaving(false);
    }
  };

  const handleAttachTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedNode) return;
    const formData = new FormData(e.currentTarget);
    const title = String(formData.get('title') || '').trim();
    if (!title) return;
    setSaving(true);
    try {
      await adminCoursesApi.attachTaskToNode(selectedNode.id, {
        create_new_task: true,
        task_title: title,
      });
      e.currentTarget.reset();
      await loadNode(selectedNode.id);
      await loadCourse();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка добавления задачи');
    } finally {
      setSaving(false);
    }
  };

  const handleDetachTask = async (nodeTaskId: number) => {
    if (!selectedNode) return;
    if (!confirm('Удалить задачу из узла?')) return;
    setSaving(true);
    try {
      await adminCoursesApi.detachTaskFromNode(selectedNode.id, nodeTaskId);
      await loadNode(selectedNode.id);
      await loadCourse();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка удаления задачи');
    } finally {
      setSaving(false);
    }
  };

  const renderTree = (nodes: CourseNodeTree[], depth = 0) => (
    <div className={depth > 0 ? 'ml-3 border-l border-surface-200 pl-3' : ''}>
      {nodes.map((node) => (
        <div key={node.id} className="mb-1">
          <button
            type="button"
            onClick={() => setSelectedNodeId(node.id)}
            className={`flex items-center justify-between w-full text-left text-sm px-2 py-1 rounded ${
              selectedNodeId === node.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-surface-50'
            }`}
          >
            <span>
              {node.type === 'module' && '📁 '}
              {node.type === 'submodule' && '📂 '}
              {node.type === 'topic' && '📄 '}
              {node.type === 'subtopic' && '📃 '}
              {node.title}
            </span>
            <span className="text-xs text-surface-500">
              {node.task_count > 0 ? `задач: ${node.task_count}` : node.has_children ? 'контейнер' : 'пустой'}
            </span>
          </button>
          {node.children.length > 0 && renderTree(node.children, depth + 1)}
        </div>
      ))}
    </div>
  );

  if (loading) {
    return <div className="p-6 text-surface-400">Загрузка редактора курса...</div>;
  }

  if (!course) {
    return (
      <div className="p-6">
        <button type="button" className="btn-secondary mb-4" onClick={() => navigate('/admin/courses')}>
          ← Назад к списку курсов
        </button>
        <div className="text-red-600">Курс не найден.</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <button type="button" className="btn-secondary mb-2" onClick={() => navigate('/admin/courses')}>
        ← Назад к списку курсов
      </button>
      <h1 className="text-2xl font-bold mb-4">Редактор курса: {course.title}</h1>

      {error && (
        <div className="card mb-4 bg-red-50 text-red-700 border border-red-200">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">
            Закрыть
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Левая колонка: дерево */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-lg">Структура курса</h2>
          </div>
          {tree.length === 0 ? (
            <div className="text-sm text-surface-400">Нет узлов. Добавьте модули на странице списка курсов.</div>
          ) : (
            renderTree(tree)
          )}
        </div>

        {/* Правая колонка: панель узла */}
        <div className="card">
          <h2 className="font-semibold text-lg mb-2">Узел</h2>
          {!selectedNode ? (
            <div className="text-sm text-surface-400">Выберите узел в дереве слева.</div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleUpdateNode} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Название</label>
                  <input
                    className="input w-full"
                    value={selectedNode.title}
                    onChange={(e) => setSelectedNode({ ...selectedNode, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Тип</label>
                  <input className="input w-full bg-surface-50" value={selectedNode.type} disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Описание</label>
                  <textarea
                    className="input w-full"
                    rows={3}
                    value={selectedNode.description || ''}
                    onChange={(e) => setSelectedNode({ ...selectedNode, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Статус</label>
                    <select
                      className="input w-full"
                      value={selectedNode.status}
                      onChange={(e) =>
                        setSelectedNode({ ...selectedNode, status: e.target.value as CourseNodeDetails['status'] })
                      }
                    >
                      <option value="draft">Черновик</option>
                      <option value="published">Опубликован</option>
                      <option value="archived">Архив</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Порядок сортировки</label>
                    <input
                      type="number"
                      className="input w-full"
                      value={selectedNode.sort_order}
                      onChange={(e) =>
                        setSelectedNode({ ...selectedNode, sort_order: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                  Сохранить узел
                </button>
              </form>

              {/* Блок задач */}
              <div className="pt-4 border-t border-surface-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Задачи узла</h3>
                  {!selectedNode.can_attach_tasks && (
                    <span className="text-xs text-surface-400">
                      Нельзя прикреплять задачи к этому узлу (контейнер или архив).
                    </span>
                  )}
                </div>
                {nodeTasks.length === 0 ? (
                  <div className="text-sm text-surface-400 mb-2">Нет задач.</div>
                ) : (
                  <ul className="space-y-1 mb-3">
                    {nodeTasks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between text-sm">
                        <span>
                          #{t.sort_order} {t.task_title}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDetachTask(t.id)}
                          className="text-xs text-red-600 hover:underline"
                          disabled={saving}
                        >
                          Удалить
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedNode.can_attach_tasks && (
                  <form onSubmit={handleAttachTask} className="flex gap-2 items-center flex-wrap">
                    <input
                      name="title"
                      className="input text-sm flex-1 min-w-[200px]"
                      placeholder="Название новой задачи"
                      required
                    />
                    <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                      + Создать задачу
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

