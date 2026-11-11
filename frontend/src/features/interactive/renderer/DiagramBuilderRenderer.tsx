import { useState } from 'react';
import type { DiagramBuilderAnswer, DiagramBuilderConfig, RendererProps } from '../types';

// Click-to-connect: pick a source node, then a target node to add an edge.
export default function DiagramBuilderRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<DiagramBuilderConfig, DiagramBuilderAnswer>) {
  const edges = value?.edges ?? [];
  const [source, setSource] = useState<string | null>(null);
  const nodesById = new Map(config.nodes.map((n) => [n.id, n]));

  const pickNode = (id: string) => {
    if (disabled) return;
    if (!source) {
      setSource(id);
      return;
    }
    if (source === id) {
      setSource(null);
      return;
    }
    onAnswerChange({ edges: [...edges, [source, id]] });
    setSource(null);
  };

  const removeEdge = (index: number) => {
    if (disabled) return;
    onAnswerChange({ edges: edges.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-surface-400">
        Выберите узел-источник, затем узел-назначение, чтобы добавить связь
        {config.directed !== false ? ' (направленную)' : ''}.
      </div>
      <div className="flex flex-wrap gap-2">
        {config.nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            disabled={disabled}
            onClick={() => pickNode(node.id)}
            className={`px-3 py-2 rounded-lg border text-sm ${
              source === node.id ? 'border-primary-500 bg-primary-50' : 'border-surface-200 hover:border-primary-300'
            }`}
          >
            {node.label}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {edges.map(([from, to], i) => (
          <div key={i} className="flex items-center gap-2 text-sm bg-surface-50 rounded px-2 py-1 w-fit">
            <span>{nodesById.get(from)?.label ?? from}</span>
            <span className="text-surface-400">{config.directed !== false ? '→' : '↔'}</span>
            <span>{nodesById.get(to)?.label ?? to}</span>
            <button type="button" disabled={disabled} onClick={() => removeEdge(i)} className="text-red-500 ml-1">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
