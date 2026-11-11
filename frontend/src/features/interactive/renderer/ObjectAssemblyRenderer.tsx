import { useState } from 'react';
import type { ObjectAssemblyAnswer, ObjectAssemblyConfig, RendererProps } from '../types';

// Click-to-place: pick a part from the pool, then click a zone to place it.
export default function ObjectAssemblyRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<ObjectAssemblyConfig, ObjectAssemblyAnswer>) {
  const placements = value?.placements ?? {};
  const [selectedPart, setSelectedPart] = useState<string | null>(null);

  const usedPartIds = new Set(Object.values(placements));
  const partsById = new Map(config.parts.map((p) => [p.id, p]));

  const pickPart = (id: string) => {
    if (disabled) return;
    setSelectedPart(id === selectedPart ? null : id);
  };

  const placeInZone = (zoneId: string) => {
    if (disabled || !selectedPart) return;
    onAnswerChange({ placements: { ...placements, [zoneId]: selectedPart } });
    setSelectedPart(null);
  };

  const clearZone = (zoneId: string) => {
    if (disabled) return;
    const next = { ...placements };
    delete next[zoneId];
    onAnswerChange({ placements: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-surface-400 mb-1">Детали:</div>
        <div className="flex flex-wrap gap-2">
          {config.parts.map((part) => (
            <button
              key={part.id}
              type="button"
              disabled={disabled || usedPartIds.has(part.id)}
              onClick={() => pickPart(part.id)}
              className={`px-3 py-1.5 rounded-lg border text-sm ${
                usedPartIds.has(part.id)
                  ? 'opacity-40 border-surface-200'
                  : selectedPart === part.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-surface-200 hover:border-primary-300'
              }`}
            >
              {part.text}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {config.zones.map((zone) => {
          const placedPartId = placements[zone.id];
          const placedPart = placedPartId ? partsById.get(placedPartId) : undefined;
          return (
            <button
              key={zone.id}
              type="button"
              disabled={disabled}
              onClick={() => (placedPart ? clearZone(zone.id) : placeInZone(zone.id))}
              className={`text-left p-3 rounded-lg border ${
                placedPart ? 'border-green-400 bg-green-50' : 'border-dashed border-surface-300'
              }`}
            >
              <div className="text-xs text-surface-400 mb-1">{zone.label}</div>
              <div className="text-sm">{placedPart ? placedPart.text : '— нажмите, выбрав деталь выше —'}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
