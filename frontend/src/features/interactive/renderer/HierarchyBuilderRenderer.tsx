import type { HierarchyBuilderAnswer, HierarchyBuilderConfig, RendererProps } from '../types';

export default function HierarchyBuilderRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<HierarchyBuilderConfig, HierarchyBuilderAnswer>) {
  const parents = value?.parents ?? {};

  const setParent = (nodeId: string, parentId: string) => {
    onAnswerChange({ parents: { ...parents, [nodeId]: parentId === '' ? null : parentId } });
  };

  return (
    <div className="space-y-2">
      {config.nodes.map((node) => (
        <div key={node.id} className="flex items-center gap-2">
          <span className="w-40 text-sm font-medium truncate">{node.label}</span>
          <span className="text-surface-400 text-sm">родитель:</span>
          <select
            value={parents[node.id] ?? ''}
            disabled={disabled}
            onChange={(e) => setParent(node.id, e.target.value)}
            className="border border-surface-300 rounded px-2 py-1 text-sm"
          >
            <option value="">— корень —</option>
            {config.nodes
              .filter((n) => n.id !== node.id)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
          </select>
        </div>
      ))}
    </div>
  );
}
