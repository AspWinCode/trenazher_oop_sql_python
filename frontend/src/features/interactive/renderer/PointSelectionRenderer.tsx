import { useRef } from 'react';
import type { PointSelectionAnswer, PointSelectionConfig, RendererProps } from '../types';

export default function PointSelectionRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<PointSelectionConfig, PointSelectionAnswer>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const points = value?.points ?? [];
  const maxPoints = config.target_points.length;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const next = [...points, { x, y }];
    if (next.length > maxPoints) next.shift();
    onAnswerChange({ points: next });
  };

  const clearPoints = () => onAnswerChange({ points: [] });

  return (
    <div className="space-y-2">
      <div className="text-xs text-surface-400">
        Кликните на изображение, чтобы указать точку(и) — нужно {maxPoints}. Отмечено: {points.length}.
      </div>
      <div
        ref={containerRef}
        onClick={handleClick}
        className="relative w-full rounded-lg overflow-hidden border border-surface-200 cursor-crosshair"
        style={{
          aspectRatio: '16 / 9',
          backgroundImage: config.image_url ? `url(${config.image_url})` : undefined,
          backgroundColor: config.image_url ? undefined : '#f1f5f9',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {points.map((p, i) => (
          <div
            key={i}
            className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-primary-500 border-2 border-white shadow"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          />
        ))}
      </div>
      {points.length > 0 && !disabled && (
        <button type="button" onClick={clearPoints} className="text-xs text-surface-400 hover:text-red-500">
          Очистить точки
        </button>
      )}
    </div>
  );
}
