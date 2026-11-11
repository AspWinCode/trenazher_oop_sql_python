import { useState } from 'react';
import type { FormulaBuilderAnswer, FormulaBuilderConfig, RendererProps } from '../types';

// Click-to-place: pick a block from the pool, then click a slot to place it.
export default function FormulaBuilderRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<FormulaBuilderConfig, FormulaBuilderAnswer>) {
  const sequence = value?.sequence ?? config.slots.map(() => '');
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const blocksById = new Map(config.blocks.map((b) => [b.id, b]));
  const usedBlockIds = new Set(config.allow_reuse ? [] : sequence.filter(Boolean));

  const pickBlock = (id: string) => {
    if (disabled) return;
    setSelectedBlock(id === selectedBlock ? null : id);
  };

  const placeInSlot = (index: number) => {
    if (disabled || !selectedBlock) return;
    const next = [...sequence];
    next[index] = selectedBlock;
    onAnswerChange({ sequence: next });
    if (!config.allow_reuse) setSelectedBlock(null);
  };

  const clearSlot = (index: number) => {
    if (disabled) return;
    const next = [...sequence];
    next[index] = '';
    onAnswerChange({ sequence: next });
  };

  return (
    <div className="space-y-4">
      {config.prompt && <div className="text-sm text-surface-500">{config.prompt}</div>}
      <div className="flex flex-wrap gap-2">
        {config.blocks.map((block) => (
          <button
            key={block.id}
            type="button"
            disabled={disabled || usedBlockIds.has(block.id)}
            onClick={() => pickBlock(block.id)}
            className={`px-3 py-1.5 rounded-lg border font-mono text-sm ${
              usedBlockIds.has(block.id)
                ? 'opacity-40 border-surface-200'
                : selectedBlock === block.id
                ? 'border-primary-500 bg-primary-50'
                : 'border-surface-200 hover:border-primary-300'
            }`}
          >
            {block.text}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {config.slots.map((slot, i) => {
          const blockId = sequence[i];
          const block = blockId ? blocksById.get(blockId) : undefined;
          return (
            <button
              key={slot.id}
              type="button"
              disabled={disabled}
              onClick={() => (block ? clearSlot(i) : placeInSlot(i))}
              className={`min-w-[3rem] px-3 py-2 rounded-lg border font-mono text-sm ${
                block ? 'border-green-400 bg-green-50' : 'border-dashed border-surface-300 text-surface-400'
              }`}
            >
              {block ? block.text : '?'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
