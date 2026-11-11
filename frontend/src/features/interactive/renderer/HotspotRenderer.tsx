import type { HotspotAnswer, HotspotConfig, RendererProps } from '../types';

export default function HotspotRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<HotspotConfig, HotspotAnswer>) {
  const selected = new Set(value?.selected_region_ids ?? []);

  const toggle = (id: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onAnswerChange({ selected_region_ids: Array.from(next) });
  };

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border border-surface-200"
      style={{
        aspectRatio: '16 / 9',
        backgroundImage: config.image_url ? `url(${config.image_url})` : undefined,
        backgroundColor: config.image_url ? undefined : '#f1f5f9',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {config.regions.map((region) => (
        <button
          key={region.id}
          type="button"
          disabled={disabled}
          onClick={() => toggle(region.id)}
          title={region.id}
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
