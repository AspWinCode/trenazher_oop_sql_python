import { useEffect, useState } from 'react';
import { progressApi, tasksApi } from '../api';
import type { Progress, Task } from '../types';
import VerdictBadge from '../components/VerdictBadge';
import { Link } from 'react-router-dom';

export default function ProgressPage() {
  const [progress, setProgress] = useState<Progress[]>([]);
  const [tasks, setTasks] = useState<Record<number, Task>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([progressApi.get(), tasksApi.list()]).then(([pRes, tRes]) => {
      setProgress(pRes.data);
      const m: Record<number, Task> = {};
      tRes.data.forEach((t) => { m[t.id] = t; });
      setTasks(m);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-surface-300">Загрузка...</div>;

  const solved = progress.filter((p) => p.best_verdict === 'AC').length;
  const attempted = progress.length;
  const totalAttempts = progress.reduce((sum, p) => sum + p.attempts, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Мой прогресс</h1>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center">
          <div className="text-3xl font-bold text-primary-600">{solved}</div>
          <div className="text-sm text-surface-300 mt-1">Решено</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-yellow-600">{attempted - solved}</div>
          <div className="text-sm text-surface-300 mt-1">В процессе</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-dark-700">{totalAttempts}</div>
          <div className="text-sm text-surface-300 mt-1">Всего попыток</div>
        </div>
      </div>
      {progress.length === 0 ? (
        <div className="card text-center py-12 text-surface-300">Вы ещё не решали задачи</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 text-left">
                <th className="px-4 py-3 font-medium">Задача</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">Попытки</th>
                <th className="px-4 py-3 font-medium">Лучший результат</th>
                <th className="px-4 py-3 font-medium">Решено</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((p) => {
                const task = tasks[p.task_id];
                return (
                  <tr key={p.id} className="border-t border-surface-100 hover:bg-surface-50">
                    <td className="px-4 py-3">
                      <Link to={`/task/${p.task_id}`} className="text-primary-600 hover:underline">
                        {task?.title || `Задача #${p.task_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><span className="badge-blue">{task?.task_type || '—'}</span></td>
                    <td className="px-4 py-3">{p.attempts}</td>
                    <td className="px-4 py-3"><VerdictBadge verdict={p.best_verdict} /></td>
                    <td className="px-4 py-3 text-xs text-surface-300">{p.solved_at ? new Date(p.solved_at).toLocaleString('ru') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
