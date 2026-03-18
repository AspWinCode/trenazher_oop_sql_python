import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { coursesApi } from '../api';
import type { Course } from '../types';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    coursesApi.list().then(({ data }) => setCourses(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-surface-300">Загрузка...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Курсы</h1>
      {courses.length === 0 ? (
        <div className="card text-center py-12 text-surface-300">Курсы пока не добавлены</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Link key={c.id} to={`/course/${c.id}`} className="card hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold group-hover:text-primary-600 transition-colors">{c.title}</h2>
                <span className={`badge-${c.status === 'published' ? 'green' : c.status === 'draft' ? 'yellow' : 'gray'}`}>
                  {c.status}
                </span>
              </div>
              {c.description && <p className="text-sm text-surface-300 mt-2 line-clamp-2">{c.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
