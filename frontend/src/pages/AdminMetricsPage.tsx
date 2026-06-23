import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { adminMetricsApi } from '../api';
import type { PlatformMetrics } from '../types';

const REFRESH_MS = 60_000;

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-5">
      <div className="text-sm text-surface-400">{label}</div>
      <div className="text-3xl font-bold text-dark-900 mt-1">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-dark-700 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function truncate(s: string, n = 22) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export default function AdminMetricsPage() {
  const [data, setData] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => {
      adminMetricsApi.get()
        .then(({ data }) => { if (alive) { setData(data); setError(false); } })
        .catch(() => { if (alive) setError(true); })
        .finally(() => { if (alive) setLoading(false); });
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (loading) return <div className="text-center py-20 text-surface-300">Загрузка...</div>;
  if (error || !data) return <div className="text-center py-20 text-red-500">Не удалось загрузить метрики</div>;

  const newUsers30 = data.registrations.length
    ? data.registrations[data.registrations.length - 1].count
    : 0;
  const attempted = data.tasks.most_attempted.map((t) => ({ name: truncate(t.title), value: t.submissions }));
  const failed = data.tasks.most_failed.map((t) => ({ name: truncate(t.title), value: t.wrong_attempts }));
  const sections = data.sections.map((s) => ({ name: s.label, submissions: s.submissions, solvers: s.solvers }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Метрики платформы</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Всего пользователей" value={data.total_users} />
        <StatCard label="Активны за 30 дней" value={data.active_users_30d} />
        <StatCard label="Сессий на пользователя (месяц)" value={data.engagement.avg_sessions_per_user} />
        <StatCard label="Регистраций в этом месяце" value={newUsers30} />
      </div>

      <div className="mb-6">
        <ChartCard title="Регистрации (накопительно, по месяцам)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.registrations} margin={{ top: 5, right: 16, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="cumulative" name="Всего пользователей" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <ChartCard title="Топ задач по числу отправок">
          {attempted.length === 0 ? (
            <div className="text-sm text-surface-300 py-8 text-center">Пока нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, attempted.length * 34)}>
              <BarChart data={attempted} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" name="Отправок" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Топ задач по неверным попыткам">
          {failed.length === 0 ? (
            <div className="text-sm text-surface-300 py-8 text-center">Пока нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, failed.length * 34)}>
              <BarChart data={failed} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" name="Неверных попыток" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Активность по разделам">
        {sections.length === 0 ? (
          <div className="text-sm text-surface-300 py-8 text-center">Пока нет данных</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sections} margin={{ top: 5, right: 16, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="submissions" name="Отправок" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="solvers" name="Уникальных решавших" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
