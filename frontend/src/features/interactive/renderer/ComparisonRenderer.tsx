import type { ComparisonAnswer, ComparisonConfig, RendererProps } from '../types';

function Side({
  side,
  imageUrl,
  regions,
  selected,
  disabled,
  onToggle,
}: {
  side: 'left' | 'right';
  imageUrl?: string;
  regions: ComparisonConfig['regions'];
  selected: Set<string>;
  disabled?: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border border-surface-200"
      style={{
        aspectRatio: '4 / 3',
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundColor: imageUrl ? undefined : '#f1f5f9',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {regions
        .filter((r) => r.side === side)
        .map((region) => (
          <button
            key={region.id}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(region.id)}
            className={`absolute border-2 rounded ${
              selected.has(region.id) ? 'border-primary-500 bg-primary-500/30' : 'border-white/70 bg-white/10 hover:bg-white/20'
            }`}
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.width * 100}%`,
              height: `${region.height * 100}%`,
            }}
          />
        ))}
    </div>
  );
}

export default function ComparisonRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<ComparisonConfig, ComparisonAnswer>) {
  const selected = new Set(value?.selected_region_ids ?? []);

  const toggle = (id: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onAnswerChange({ selected_region_ids: Array.from(next) });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Side side="left" imageUrl={config.left_image_url} regions={config.regions} selected={selected} disabled={disabled} onToggle={toggle} />
      <Side side="right" imageUrl={config.right_image_url} regions={config.regions} selected={selected} disabled={disabled} onToggle={toggle} />
    </div>
  );
}
