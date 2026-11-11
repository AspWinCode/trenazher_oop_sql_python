import type { FormulaBuilderConfig, EditorProps } from '../types';

let idCounter = 0;
const nextId = (p: string) => `${p}_${Date.now()}_${idCounter++}`;
const splitCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

const EMPTY: FormulaBuilderConfig = { slots: [], blocks: [], correct_sequences: [[]] };

export default function FormulaBuilderEditor({ config, onChange }: EditorProps<FormulaBuilderConfig>) {
  const cfg = config ?? EMPTY;

  const addBlock = () => onChange({ ...cfg, blocks: [...cfg.blocks, { id: nextId('block'), text: '' }] });
  const updateBlockText = (id: string, text: string) => {
    onChange({ ...cfg, blocks: cfg.blocks.map((b) => (b.id === id ? { ...b, text } : b)) });
  };
  const removeBlock = (id: string) => onChange({ ...cfg, blocks: cfg.blocks.filter((b) => b.id !== id) });

  const setSlotCount = (count: number) => {
    const slots = Array.from({ length: count }, (_, i) => cfg.slots[i] ?? { id: nextId('slot') });
    onChange({ ...cfg, slots });
  };

  const sequenceText = (cfg.correct_sequences[0] ?? []).join(', ');
  const updatePrimarySequence = (text: string) => {
    const ids = splitCsv(text);
    const rest = cfg.correct_sequences.slice(1);
    onChange({ ...cfg, correct_sequences: [ids, ...rest] });
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={cfg.prompt ?? ''}
        onChange={(e) => onChange({ ...cfg, prompt: e.target.value })}
        placeholder="Условие (необязательно)"
        className="w-full border border-surface-300 rounded px-2 py-1 text-sm"
      />

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Блоки (пул)</label>
          <button type="button" onClick={addBlock} className="btn-sm border border-surface-300">+ Блок</button>
        </div>
        {cfg.blocks.map((b) => (
          <div key={b.id} className="flex items-center gap-2 mb-1">
            <code className="text-xs bg-surface-100 px-1 rounded">{b.id}</code>
            <input
              type="text"
              value={b.text}
              onChange={(e) => updateBlockText(b.id, e.target.value)}
              placeholder="Текст блока"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <button type="button" onClick={() => removeBlock(b.id)} className="text-red-500 text-sm">✕</button>
          </div>
        ))}
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Количество ячеек в формуле</label>
        <input
          type="number"
          min={1}
          value={cfg.slots.length}
          onChange={(e) => setSlotCount(Math.max(1, Number(e.target.value) || 1))}
          className="w-24 border border-surface-300 rounded px-2 py-1 text-sm"
        />
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">
          Правильная последовательность (id блоков через запятую, по порядку ячеек)
        </label>
        <input
          type="text"
          defaultValue={sequenceText}
          onBlur={(e) => updatePrimarySequence(e.target.value)}
          placeholder="revenue, minus, cost"
          className="w-full border border-surface-300 rounded px-2 py-1 text-sm font-mono"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!cfg.allow_reuse}
          onChange={(e) => onChange({ ...cfg, allow_reuse: e.target.checked })}
        />
        Разрешить повторное использование блоков
      </label>
    </div>
  );
}
