import type { EditorProps, ObjectAssemblyConfig } from '../types';

let idCounter = 0;
const nextId = (p: string) => `${p}_${Date.now()}_${idCounter++}`;

const EMPTY: ObjectAssemblyConfig = { zones: [], parts: [], correct_placements: {} };

export default function ObjectAssemblyEditor({ config, onChange }: EditorProps<ObjectAssemblyConfig>) {
  const cfg = config ?? EMPTY;

  const addZone = () => onChange({ ...cfg, zones: [...cfg.zones, { id: nextId('zone'), label: '' }] });
  const addPart = () => onChange({ ...cfg, parts: [...cfg.parts, { id: nextId('part'), text: '' }] });

  const updateZoneLabel = (id: string, label: string) => {
    onChange({ ...cfg, zones: cfg.zones.map((z) => (z.id === id ? { ...z, label } : z)) });
  };
  const updatePartText = (id: string, text: string) => {
    onChange({ ...cfg, parts: cfg.parts.map((p) => (p.id === id ? { ...p, text } : p)) });
  };

  const removeZone = (id: string) => {
    const placements = { ...cfg.correct_placements };
    delete placements[id];
    onChange({ ...cfg, zones: cfg.zones.filter((z) => z.id !== id), correct_placements: placements });
  };
  const removePart = (id: string) => {
    const placements = Object.fromEntries(Object.entries(cfg.correct_placements).filter(([, v]) => v !== id));
    onChange({ ...cfg, parts: cfg.parts.filter((p) => p.id !== id), correct_placements: placements });
  };

  const setPlacement = (zoneId: string, partId: string) => {
    onChange({ ...cfg, correct_placements: { ...cfg.correct_placements, [zoneId]: partId } });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Детали (можно добавить лишние)</label>
          <button type="button" onClick={addPart} className="btn-sm border border-surface-300">+ Деталь</button>
        </div>
        {cfg.parts.map((part) => (
          <div key={part.id} className="flex items-center gap-2 mb-1">
            <input
              type="text"
              value={part.text}
              onChange={(e) => updatePartText(part.id, e.target.value)}
              placeholder="Текст детали"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <button type="button" onClick={() => removePart(part.id)} className="text-red-500 text-sm">✕</button>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Зоны и правильная деталь</label>
          <button type="button" onClick={addZone} className="btn-sm border border-surface-300">+ Зона</button>
        </div>
        {cfg.zones.map((zone) => (
          <div key={zone.id} className="flex items-center gap-2 mb-1">
            <input
              type="text"
              value={zone.label}
              onChange={(e) => updateZoneLabel(zone.id, e.target.value)}
              placeholder="Название зоны"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <select
              value={cfg.correct_placements[zone.id] ?? ''}
              onChange={(e) => setPlacement(zone.id, e.target.value)}
              className="border border-surface-300 rounded px-2 py-1 text-sm"
            >
              <option value="" disabled>— деталь —</option>
              {cfg.parts.map((p) => (
                <option key={p.id} value={p.id}>{p.text || '(без текста)'}</option>
              ))}
            </select>
            <button type="button" onClick={() => removeZone(zone.id)} className="text-red-500 text-sm">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
