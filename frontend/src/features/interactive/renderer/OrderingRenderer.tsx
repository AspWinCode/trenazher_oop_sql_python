import { useEffect, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { OrderingAnswer, OrderingConfig, OrderingItem, RendererProps } from '../types';

// Six-dot "grip" icon — a widely recognized visual affordance for "this is
// draggable", attached only to this handle (not the whole row) so clicking
// the item text never accidentally starts a drag.
function GripIcon() {
  return (
    <svg viewBox="0 0 16 24" width="12" height="18" className="shrink-0 text-surface-300" fill="currentColor">
      {[4, 10, 16].map((y) =>
        [4, 12].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} />),
      )}
    </svg>
  );
}

function SortableRow({
  item,
  position,
  disabled,
}: {
  item: OrderingItem;
  position: number;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-lg border border-surface-200 bg-white ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <span
        {...attributes}
        {...listeners}
        className={disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing touch-none'}
        title="Перетащить, чтобы изменить порядок"
      >
        <GripIcon />
      </span>
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-100 text-xs text-surface-400 shrink-0">
        {position}
      </span>
      <span className="flex-1">{item.text}</span>
    </div>
  );
}

export default function OrderingRenderer({
  config,
  value,
  onAnswerChange,
  disabled,
}: RendererProps<OrderingConfig, OrderingAnswer>) {
  const itemsById = new Map(config.items.map((i) => [i.id, i]));
  const [order, setOrder] = useState<string[]>(value?.order ?? config.items.map((i) => i.id));

  useEffect(() => {
    if (value?.order) setOrder(value.order);
  }, [value?.order]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    onAnswerChange({ order: next });
  };

  return (
    <div className="space-y-2">
      {!disabled && (
        <div className="text-xs text-surface-400">Перетащите карточки за ⠿, чтобы расставить их в правильном порядке.</div>
      )}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {order.map((id, index) => {
              const item = itemsById.get(id);
              if (!item) return null;
              return <SortableRow key={id} item={item} position={index + 1} disabled={disabled} />;
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
