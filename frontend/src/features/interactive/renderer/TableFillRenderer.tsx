import type { RendererProps, TableFillAnswer, TableFillConfig } from '../types';

export default function TableFillRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<TableFillConfig, TableFillAnswer>) {
  const cells = value?.cells ?? {};
  const locked = config.locked_cells ?? {};

  const setCell = (key: string, v: string) => {
    onAnswerChange({ cells: { ...cells, [key]: v } });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 border-b border-surface-200" />
            {config.columns.map((col) => (
              <th key={col.id} className="text-left p-2 border-b border-surface-200 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.rows.map((row) => (
            <tr key={row.id}>
              <td className="p-2 font-medium text-surface-500">{row.label}</td>
              {config.columns.map((col) => {
                const key = `${row.id}:${col.id}`;
                const lockedValue = locked[key];
                if (lockedValue !== undefined) {
                  return (
                    <td key={col.id} className="p-2 bg-surface-50 text-surface-500">
                      {lockedValue}
                    </td>
                  );
                }
                return (
                  <td key={col.id} className="p-1">
                    <input
                      type="text"
                      value={cells[key] ?? ''}
                      disabled={disabled}
                      onChange={(e) => setCell(key, e.target.value)}
                      className="w-24 border border-surface-300 rounded px-2 py-1"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
