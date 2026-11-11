import type { EditorProps, PointSelectionConfig } from '../types';

let idCounter = 0;
const nextId = () => `point_${Date.now()}_${idCounter++}`;

const EMPTY: PointSelectionConfig = { target_points: [] };

export default function PointSelectionEditor({ config, onChange }: EditorProps<PointSelectionConfig>) {
  const cfg = config ?? EMPTY;

  const addPoint = () => {
    onChange({ ...cfg, target_points: [...cfg.target_points, { id: nextId(), x: 0.5, y: 0.5, radius: 0.05 }] });
  };
  const updatePoint = (id: string, patch: Partial<PointSelectionConfig['target_points'][number]>) => {
    onChange({ ...cfg, target_points: cfg.target_points.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };
  const removePoint = (id: string) => onChange({ ...cfg, target_points: cfg.target_points.filter((p) => p.id !== id) });

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={cfg.image_url ?? ''}
        onChange={(e) => onChange({ ...cfg, image_url: e.target.value })}
        placeholder="URL изображения (необязательно)"
        className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
      />
      <div className="text-xs text-surface-400">
        Координаты и радиус — доли от 0 до 1 относительно изображения.
      </div>
      {cfg.target_points.map((p) => (
        <div key={p.id} className="border border-surface-200 rounded-lg p-2 grid grid-cols-4 gap-2 items-center">
          <input type="number" step={0.01} min={0} max={1} value={p.x} onChange={(e) => updatePoint(p.id, { x: Number(e.target.value) })} placeholder="x" className="border border-surface-300 rounded px-2 py-1 text-sm" />
          <input type="number" step={0.01} min={0} max={1} value={p.y} onChange={(e) => updatePoint(p.id, { y: Number(e.target.value) })} placeholder="y" className="border border-surface-300 rounded px-2 py-1 text-sm" />
          <input type="number" step={0.01} min={0} max={1} value={p.radius} onChange={(e) => updatePoint(p.id, { radius: Number(e.target.value) })} placeholder="радиус" className="border border-surface-300 rounded px-2 py-1 text-sm" />
          <button type="button" onClick={() => removePoint(p.id)} className="text-red-500 text-sm">✕</button>
        </div>
      ))}
      <button type="button" onClick={addPoint} className="btn-sm border border-surface-300">+ Точка</button>
    </div>
  );
}
