import { useState } from 'react';
import type { RendererProps, RestoreStructureAnswer, RestoreStructureConfig } from '../types';

// Click-to-place: pick a part from the pool, then click the slot to place it.
export default function RestoreStructureRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<RestoreStructureConfig, RestoreStructureAnswer>) {
  const placements = value?.placements ?? {};
  const [selectedPart, setSelectedPart] = useState<string | null>(null);

  const usedPartIds = new Set(Object.values(placements));
  const partsById = new Map(config.pool.map((p) => [p.id, p]));

  const pickPart = (id: string) => {
    if (disabled) return;
    setSelectedPart(id === selectedPart ? null : id);
  };

  const placeInSlot = (slotId: string) => {
    if (disabled || !selectedPart) return;
    const next = { ...placements, [slotId]: selectedPart };
    onAnswerChange({ placements: next });
    setSelectedPart(null);
  };

  const clearSlot = (slotId: string) => {
    if (disabled) return;
    const next = { ...placements };
    delete next[slotId];
    onAnswerChange({ placements: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-surface-400 mb-1">Доступные детали:</div>
        <div className="flex flex-wrap gap-2">
          {config.pool.map((part) => (
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

      <div className="space-y-2">
        {config.slots.map((slot) => {
          const placedPartId = placements[slot.id];
          const placedPart = placedPartId ? partsById.get(placedPartId) : undefined;
          return (
            <div key={slot.id} className="flex items-center gap-3">
              <span className="w-28 text-sm text-surface-500 shrink-0">{slot.label}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => (placedPart ? clearSlot(slot.id) : placeInSlot(slot.id))}
                className={`flex-1 text-left px-3 py-2 rounded-lg border text-sm ${
                  placedPart ? 'border-green-400 bg-green-50' : 'border-dashed border-surface-300 text-surface-400'
                }`}
              >
                {placedPart ? placedPart.text : '— выберите деталь выше, затем нажмите сюда —'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
