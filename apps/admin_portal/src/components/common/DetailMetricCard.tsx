import React, { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface DetailMetricCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  subtext?: ReactNode;
  valueClassName?: string;
  className?: string;
}

export const DetailMetricCard: React.FC<DetailMetricCardProps> = ({
  label,
  value,
  icon,
  subtext,
  valueClassName,
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        {icon}
      </div>
      <p
        className={cn(
          'mt-1.5 text-lg font-bold text-slate-900 dark:text-slate-100',
          valueClassName,
        )}
      >
        {value}
      </p>
      {subtext && <p className="text-[11px] text-slate-500 mt-0.5">{subtext}</p>}
    </div>
  );
};
