import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
  icon?: LucideIcon | React.ReactNode;
  iconColorClass?: string;
  iconBgColor?: string;
  iconTextColor?: string;
  valueColor?: string;
  onClick?: () => void;
  active?: boolean;
  isLoading?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconColorClass,
  iconBgColor,
  iconTextColor,
  valueColor,
  onClick,
  active,
  isLoading,
  className,
}) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComp = icon as LucideIcon;
    return <IconComp className="h-4 w-4 sm:h-5 sm:w-5" />;
  };

  const computedIconContainer =
    iconColorClass ||
    (iconBgColor && iconTextColor
      ? cn(iconBgColor, iconTextColor)
      : 'text-primary-600 bg-primary-50 dark:bg-primary-950/50 dark:text-primary-400');

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900',
        onClick && 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700',
        active && 'border-amber-500 bg-amber-50/20 ring-1 ring-amber-500',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
          {title}
        </span>
        {icon && (
          <div className={cn('rounded-lg p-1.5 shrink-0', computedIconContainer)}>
            {renderIcon()}
          </div>
        )}
      </div>
      <div className="mt-2">
        <div
          className={cn(
            'text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate',
            valueColor
          )}
        >
          {isLoading ? '...' : value}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
