import React from 'react';
import { cn } from '../../../../utils/cn';

export interface OrderStatusCardsProps {
  counts: Record<string, number>;
  total: number;
  selected: string;
  onSelect: (status: string) => void;
  isLoading?: boolean;
}

const CARDS: Array<{ id: string; label: string; dotClass: string }> = [
  { id: 'ALL', label: 'All Orders', dotClass: 'bg-slate-400' },
  { id: 'PLACED', label: 'Placed', dotClass: 'bg-sky-500' },
  { id: 'RIDER_ASSIGNED', label: 'Courier Assigned', dotClass: 'bg-indigo-400' },
  { id: 'ACCEPTED', label: 'Accepted', dotClass: 'bg-indigo-600' },
  { id: 'PREPARING', label: 'Preparing', dotClass: 'bg-amber-500' },
  { id: 'READY_FOR_PICKUP', label: 'Ready for Pickup', dotClass: 'bg-amber-600' },
  { id: 'DISPATCHED', label: 'On Delivery', dotClass: 'bg-emerald-500' },
  { id: 'DELIVERED', label: 'Delivered', dotClass: 'bg-emerald-600' },
  { id: 'CANCELLED', label: 'Cancelled', dotClass: 'bg-rose-500' },
];

/** At-a-glance status mix for the current date/search window; each card is a
 *  shortcut that applies the matching lifecycle tab filter. */
export const OrderStatusCards: React.FC<OrderStatusCardsProps> = ({
  counts,
  total,
  selected,
  onSelect,
  isLoading,
}) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
    {CARDS.map((card) => {
      const value = card.id === 'ALL' ? total : counts[card.id] ?? 0;
      const isActive = selected === card.id;
      return (
        <button
          key={card.id}
          type="button"
          onClick={() => onSelect(card.id)}
          className={cn(
            'rounded-xl border bg-white p-3.5 text-left shadow-sm transition-all cursor-pointer dark:bg-slate-900',
            isActive
              ? 'border-primary-500 ring-1 ring-primary-500'
              : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full shrink-0', card.dotClass)} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
              {card.label}
            </span>
          </div>
          <div className="mt-1.5 text-xl font-bold text-slate-900 dark:text-slate-100">
            {isLoading ? '…' : value.toLocaleString()}
          </div>
        </button>
      );
    })}
  </div>
);
