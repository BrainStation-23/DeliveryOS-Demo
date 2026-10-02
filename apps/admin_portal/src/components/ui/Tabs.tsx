import React from 'react';
import { cn } from '../../utils/cn';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  selected: T;
  onChange: (id: T) => void;
  className?: string;
  'aria-label'?: string;
}

/** Shared underline tab bar (keyboard accessible, count badges optional). */
export function Tabs<T extends string>({ items, selected, onChange, className, ...rest }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      className={cn('flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-slate-800', className)}
    >
      {items.map((item) => {
        const isActive = item.id === selected;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs sm:text-sm font-semibold transition-colors select-none cursor-pointer',
              isActive
                ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                  isActive
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
