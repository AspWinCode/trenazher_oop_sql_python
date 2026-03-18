import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { tasksApi } from '../api';
import type { Task, TaskTest, TaskHint } from '../types';

const RUNNER_MAP: Record<string, string> = {
  python_io: 'stdin_runner',
  python_oop: 'pytest_runner',
  python_numpy: 'pytest_runner',
  sql_query: 'sql_runner',
  cpp_io: 'cpp_runner',
  js_io: 'js_runner',
};

const TASK_TYPE_LABELS: Record<string, string> = {
  python_io: 'Python IO',
  python_oop: 'Python OOP',
  python_numpy: 'Python NumPy',
  sql_query: 'SQL Query',
  cpp_io: 'C++ IO',
  js_io: 'JavaScript IO',
};

export default function AdminTaskEditPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // откуда пришли — для кнопки «Назад»
  const backTo = searchParams.get('back') || '/admin/tasks';

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // форма основных данных
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('python_io');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [sqlSchema, setSqlSchema] = useState('');
  const [sqlSeed, setSqlSeed] = useState('');

  // тесты и подсказки
  const [tests, setTests] = useState<TaskTest[]>([]);
  const [hints, setHints] = useState<TaskHint[]>([]);

  // новый тест (форма)
  const [newTest, setNewTest] = useState({ test_type: 'public', input_data: '', expected_output: '' });
  const [addingTest, setAddingTest] = useState(false);

  // новая подсказка (форма)
  const [newHint, setNewHint] = useState({ hint_level: 1, unlock_attempts: 3, content: '' });
  const [addingHint, setAddingHint] = useState(false);

  const loadTask = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const { data } = await tasksApi.get(Number(taskId));
      setTask(data);
      setTitle(data.title);
      setDescription(data.description || '');
      setTaskType(data.task_type);
      setStatus(data.status);
      setSqlSchema(data.sql_schema || '');
      setSqlSeed(data.sql_seed || '');
      setTests(data.tests || []);
      setHints(data.hints || []);
      setNewHint((h) => ({ ...h, hint_level: (data.hints?.length || 0) + 1, unlock_attempts: ((data.hints?.length || 0) + 1) * 2 }));
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка загрузки задачи');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTask(); }, [taskId]);

  // ── Сохранить основные данные ────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await tasksApi.update(task.id, {
        title,
        description: description || null,
        task_type: taskType as Task['task_type'],
        runner_type: RUNNER_MAP[taskType] as Task['runner_type'],
        status,
        sql_schema: sqlSchema || null,
        sql_seed: sqlSeed || null,
      });
      setSuccess('Задача сохранена');
      await loadTask();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  // ── Тесты ────────────────────────────────────────────────────────────────────
  const handleAddTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    setSaving(true);
    setError(null);
    try {
      await tasksApi.addTest(task.id, newTest);
      setNewTest({ test_type: 'public', input_data: '', expected_output: '' });
      setAddingTest(false);
      await loadTask();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка добавления теста');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTest = async (testId: number) => {
    if (!confirm('Удалить тест?')) return;
    setSaving(true);
    try {
      await tasksApi.deleteTest(testId);
      await loadTask();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка удаления теста');
    } finally {
      setSaving(false);
    }
  };

  // ── Подсказки ────────────────────────────────────────────────────────────────
  const handleAddHint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newHint.content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await tasksApi.addHint(task.id, newHint);
      setAddingHint(false);
      await loadTask();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка добавления подсказки');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHint = async (hintId: number) => {
    if (!confirm('Удалить подсказку?')) return;
    setSaving(true);
    try {
      await tasksApi.deleteHint(hintId);
      await loadTask();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка удаления подсказки');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-surface-400">Загрузка задачи...</div>;
  if (!task) return (
    <div className="p-6">
      <button className="btn-secondary mb-4" onClick={() => navigate(backTo)}>← Назад</button>
      <div className="text-red-600">Задача не найдена.</div>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <button type="button" className="btn-secondary" onClick={() => navigate(backTo)}>
        ← Назад
      </button>
      <h1 className="text-2xl font-bold">Редактор задачи #{task.id}</h1>

      {error && (
        <div className="card bg-red-50 text-red-700 border border-red-200 flex justify-between items-start gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 underline text-sm">Закрыть</button>
        </div>
      )}
      {success && (
        <div className="card bg-green-50 text-green-700 border border-green-200 flex justify-between items-start gap-2">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="shrink-0 underline text-sm">Закрыть</button>
        </div>
      )}

      {/* ── Основные данные ── */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-lg">Основное</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Название</label>
              <input
                className="input w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Тип задачи</label>
              <select
                className="input w-full"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
              >
                {Object.entries(TASK_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Статус</label>
              <select
                className="input w-full"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="draft">Черновик</option>
                <option value="published">Опубликована</option>
                <option value="archived">Архив</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Runner</label>
              <input className="input w-full bg-surface-50" value={RUNNER_MAP[taskType] || ''} readOnly />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Описание / условие задачи</label>
            <textarea
              className="input w-full font-mono text-sm"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опишите задачу, входные/выходные данные, примеры..."
            />
          </div>

          {taskType === 'sql_query' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">SQL Schema</label>
                <textarea
                  className="input w-full font-mono text-sm"
                  rows={5}
                  value={sqlSchema}
                  onChange={(e) => setSqlSchema(e.target.value)}
                  placeholder="CREATE TABLE ..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">SQL Seed (начальные данные)</label>
                <textarea
                  className="input w-full font-mono text-sm"
                  rows={5}
                  value={sqlSeed}
                  onChange={(e) => setSqlSeed(e.target.value)}
                  placeholder="INSERT INTO ..."
                />
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={saving}>
            💾 Сохранить
          </button>
        </form>
      </div>

      {/* ── Тесты ── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Тесты ({tests.length})</h2>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => setAddingTest((v) => !v)}
          >
            {addingTest ? 'Отмена' : '+ Добавить тест'}
          </button>
        </div>

        {addingTest && (
          <form onSubmit={handleAddTest} className="border border-primary-200 rounded p-3 bg-primary-50 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Тип</label>
                <select
                  className="input w-full text-sm"
                  value={newTest.test_type}
                  onChange={(e) => setNewTest({ ...newTest, test_type: e.target.value })}
                >
                  <option value="public">Public (виден студенту)</option>
                  <option value="hidden">Hidden (скрытый)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  {taskType === 'python_oop' || taskType === 'python_numpy' ? 'Код теста (pytest)' : 'Input'}
                </label>
                <textarea
                  className="input w-full font-mono text-sm"
                  rows={3}
                  value={newTest.input_data}
                  onChange={(e) => setNewTest({ ...newTest, input_data: e.target.value })}
                  placeholder={taskType === 'python_oop' || taskType === 'python_numpy' ? 'def test_foo():\n    assert ...' : '5 3'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Expected output</label>
                <textarea
                  className="input w-full font-mono text-sm"
                  rows={3}
                  value={newTest.expected_output}
                  onChange={(e) => setNewTest({ ...newTest, expected_output: e.target.value })}
                  placeholder="8"
                />
              </div>
            </div>
            <button type="submit" className="btn-primary btn-sm" disabled={saving}>
              Добавить
            </button>
          </form>
        )}

        {tests.length === 0 ? (
          <div className="text-sm text-surface-400">Тестов нет. Добавьте хотя бы один.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 text-left">
                  <th className="px-3 py-2 font-medium w-8">#</th>
                  <th className="px-3 py-2 font-medium w-24">Тип</th>
                  <th className="px-3 py-2 font-medium">Input</th>
                  <th className="px-3 py-2 font-medium">Expected output</th>
                  <th className="px-3 py-2 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t, i) => (
                  <tr key={t.id} className="border-t border-surface-100">
                    <td className="px-3 py-2 text-surface-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <span className={t.test_type === 'public' ? 'badge-green' : 'badge-yellow'}>
                        {t.test_type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <pre className="text-xs font-mono bg-surface-50 rounded p-1 max-w-xs overflow-auto whitespace-pre-wrap">
                        {t.input_data || '—'}
                      </pre>
                    </td>
                    <td className="px-3 py-2">
                      <pre className="text-xs font-mono bg-surface-50 rounded p-1 max-w-xs overflow-auto whitespace-pre-wrap">
                        {t.expected_output || '—'}
                      </pre>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteTest(t.id)}
                        className="text-xs text-red-600 hover:underline"
                        disabled={saving}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Подсказки ── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Подсказки ({hints.length})</h2>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => setAddingHint((v) => !v)}
          >
            {addingHint ? 'Отмена' : '+ Добавить подсказку'}
          </button>
        </div>

        {addingHint && (
          <form onSubmit={handleAddHint} className="border border-primary-200 rounded p-3 bg-primary-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Уровень подсказки</label>
                <input
                  type="number"
                  min={1}
                  className="input w-full text-sm"
                  value={newHint.hint_level}
                  onChange={(e) => setNewHint({ ...newHint, hint_level: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Разблокировать после N попыток</label>
                <input
                  type="number"
                  min={0}
                  className="input w-full text-sm"
                  value={newHint.unlock_attempts}
                  onChange={(e) => setNewHint({ ...newHint, unlock_attempts: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Текст подсказки</label>
              <textarea
                className="input w-full text-sm"
                rows={3}
                value={newHint.content}
                onChange={(e) => setNewHint({ ...newHint, content: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn-primary btn-sm" disabled={saving}>
              Добавить
            </button>
          </form>
        )}

        {hints.length === 0 ? (
          <div className="text-sm text-surface-400">Подсказок нет.</div>
        ) : (
          <div className="space-y-2">
            {hints.map((h) => (
              <div key={h.id} className="border border-surface-200 rounded p-3 flex gap-3">
                <div className="shrink-0 text-center">
                  <div className="text-xs text-surface-400">Ур.</div>
                  <div className="font-bold text-lg">{h.hint_level}</div>
                  <div className="text-xs text-surface-400">после {h.unlock_attempts} поп.</div>
                </div>
                <div className="flex-1 text-sm">{h.content}</div>
                <button
                  type="button"
                  onClick={() => handleDeleteHint(h.id)}
                  className="shrink-0 text-xs text-red-600 hover:underline self-start"
                  disabled={saving}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
