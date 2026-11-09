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

function SortableRow({ item, disabled }: { item: OrderingItem; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-2 rounded-lg border border-surface-200 bg-white ${
        disabled ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      {item.text}
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
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {order.map((id) => {
            const item = itemsById.get(id);
            if (!item) return null;
            return <SortableRow key={id} item={item} disabled={disabled} />;
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
