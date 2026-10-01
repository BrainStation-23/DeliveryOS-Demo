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
        'group relative inline-flex items-center justify-between rounded-full transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500/30 select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        isSm
          ? 'h-6 min-w-[76px] px-1 text-[10px] font-semibold'
          : 'h-7.5 min-w-[88px] px-1 text-xs font-semibold shadow-xs',
        isInStock
          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
          : 'bg-rose-600 hover:bg-rose-700 text-white',
        className
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out shrink-0',
          isSm ? 'h-4 w-4' : 'h-5.5 w-5.5',
          isInStock
            ? isSm
              ? 'translate-x-[52px] text-emerald-600'
              : 'translate-x-[60px] text-emerald-600'
            : 'translate-x-0 text-rose-600'
        )}
      >
        {isLoading ? (
          <span
            className={cn(
              'animate-spin rounded-full border-2 border-slate-300 border-t-slate-700',
              isSm ? 'h-2.5 w-2.5' : 'h-3 w-3'
            )}
          />
        ) : isInStock ? (
          <Check className={cn(isSm ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        ) : (
          <X className={cn(isSm ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        )}
      </span>

      <span
        className={cn(
          'absolute transition-opacity duration-150 leading-none select-none font-medium',
          isInStock
            ? isSm
              ? 'left-2 text-white'
              : 'left-2.5 text-white'
            : isSm
            ? 'right-2 text-white'
            : 'right-2.5 text-white'
        )}
      >
        {isInStock ? 'In Stock' : 'Sold Out'}
      </span>
    </button>
  );
};
