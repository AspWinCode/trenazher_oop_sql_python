import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tasksApi } from '../api';
import type { Task } from '../types';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tasksApi.list().then(({ data }) => setTasks(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-surface-300">Загрузка...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Задачи</h1>
      {tasks.length === 0 ? (
        <div className="card text-center py-12 text-surface-300">Задач пока нет</div>
      ) : (
        <div className="grid gap-3">
          {tasks.map((task) => (
            <Link
              key={task.id}
              to={`/task/${task.id}`}
              className="card flex items-center justify-between hover:shadow-md transition-shadow group"
            >
              <div>
                <div className="font-medium text-dark-900 group-hover:text-primary-600">{task.title}</div>
                <div className="text-sm text-surface-300 mt-0.5">{task.task_type}</div>
              </div>
              <span className="text-surface-400 group-hover:text-primary-600">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
