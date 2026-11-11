import type { EditorProps, HierarchyBuilderConfig } from '../types';

let idCounter = 0;
const nextId = () => `node_${Date.now()}_${idCounter++}`;

const EMPTY: HierarchyBuilderConfig = { nodes: [], correct_parents: {} };

export default function HierarchyBuilderEditor({ config, onChange }: EditorProps<HierarchyBuilderConfig>) {
  const cfg = config ?? EMPTY;

  const addNode = () => {
    const id = nextId();
    onChange({ nodes: [...cfg.nodes, { id, label: '' }], correct_parents: { ...cfg.correct_parents, [id]: null } });
  };
  const updateLabel = (id: string, label: string) => {
    onChange({ ...cfg, nodes: cfg.nodes.map((n) => (n.id === id ? { ...n, label } : n)) });
  };
  const removeNode = (id: string) => {
    const parents = { ...cfg.correct_parents };
    delete parents[id];
    for (const k of Object.keys(parents)) if (parents[k] === id) parents[k] = null;
    onChange({ nodes: cfg.nodes.filter((n) => n.id !== id), correct_parents: parents });
  };
  const setParent = (id: string, parentId: string) => {
    onChange({ ...cfg, correct_parents: { ...cfg.correct_parents, [id]: parentId === '' ? null : parentId } });
  };

  return (
    <div className="space-y-2">
      {cfg.nodes.map((node) => (
        <div key={node.id} className="flex items-center gap-2">
          <input
            type="text"
            value={node.label}
            onChange={(e) => updateLabel(node.id, e.target.value)}
            placeholder="Название узла"
            className="flex-1 border border-surface-300 rounded px-2 py-1 text-sm"
          />
          <span className="text-xs text-surface-400">родитель:</span>
          <select
            value={cfg.correct_parents[node.id] ?? ''}
            onChange={(e) => setParent(node.id, e.target.value)}
            className="border border-surface-300 rounded px-2 py-1 text-sm"
          >
            <option value="">— корень —</option>
            {cfg.nodes.filter((n) => n.id !== node.id).map((n) => (
              <option key={n.id} value={n.id}>{n.label || n.id}</option>
            ))}
          </select>
          <button type="button" onClick={() => removeNode(node.id)} className="text-red-500 text-sm">✕</button>
        </div>
      ))}
      <button type="button" onClick={addNode} className="btn-sm border border-surface-300">+ Узел</button>
    </div>
  );
}
