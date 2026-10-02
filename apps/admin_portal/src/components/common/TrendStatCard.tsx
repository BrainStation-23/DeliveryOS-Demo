import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { StatCard } from './StatCard';
import { cn } from '../../utils/cn';
import { buildTrendBadge } from '../../pages/admin/components/dashboard/dashboardAnalytics';

export interface TrendStatCardProps {
  title: string;
  value: string | number;
  delta: number | null;
  /** true when a rising value is bad (cancellations, delivery minutes). */
  deltaInverted?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  iconColorClass?: string;
  subtitle?: string;
  isLoading?: boolean;
}

/** StatCard with a vs-previous-window trend badge (green = good direction). */
export const TrendStatCard: React.FC<TrendStatCardProps> = ({
  title,
  value,
  delta,
  deltaInverted = false,
  icon,
  iconColorClass,
  subtitle,
  isLoading,
}) => {
  const badge = buildTrendBadge(delta, deltaInverted);
  const isPositiveTone = badge.invertTone ? badge.direction === 'down' : badge.direction === 'up';
  const isNegativeTone = badge.invertTone ? badge.direction === 'up' : badge.direction === 'down';

  const TrendIcon =
    badge.direction === 'up' ? ArrowUpRight : badge.direction === 'down' ? ArrowDownRight : Minus;
  const Icon = icon;

  return (
    <StatCard
      title={title}
      value={value}
      icon={Icon ? <Icon className="h-4 w-4 sm:h-5 sm:w-5" /> : undefined}
      iconColorClass={iconColorClass}
      isLoading={isLoading}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          {badge.direction !== 'unknown' && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                isPositiveTone && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
                isNegativeTone && 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400',
                badge.direction === 'flat' && 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {badge.label}
            </span>
          )}
          {subtitle && <span className="hidden sm:inline">{subtitle}</span>}
        </span>
      }
    />
  );
};
