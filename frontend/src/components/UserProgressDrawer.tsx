import { useEffect, useState } from 'react';
import { usersApi } from '../api';
import type { UserCourseProgressDetail } from '../types';

interface Props {
  userId: number;
  userLabel: string;
  onClose: () => void;
}

function fmt(dt: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleString('ru', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function UserProgressDrawer({ userId, userLabel, onClose }: Props) {
  const [data, setData] = useState<UserCourseProgressDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    usersApi.getCourseProgress(userId)
      .then(({ data }) => { if (alive) setData(data); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  const toggle = (courseId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(courseId) ? next.delete(courseId) : next.add(courseId);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl h-full shadow-xl flex flex-col">
        {/* Шапка */}
        <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold">Карточка пользователя</h2>
            <div className="text-sm text-surface-400">{userLabel}</div>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-dark-900 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-surface-300">Загрузка...</div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-red-500">Не удалось загрузить</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Липкий итог */}
            <div className="sticky top-0 bg-white border-b border-surface-100 px-5 py-3 z-10">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-surface-50 rounded-xl border border-surface-100">
                  <div className="text-xl font-bold text-dark-800">{data.total_tasks}</div>
                  <div className="text-xs text-surface-400 mt-0.5">Всего задач</div>
                </div>
                <div className="p-2 bg-green-50 rounded-xl border border-green-100">
                  <div className="text-xl font-bold text-green-700">{data.total_passed}</div>
                  <div className="text-xs text-green-600 mt-0.5">Пройдено</div>
                </div>
                <div className="p-2 bg-surface-50 rounded-xl border border-surface-100">
                  <div className="text-sm font-semibold text-dark-700 mt-1">{fmt(data.last_online)}</div>
                  <div className="text-xs text-surface-400 mt-0.5">Последний онлайн</div>
                </div>
              </div>
            </div>

            {/* Аккордеон курсов */}
            <div className="p-5 space-y-3">
              {data.courses.length === 0 && (
                <div className="text-center text-surface-300 py-8">Нет доступных курсов</div>
              )}
              {data.courses.map((course) => {
                const open = expanded.has(course.course_id);
                return (
                  <div key={course.course_id} className="border border-surface-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggle(course.course_id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-50 text-left"
                    >
                      <span className="font-medium text-dark-800 flex items-center gap-2">
                        <span className={`text-surface-400 transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
                        {course.course_title}
                      </span>
                      <span className="text-sm text-surface-400">
                        {course.passed}/{course.total} пройдено
                      </span>
                    </button>

                    {open && (
                      <div className="overflow-x-auto border-t border-surface-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-surface-50 text-left text-surface-400">
                              <th className="px-4 py-2 font-medium sticky top-0 bg-surface-50">Задача</th>
                              <th className="px-4 py-2 font-medium text-center">Пройдено</th>
                              <th className="px-4 py-2 font-medium">Когда пройдена</th>
                            </tr>
                          </thead>
                          <tbody>
                            {course.tasks.length === 0 ? (
                              <tr><td colSpan={3} className="px-4 py-4 text-center text-surface-300">В курсе нет задач</td></tr>
                            ) : course.tasks.map((t, i) => (
                              <tr key={i} className="border-t border-surface-100">
                                <td className="px-4 py-2">{t.task_title}</td>
                                <td className="px-4 py-2 text-center">
                                  {t.completed
                                    ? <span className="text-green-600">✅</span>
                                    : <span className="text-surface-300">—</span>}
                                </td>
                                <td className="px-4 py-2 text-surface-500">{t.completed ? fmt(t.completed_at) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
