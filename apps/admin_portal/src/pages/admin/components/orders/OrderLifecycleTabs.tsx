import React from 'react';
import { ORDER_LIFECYCLE_STAGES, OrderLifecycleStageId } from './orderFilters';

interface OrderLifecycleTabsProps {
  selected: OrderLifecycleStageId | string;
  onChange: (stage: OrderLifecycleStageId) => void;
}

export const OrderLifecycleTabs: React.FC<OrderLifecycleTabsProps> = ({ selected, onChange }) => (
  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
    {ORDER_LIFECYCLE_STAGES.map((stage) => (
      <button
        key={stage.id}
        onClick={() => onChange(stage.id)}
        className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          selected === stage.id
            ? 'bg-primary-600 text-white font-semibold shadow-sm'
            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
        }`}
      >
        {stage.label}
      </button>
    ))}
  </div>
);
