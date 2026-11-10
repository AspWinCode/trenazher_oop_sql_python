import type { EditorProps, RestoreStructureConfig } from '../types';

let idCounter = 0;
const nextId = (p: string) => `${p}_${Date.now()}_${idCounter++}`;

const EMPTY: RestoreStructureConfig = { slots: [], pool: [], correct_placements: {} };

export default function RestoreStructureEditor({ config, onChange }: EditorProps<RestoreStructureConfig>) {
  const cfg = config ?? EMPTY;

  const addSlot = () => onChange({ ...cfg, slots: [...cfg.slots, { id: nextId('slot'), label: '' }] });
  const addPart = () => onChange({ ...cfg, pool: [...cfg.pool, { id: nextId('part'), text: '' }] });

  const updateSlotLabel = (id: string, label: string) => {
    onChange({ ...cfg, slots: cfg.slots.map((s) => (s.id === id ? { ...s, label } : s)) });
  };
  const updatePartText = (id: string, text: string) => {
    onChange({ ...cfg, pool: cfg.pool.map((p) => (p.id === id ? { ...p, text } : p)) });
  };

  const removeSlot = (id: string) => {
    const placements = { ...cfg.correct_placements };
    delete placements[id];
    onChange({ ...cfg, slots: cfg.slots.filter((s) => s.id !== id), correct_placements: placements });
  };
  const removePart = (id: string) => {
    const placements = Object.fromEntries(Object.entries(cfg.correct_placements).filter(([, v]) => v !== id));
    onChange({ ...cfg, pool: cfg.pool.filter((p) => p.id !== id), correct_placements: placements });
  };

  const setPlacement = (slotId: string, partId: string) => {
    onChange({ ...cfg, correct_placements: { ...cfg.correct_placements, [slotId]: partId } });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Детали (пул, можно добавить лишние)</label>
          <button type="button" onClick={addPart} className="btn-sm border border-surface-300">+ Деталь</button>
        </div>
        {cfg.pool.map((part) => (
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
          <label className="text-sm font-medium">Слоты и правильная деталь</label>
          <button type="button" onClick={addSlot} className="btn-sm border border-surface-300">+ Слот</button>
        </div>
        {cfg.slots.map((slot) => (
          <div key={slot.id} className="flex items-center gap-2 mb-1">
            <input
              type="text"
              value={slot.label}
              onChange={(e) => updateSlotLabel(slot.id, e.target.value)}
              placeholder="Название слота"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <select
              value={cfg.correct_placements[slot.id] ?? ''}
              onChange={(e) => setPlacement(slot.id, e.target.value)}
              className="border border-surface-300 rounded px-2 py-1 text-sm"
            >
              <option value="" disabled>
                — деталь —
              </option>
              {cfg.pool.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.text || '(без текста)'}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => removeSlot(slot.id)} className="text-red-500 text-sm">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
