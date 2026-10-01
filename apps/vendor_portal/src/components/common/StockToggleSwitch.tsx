import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface StockToggleSwitchProps {
  isInStock: boolean;
  onToggle: (nextState: boolean) => void;
  isLoading?: boolean;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const StockToggleSwitch: React.FC<StockToggleSwitchProps> = ({
  isInStock,
  onToggle,
  isLoading = false,
  size = 'md',
  disabled = false,
  className,
  ariaLabel,
}) => {
  const isSm = size === 'sm';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isInStock}
      aria-label={ariaLabel || (isInStock ? 'Mark as Out of Stock' : 'Mark as In Stock')}
      disabled={disabled || isLoading}
      onClick={() => onToggle(!isInStock)}
      className={cn(
        'group relative inline-flex items-center justify-between rounded-full transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500/40 select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0',
        isSm
          ? 'h-6.5 w-[86px] p-0.5 text-[10px] font-semibold'
          : 'h-8 w-[102px] p-1 text-xs font-semibold shadow-xs',
        isInStock
          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
          : 'bg-rose-600 hover:bg-rose-700 text-white',
        className
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out shrink-0',
          isSm ? 'h-5 w-5' : 'h-6 w-6',
          isInStock
            ? isSm
              ? 'translate-x-[62px] text-emerald-600'
              : 'translate-x-[70px] text-emerald-600'
            : 'translate-x-0 text-rose-600'
        )}
      >
        {isLoading ? (
          <span
            className={cn(
              'animate-spin rounded-full border-2 border-slate-300 border-t-slate-700',
              isSm ? 'h-3 w-3' : 'h-3.5 w-3.5'
            )}
          />
        ) : isInStock ? (
          <Check className={cn(isSm ? 'h-3 w-3' : 'h-3.5 w-3.5', 'stroke-[2.5]')} />
        ) : (
          <X className={cn(isSm ? 'h-3 w-3' : 'h-3.5 w-3.5', 'stroke-[2.5]')} />
        )}
      </span>

      <span
        className={cn(
          'absolute transition-opacity duration-150 leading-none select-none font-bold tracking-tight',
          isInStock
            ? isSm
              ? 'left-2.5 text-[10px] text-white'
              : 'left-3 text-[11px] text-white'
            : isSm
            ? 'right-2.5 text-[10px] text-white'
            : 'right-3 text-[11px] text-white'
        )}
      >
        {isInStock ? 'In Stock' : 'Sold Out'}
      </span>
    </button>
  );
};
