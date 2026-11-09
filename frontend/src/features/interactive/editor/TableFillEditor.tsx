import type { EditorProps, TableCellSpec, TableFillConfig } from '../types';

let idCounter = 0;
const nextId = (p: string) => `${p}_${Date.now()}_${idCounter++}`;
const splitCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

const EMPTY: TableFillConfig = { columns: [], rows: [], correct_cells: {} };

export default function TableFillEditor({ config, onChange }: EditorProps<TableFillConfig>) {
  const cfg = config ?? EMPTY;

  const addColumn = () => onChange({ ...cfg, columns: [...cfg.columns, { id: nextId('col'), label: '' }] });
  const addRow = () => onChange({ ...cfg, rows: [...cfg.rows, { id: nextId('row'), label: '' }] });

  const updateColumnLabel = (id: string, label: string) => {
    onChange({ ...cfg, columns: cfg.columns.map((c) => (c.id === id ? { ...c, label } : c)) });
  };
  const updateRowLabel = (id: string, label: string) => {
    onChange({ ...cfg, rows: cfg.rows.map((r) => (r.id === id ? { ...r, label } : r)) });
  };

  const removeColumn = (id: string) => {
    const cells = { ...cfg.correct_cells };
    for (const key of Object.keys(cells)) if (key.endsWith(`:${id}`)) delete cells[key];
    onChange({ ...cfg, columns: cfg.columns.filter((c) => c.id !== id), correct_cells: cells });
  };
  const removeRow = (id: string) => {
    const cells = { ...cfg.correct_cells };
    for (const key of Object.keys(cells)) if (key.startsWith(`${id}:`)) delete cells[key];
    onChange({ ...cfg, rows: cfg.rows.filter((r) => r.id !== id), correct_cells: cells });
  };

  const updateCell = (key: string, patch: Partial<TableCellSpec>) => {
    const current: TableCellSpec = cfg.correct_cells[key] ?? { type: 'text', values: [] };
    onChange({ ...cfg, correct_cells: { ...cfg.correct_cells, [key]: { ...current, ...patch } } });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button type="button" onClick={addColumn} className="btn-sm border border-surface-300">+ Столбец</button>
        <button type="button" onClick={addRow} className="btn-sm border border-surface-300">+ Строка</button>
      </div>

      <div className="space-y-1">
        {cfg.columns.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <input
              type="text"
              value={c.label}
              onChange={(e) => updateColumnLabel(c.id, e.target.value)}
              placeholder="Название столбца"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <button type="button" onClick={() => removeColumn(c.id)} className="text-red-500 text-sm">✕ столбец</button>
          </div>
        ))}
      </div>

      {cfg.rows.map((row) => (
        <div key={row.id} className="border border-surface-200 rounded-lg p-2 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={row.label}
              onChange={(e) => updateRowLabel(row.id, e.target.value)}
              placeholder="Название строки"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm font-medium"
            />
            <button type="button" onClick={() => removeRow(row.id)} className="text-red-500 text-sm">✕ строка</button>
          </div>
          {cfg.columns.map((col) => {
            const key = `${row.id}:${col.id}`;
            const spec = cfg.correct_cells[key] ?? { type: 'text', values: [] };
            return (
              <div key={col.id} className="flex items-center gap-2 pl-4">
                <span className="text-xs text-surface-400 w-24 truncate">{col.label || col.id}</span>
                <select
                  value={spec.type}
                  onChange={(e) => updateCell(key, { type: e.target.value as 'text' | 'number' })}
                  className="border border-surface-300 rounded px-1 py-0.5 text-xs"
                >
                  <option value="text">текст</option>
                  <option value="number">число</option>
                </select>
                <input
                  type="text"
                  defaultValue={spec.values.join(', ')}
                  onBlur={(e) => updateCell(key, { values: splitCsv(e.target.value) })}
                  placeholder="Правильное значение(я)"
                  className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
                />
                {spec.type === 'number' && (
                  <input
                    type="number"
                    defaultValue={spec.tolerance ?? 0}
                    onBlur={(e) => updateCell(key, { tolerance: Number(e.target.value) || 0 })}
                    placeholder="±"
                    className="w-16 border border-surface-300 rounded px-2 py-1 text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
