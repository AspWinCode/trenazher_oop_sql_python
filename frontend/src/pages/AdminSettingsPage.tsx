import { useEffect, useRef, useState } from 'react';
import { adminCoursesApi, guestApi, platformSettingsApi, type AdminCourse } from '../api';
import type { GuestConfig } from '../types';

function GuestModeSettings() {
  const [config, setConfig] = useState<GuestConfig>({ enabled: false, task_limit: 3, course_ids: [] });
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    Promise.all([guestApi.getConfig(), adminCoursesApi.list()])
      .then(([cfg, list]) => {
        setConfig(cfg.data);
        setCourses(list.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleCourse = (id: number) => {
    setConfig((c) => ({
      ...c,
      course_ids: c.course_ids.includes(id)
        ? c.course_ids.filter((x) => x !== id)
        : [...c.course_ids, id],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { data } = await guestApi.updateConfig({
        enabled: config.enabled,
        task_limit: Math.max(0, Math.round(config.task_limit) || 0),
        course_ids: config.course_ids,
      });
      setConfig(data);
      setMsg({ type: 'ok', text: 'Настройки гостевого режима сохранены' });
    } catch (err: any) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Ошибка сохранения' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="card max-w-lg mt-6">
      <h2 className="text-lg font-semibold mb-4">Гостевой (демо) режим</h2>

      <label className="flex items-center gap-3 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
          className="w-4 h-4"
        />
        <span className="text-sm text-dark-700">Разрешить вход гостям без регистрации</span>
      </label>

      <div className="mb-4">
        <label className="block text-sm font-medium text-dark-700 mb-1.5">
          Лимит задач на курс
        </label>
        <input
          type="number"
          min={0}
          value={config.task_limit}
          onChange={(e) => setConfig((c) => ({ ...c, task_limit: Number(e.target.value) }))}
          className="input w-32"
        />
        <p className="text-xs text-surface-400 mt-1">
          Гостю доступны первые N задач каждого открытого курса (по порядку).
        </p>
      </div>

      <div className="mb-4">
        <div className="text-sm font-medium text-dark-700 mb-2">Курсы, открытые для гостей</div>
        {courses.length === 0 ? (
          <p className="text-sm text-surface-400">Нет курсов</p>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {courses.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.course_ids.includes(c.id)}
                  onChange={() => toggleCourse(c.id)}
                  className="w-4 h-4"
                />
                <span className="text-dark-700">{c.title}</span>
                <span className={`badge-${c.status === 'published' ? 'green' : c.status === 'draft' ? 'yellow' : 'gray'}`}>
                  {c.status}
                </span>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-surface-400 mt-2">
          Гостю показываются только опубликованные курсы из выбранных.
        </p>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Сохранение...' : 'Сохранить'}
      </button>

      {msg && (
        <div className={`mt-3 text-sm p-2 rounded ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    platformSettingsApi.getLogo()
      .then(({ data }) => setLogoUrl(data.url))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'err', text: 'Файл слишком большой (макс. 2 МБ)' });
      return;
    }

    setUploading(true);
    setMsg(null);
    try {
      const { data } = await platformSettingsApi.uploadLogo(file);
      setLogoUrl(data.url);
      setMsg({ type: 'ok', text: 'Логотип загружен' });
    } catch (err: any) {
      setMsg({ type: 'err', text: err.response?.data?.detail || 'Ошибка загрузки' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Удалить логотип?')) return;
    try {
      await platformSettingsApi.deleteLogo();
      setLogoUrl(null);
      setMsg({ type: 'ok', text: 'Логотип удалён' });
    } catch {
      setMsg({ type: 'err', text: 'Ошибка удаления' });
    }
  };

  if (loading) return <div className="text-center py-20 text-surface-300">Загрузка...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Настройки платформы</h1>

      <div className="card max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Логотип</h2>

        {/* Preview */}
        <div className="mb-4 p-4 bg-dark-900 rounded-lg flex items-center justify-center min-h-[80px]">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="max-h-16 object-contain" />
          ) : (
            <span className="text-surface-400 text-sm">Логотип не загружен</span>
          )}
        </div>

        {/* Upload */}
        <div className="flex items-center gap-3 mb-3">
          <label className="btn-primary cursor-pointer inline-block">
            {uploading ? 'Загрузка...' : 'Загрузить логотип'}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          {logoUrl && (
            <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-400 transition-colors">
              Удалить
            </button>
          )}
        </div>

        <p className="text-xs text-surface-400 mb-3">
          PNG, JPG, SVG, WebP или GIF. Максимум 2 МБ. Рекомендуемая высота: 48px.
        </p>

        {msg && (
          <div className={`text-sm p-2 rounded ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg.text}
          </div>
        )}
      </div>

      <GuestModeSettings />
    </div>
  );
}
