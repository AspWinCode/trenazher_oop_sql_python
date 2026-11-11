import type { EditorProps, SimulationConfig } from '../types';

let idCounter = 0;
const nextId = () => `param_${Date.now()}_${idCounter++}`;

const EMPTY: SimulationConfig = { parameters: [], formula: '', target_min: 0, target_max: 0 };

export default function SimulationEditor({ config, onChange }: EditorProps<SimulationConfig>) {
  const cfg = config ?? EMPTY;

  const addParameter = () => {
    onChange({
      ...cfg,
      parameters: [...cfg.parameters, { id: nextId(), label: '', min: 0, max: 100, step: 1, default: 50 }],
    });
  };
  const updateParam = (id: string, patch: Partial<SimulationConfig['parameters'][number]>) => {
    onChange({ ...cfg, parameters: cfg.parameters.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };
  const removeParam = (id: string) => onChange({ ...cfg, parameters: cfg.parameters.filter((p) => p.id !== id) });

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={cfg.prompt ?? ''}
        onChange={(e) => onChange({ ...cfg, prompt: e.target.value })}
        placeholder="Условие (необязательно)"
        className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
      />

      <div className="space-y-2">
        {cfg.parameters.map((p) => (
          <div key={p.id} className="border border-surface-200 rounded-lg p-2 grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
            <code className="text-xs bg-surface-100 px-1 rounded col-span-2 sm:col-span-1">{p.id}</code>
            <input
              type="text"
              value={p.label}
              onChange={(e) => updateParam(p.id, { label: e.target.value })}
              placeholder="Название"
              className="border border-surface-300 rounded px-2 py-1 text-sm col-span-2"
            />
            <input type="number" value={p.min} onChange={(e) => updateParam(p.id, { min: Number(e.target.value) })} placeholder="min" className="border border-surface-300 rounded px-2 py-1 text-sm" />
            <input type="number" value={p.max} onChange={(e) => updateParam(p.id, { max: Number(e.target.value) })} placeholder="max" className="border border-surface-300 rounded px-2 py-1 text-sm" />
            <input type="number" value={p.step} onChange={(e) => updateParam(p.id, { step: Number(e.target.value) })} placeholder="шаг" className="border border-surface-300 rounded px-2 py-1 text-sm" />
            <div className="flex items-center gap-1">
              <input type="number" value={p.default} onChange={(e) => updateParam(p.id, { default: Number(e.target.value) })} placeholder="нач." className="w-full border border-surface-300 rounded px-2 py-1 text-sm" />
              <button type="button" onClick={() => removeParam(p.id)} className="text-red-500 text-sm shrink-0">✕</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addParameter} className="btn-sm border border-surface-300">+ Параметр</button>

      <div>
        <label className="text-sm font-medium block mb-1">
          Формула пересчёта (id параметров: {cfg.parameters.map((p) => p.id).join(', ') || '—'})
        </label>
        <input
          type="text"
          value={cfg.formula}
          onChange={(e) => onChange({ ...cfg, formula: e.target.value })}
          placeholder="speed / load"
          className="w-full border border-surface-300 rounded px-2 py-1 text-sm font-mono"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Целевой диапазон результата:</label>
        <input type="number" value={cfg.target_min} onChange={(e) => onChange({ ...cfg, target_min: Number(e.target.value) })} className="w-28 border border-surface-300 rounded px-2 py-1 text-sm" />
        <span>—</span>
        <input type="number" value={cfg.target_max} onChange={(e) => onChange({ ...cfg, target_max: Number(e.target.value) })} className="w-28 border border-surface-300 rounded px-2 py-1 text-sm" />
      </div>
    </div>
  );
}
