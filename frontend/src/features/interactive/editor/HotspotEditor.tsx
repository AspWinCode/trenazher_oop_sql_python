import type { EditorProps, HotspotConfig } from '../types';

let idCounter = 0;
const nextId = () => `region_${Date.now()}_${idCounter++}`;

const EMPTY: HotspotConfig = { regions: [], correct_region_ids: [] };

export default function HotspotEditor({ config, onChange }: EditorProps<HotspotConfig>) {
  const cfg = config ?? EMPTY;

  const addRegion = () => {
    onChange({ ...cfg, regions: [...cfg.regions, { id: nextId(), x: 0.1, y: 0.1, width: 0.2, height: 0.2 }] });
  };
  const updateRegion = (id: string, patch: Partial<HotspotConfig['regions'][number]>) => {
    onChange({ ...cfg, regions: cfg.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  };
  const removeRegion = (id: string) => {
    onChange({
      regions: cfg.regions.filter((r) => r.id !== id),
      correct_region_ids: cfg.correct_region_ids.filter((c) => c !== id),
      image_url: cfg.image_url,
    });
  };
  const toggleCorrect = (id: string) => {
    onChange({
      ...cfg,
      correct_region_ids: cfg.correct_region_ids.includes(id)
        ? cfg.correct_region_ids.filter((c) => c !== id)
        : [...cfg.correct_region_ids, id],
    });
  };

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
        Координаты x/y/width/height — доли от 0 до 1 (0.1 = 10% от ширины/высоты изображения).
      </div>
      {cfg.regions.map((r) => (
        <div key={r.id} className="border border-surface-200 rounded-lg p-2 grid grid-cols-5 gap-2 items-center">
          <label className="flex items-center gap-1 text-xs col-span-1">
            <input type="checkbox" checked={cfg.correct_region_ids.includes(r.id)} onChange={() => toggleCorrect(r.id)} />
            верно
          </label>
          <input type="number" step={0.01} min={0} max={1} value={r.x} onChange={(e) => updateRegion(r.id, { x: Number(e.target.value) })} placeholder="x" className="border border-surface-300 rounded px-2 py-1 text-sm" />
          <input type="number" step={0.01} min={0} max={1} value={r.y} onChange={(e) => updateRegion(r.id, { y: Number(e.target.value) })} placeholder="y" className="border border-surface-300 rounded px-2 py-1 text-sm" />
          <input type="number" step={0.01} min={0} max={1} value={r.width} onChange={(e) => updateRegion(r.id, { width: Number(e.target.value) })} placeholder="width" className="border border-surface-300 rounded px-2 py-1 text-sm" />
          <div className="flex items-center gap-1">
            <input type="number" step={0.01} min={0} max={1} value={r.height} onChange={(e) => updateRegion(r.id, { height: Number(e.target.value) })} placeholder="height" className="w-full border border-surface-300 rounded px-2 py-1 text-sm" />
            <button type="button" onClick={() => removeRegion(r.id)} className="text-red-500 text-sm shrink-0">✕</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addRegion} className="btn-sm border border-surface-300">+ Область</button>
    </div>
  );
}
