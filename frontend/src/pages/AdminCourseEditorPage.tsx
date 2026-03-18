import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  adminCoursesApi,
  type AdminCourse,
  type CourseNodeDetails,
  type CourseNodeStatus,
  type CourseNodeTask,
  type CourseNodeTree,
  type CourseNodeType,
} from '../api';

const NODE_TYPE_LABELS: Record<CourseNodeType, string> = {
  module: 'Модуль',
  submodule: 'Подмодуль',
  topic: 'Тема',
  subtopic: 'Подтема',
};

const NODE_ICONS: Record<CourseNodeType, string> = {
  module: '📁',
  submodule: '📂',
  topic: '📄',
  subtopic: '📃',
};

const CHILD_TYPE: Record<CourseNodeType, CourseNodeType | null> = {
  module: 'submodule',
  submodule: 'topic',
  topic: 'subtopic',
  subtopic: null,
};

interface CreateNodeForm {
  parentId: number | null;
  parentType: CourseNodeType | null; // for label
  type: CourseNodeType;
  title: string;
}

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

  // Форма создания узла
  const [createForm, setCreateForm] = useState<CreateNodeForm | null>(null);
  const [createTitle, setCreateTitle] = useState('');
  const [creating, setCreating] = useState(false);

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

  // ── Сохранить узел ──────────────────────────────────────────────────────────
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
      await loadCourse();
      await loadNode(selectedNode.id);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка сохранения узла');
    } finally {
      setSaving(false);
    }
  };

  // ── Удалить узел ────────────────────────────────────────────────────────────
  const handleDeleteNode = async (nodeId: number, title: string) => {
    if (!confirm(`Удалить «${title}» и все вложенные элементы?`)) return;
    setSaving(true);
    try {
      await adminCoursesApi.deleteNode(nodeId);
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
      await loadCourse();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка удаления узла');
    } finally {
      setSaving(false);
    }
  };

  // ── Архивировать / разархивировать ──────────────────────────────────────────
  const handleArchiveNode = async () => {
    if (!selectedNode) return;
    setSaving(true);
    try {
      if (selectedNode.status === 'archived') {
        await adminCoursesApi.unarchiveNode(selectedNode.id);
      } else {
        await adminCoursesApi.archiveNode(selectedNode.id);
      }
      await loadCourse();
      await loadNode(selectedNode.id);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка архивирования');
    } finally {
      setSaving(false);
    }
  };

  // ── Открыть форму создания ──────────────────────────────────────────────────
  const openCreateForm = (parentId: number | null, parentType: CourseNodeType | null) => {
    const childType: CourseNodeType =
      parentType === null ? 'module' : (CHILD_TYPE[parentType] ?? 'subtopic');
    setCreateForm({ parentId, parentType, type: childType, title: '' });
    setCreateTitle('');
  };

  // ── Создать узел ────────────────────────────────────────────────────────────
  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm || !courseId || !createTitle.trim()) return;
    setCreating(true);
    try {
      const res = await adminCoursesApi.createNode(Number(courseId), {
        parent_id: createForm.parentId ?? undefined,
        type: createForm.type,
        title: createTitle.trim(),
      });
      setCreateForm(null);
      setCreateTitle('');
      await loadCourse();
      setSelectedNodeId(res.data.id);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка создания узла');
    } finally {
      setCreating(false);
    }
  };

  // ── Задачи ──────────────────────────────────────────────────────────────────
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

  // ── Дерево ──────────────────────────────────────────────────────────────────
  const renderTree = (nodes: CourseNodeTree[], depth = 0) => (
    <div className={depth > 0 ? 'ml-3 border-l border-surface-200 pl-3' : ''}>
      {nodes.map((node) => {
        const childType = CHILD_TYPE[node.type];
        return (
          <div key={node.id} className="mb-1">
            <div className="flex items-center gap-1 group">
              {/* Кнопка выбора узла */}
              <button
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
                className={`flex items-center gap-1 flex-1 text-left text-sm px-2 py-1 rounded truncate ${
                  selectedNodeId === node.id
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'hover:bg-surface-50'
                }`}
              >
                <span className="shrink-0">{NODE_ICONS[node.type]}</span>
                <span className="truncate">{node.title}</span>
                <span className="text-xs text-surface-400 ml-auto shrink-0 pl-1">
                  {node.task_count > 0
                    ? `${node.task_count} зад.`
                    : node.has_children
                    ? ''
                    : ''}
                </span>
              </button>

              {/* Кнопка «+ дочерний» */}
              {childType && (
                <button
                  type="button"
                  title={`Добавить ${NODE_TYPE_LABELS[childType].toLowerCase()}`}
                  onClick={() => openCreateForm(node.id, node.type)}
                  className="shrink-0 text-xs px-1.5 py-0.5 rounded text-primary-600 hover:bg-primary-50 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  +{NODE_TYPE_LABELS[childType].slice(0, 3)}
                </button>
              )}

              {/* Кнопка удаления */}
              <button
                type="button"
                title="Удалить"
                onClick={() => handleDeleteNode(node.id, node.title)}
                disabled={saving}
                className="shrink-0 text-xs px-1 py-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                🗑
              </button>
            </div>

            {/* Встроенная форма создания дочернего узла */}
            {createForm && createForm.parentId === node.id && (
              <div className="ml-3 mt-1 mb-2 border-l-2 border-primary-200 pl-3">
                <form onSubmit={handleCreateNode} className="flex gap-2 items-center flex-wrap">
                  <span className="text-xs text-primary-700 font-medium shrink-0">
                    {NODE_ICONS[createForm.type]} Новый {NODE_TYPE_LABELS[createForm.type].toLowerCase()}:
                  </span>
                  <input
                    autoFocus
                    className="input text-sm flex-1 min-w-[160px] py-0.5"
                    placeholder="Название"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary btn-sm" disabled={creating}>
                    Создать
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => setCreateForm(null)}
                  >
                    Отмена
                  </button>
                </form>
              </div>
            )}

            {node.children.length > 0 && renderTree(node.children, depth + 1)}
          </div>
        );
      })}
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
        <div className="card mb-4 bg-red-50 text-red-700 border border-red-200 flex items-start justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 underline text-sm">
            Закрыть
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Левая колонка: дерево ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Структура курса</h2>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => openCreateForm(null, null)}
            >
              + Модуль
            </button>
          </div>

          {/* Форма создания модуля верхнего уровня */}
          {createForm && createForm.parentId === null && (
            <div className="mb-3 border border-primary-200 rounded p-2 bg-primary-50">
              <form onSubmit={handleCreateNode} className="flex gap-2 items-center flex-wrap">
                <span className="text-xs text-primary-700 font-medium shrink-0">📁 Новый модуль:</span>
                <input
                  autoFocus
                  className="input text-sm flex-1 min-w-[160px] py-0.5"
                  placeholder="Название модуля"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  required
                />
                <button type="submit" className="btn-primary btn-sm" disabled={creating}>
                  Создать
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setCreateForm(null)}
                >
                  Отмена
                </button>
              </form>
            </div>
          )}

          {tree.length === 0 && !createForm ? (
            <div className="text-sm text-surface-400">
              Нет узлов. Нажмите «+ Модуль», чтобы начать.
            </div>
          ) : (
            renderTree(tree)
          )}
        </div>

        {/* ── Правая колонка: панель узла ── */}
        <div className="card">
          <h2 className="font-semibold text-lg mb-3">Свойства узла</h2>
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
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{NODE_ICONS[selectedNode.type]}</span>
                    <input
                      className="input w-full bg-surface-50"
                      value={NODE_TYPE_LABELS[selectedNode.type]}
                      disabled
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Описание</label>
                  <textarea
                    className="input w-full"
                    rows={3}
                    value={selectedNode.description || ''}
                    onChange={(e) =>
                      setSelectedNode({ ...selectedNode, description: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Статус</label>
                    <select
                      className="input w-full"
                      value={selectedNode.status}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          status: e.target.value as CourseNodeStatus,
                        })
                      }
                    >
                      <option value="draft">Черновик</option>
                      <option value="published">Опубликован</option>
                      <option value="archived">Архив</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Порядок</label>
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
                <div className="flex gap-2 flex-wrap">
                  <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                    💾 Сохранить
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={handleArchiveNode}
                    disabled={saving}
                  >
                    {selectedNode.status === 'archived' ? '📤 Разархивировать' : '📦 Архивировать'}
                  </button>
                  <button
                    type="button"
                    className="btn-sm bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded px-3 py-1"
                    onClick={() => handleDeleteNode(selectedNode.id, selectedNode.title)}
                    disabled={saving}
                  >
                    🗑 Удалить
                  </button>
                </div>
              </form>

              {/* Добавить дочерний узел из панели */}
              {CHILD_TYPE[selectedNode.type] && (
                <div className="pt-3 border-t border-surface-200">
                  <button
                    type="button"
                    className="btn-secondary btn-sm w-full"
                    onClick={() => openCreateForm(selectedNode.id, selectedNode.type)}
                  >
                    + Добавить {NODE_TYPE_LABELS[CHILD_TYPE[selectedNode.type]!].toLowerCase()}
                  </button>
                </div>
              )}

              {/* Блок задач */}
              <div className="pt-4 border-t border-surface-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Задачи узла</h3>
                  {!selectedNode.can_attach_tasks && (
                    <span className="text-xs text-surface-400">
                      {selectedNode.has_children
                        ? 'Задачи нельзя прикрепить к контейнеру'
                        : 'Недоступно'}
                    </span>
                  )}
                </div>
                {nodeTasks.length === 0 ? (
                  <div className="text-sm text-surface-400 mb-2">Нет задач.</div>
                ) : (
                  <ul className="space-y-1 mb-3">
                    {nodeTasks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between text-sm gap-2">
                        <span className="truncate">
                          <span className="text-surface-400 mr-1">#{t.sort_order}</span>
                          {t.task_title}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDetachTask(t.id)}
                          className="text-xs text-red-600 hover:underline shrink-0"
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
