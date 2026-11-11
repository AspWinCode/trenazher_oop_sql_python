import type { DiagramBuilderConfig, EditorProps } from '../types';

let idCounter = 0;
const nextId = () => `node_${Date.now()}_${idCounter++}`;

const EMPTY: DiagramBuilderConfig = { directed: true, nodes: [], correct_edges: [] };

export default function DiagramBuilderEditor({ config, onChange }: EditorProps<DiagramBuilderConfig>) {
  const cfg = config ?? EMPTY;

  const addNode = () => onChange({ ...cfg, nodes: [...cfg.nodes, { id: nextId(), label: '' }] });
  const updateLabel = (id: string, label: string) => {
    onChange({ ...cfg, nodes: cfg.nodes.map((n) => (n.id === id ? { ...n, label } : n)) });
  };
  const removeNode = (id: string) => {
    onChange({
      ...cfg,
      nodes: cfg.nodes.filter((n) => n.id !== id),
      correct_edges: cfg.correct_edges.filter(([a, b]) => a !== id && b !== id),
    });
  };

  const [fromSel, toSel] = [cfg.nodes[0]?.id ?? '', cfg.nodes[1]?.id ?? ''];
  const addEdge = (from: string, to: string) => {
    if (!from || !to || from === to) return;
    onChange({ ...cfg, correct_edges: [...cfg.correct_edges, [from, to]] });
  };
  const removeEdge = (index: number) => {
    onChange({ ...cfg, correct_edges: cfg.correct_edges.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.directed !== false} onChange={(e) => onChange({ ...cfg, directed: e.target.checked })} />
        Направленные связи
      </label>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Узлы</label>
          <button type="button" onClick={addNode} className="btn-sm border border-surface-300">+ Узел</button>
        </div>
        {cfg.nodes.map((n) => (
          <div key={n.id} className="flex items-center gap-2 mb-1">
            <input
              type="text"
              value={n.label}
              onChange={(e) => updateLabel(n.id, e.target.value)}
              placeholder="Название узла"
              className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
            />
            <button type="button" onClick={() => removeNode(n.id)} className="text-red-500 text-sm">✕</button>
          </div>
        ))}
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Правильные связи</label>
        {cfg.correct_edges.map(([from, to], i) => (
          <div key={i} className="flex items-center gap-2 text-sm mb-1">
            <span>{cfg.nodes.find((n) => n.id === from)?.label ?? from}</span>
            <span className="text-surface-400">→</span>
            <span>{cfg.nodes.find((n) => n.id === to)?.label ?? to}</span>
            <button type="button" onClick={() => removeEdge(i)} className="text-red-500">✕</button>
          </div>
        ))}
        {cfg.nodes.length >= 2 && (
          <EdgeAdder nodes={cfg.nodes} onAdd={addEdge} />
        )}
      </div>
    </div>
  );
}

function EdgeAdder({ nodes, onAdd }: { nodes: DiagramBuilderConfig['nodes']; onAdd: (from: string, to: string) => void }) {
  let from = nodes[0]?.id ?? '';
  let to = nodes[1]?.id ?? nodes[0]?.id ?? '';
  return (
    <div className="flex items-center gap-2">
      <select defaultValue={from} onChange={(e) => (from = e.target.value)} className="border border-surface-300 rounded px-2 py-1 text-sm">
        {nodes.map((n) => <option key={n.id} value={n.id}>{n.label || n.id}</option>)}
      </select>
      <span className="text-surface-400">→</span>
      <select defaultValue={to} onChange={(e) => (to = e.target.value)} className="border border-surface-300 rounded px-2 py-1 text-sm">
        {nodes.map((n) => <option key={n.id} value={n.id}>{n.label || n.id}</option>)}
      </select>
      <button type="button" onClick={() => onAdd(from, to)} className="btn-sm border border-surface-300">+ Связь</button>
    </div>
  );
}
