import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { courseStudentApi, coursesApi } from '../api';
import type { CourseProgressStats } from '../api';
import type { Course } from '../types';
import { useAuthStore } from '../store/auth';
import PaymentModal from '../components/PaymentModal';
import GuestWelcomeStep from '../features/onboarding/GuestWelcomeStep';

export default function CoursesPage() {
  const isGuest = useAuthStore((s) => s.user?.is_guest ?? false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [progressMap, setProgressMap] = useState<Record<number, CourseProgressStats>>({});
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    coursesApi.list()
      .then(async ({ data }) => {
        setCourses(data);
        // Загружаем прогресс по каждому курсу параллельно
        const results = await Promise.allSettled(
          data.map((c) => courseStudentApi.getProgress(c.id).then((r) => ({ id: c.id, p: r.data })))
        );
        const map: Record<number, CourseProgressStats> = {};
        results.forEach((r) => {
          if (r.status === 'fulfilled') map[r.value.id] = r.value.p;
        });
        setProgressMap(map);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-surface-300">Загрузка...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Курсы</h1>
      {isGuest && (
        <div className="mb-6 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none shrink-0">🔒</span>
            <span>
              Вы в <span className="font-semibold">демо-режиме</span>. Доступна часть задач каждого курса. Для полного доступа и сохранения прогресса вы можете оплатить доступ.
            </span>
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={courses.length === 0}
            className="shrink-0 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            Оплатить
          </button>
        </div>
      )}
      {courses.length === 0 ? (
        <div className="card text-center py-12 text-surface-300">
          {isGuest ? 'Для гостевого режима пока не открыт ни один курс' : 'Курсы пока не добавлены'}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-tour="course-cards">
          {courses.map((c) => {
            const p = progressMap[c.id];
            const total = p?.total_tasks_count ?? 0;
            const done = p?.completed_tasks_count ?? 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <Link key={c.id} to={`/course/${c.id}`} className="card hover:shadow-md transition-shadow group flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold group-hover:text-primary-600 transition-colors">{c.title}</h2>
                  <span className={`badge-${c.status === 'published' ? 'green' : c.status === 'draft' ? 'yellow' : 'gray'} shrink-0`}>
                    {c.status}
                  </span>
                </div>
                {c.description && <p className="text-sm text-surface-300 line-clamp-2">{c.description}</p>}
                {total > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs text-surface-400 mb-1">
                      <span>Прогресс</span>
                      <span className="font-medium text-dark-700">{done}/{total} задач</span>
                    </div>
                    <div className="w-full bg-surface-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-accent-500' : 'bg-primary-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {pct === 100 && (
                      <div className="text-xs text-accent-600 font-medium mt-1">✓ Курс завершён</div>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {showPaymentModal && (
        <PaymentModal
          courses={courses}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {isGuest && <GuestWelcomeStep courses={courses} />}
    </div>
  );
}
