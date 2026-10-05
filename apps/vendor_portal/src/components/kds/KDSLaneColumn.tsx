import React from 'react';
import { Badge, BadgeVariant } from '../ui/Badge';
import { cn } from '../../utils/cn';

interface KDSLaneColumnProps {
  title: string;
  count: number;
  colorVariant: 'rose' | 'amber' | 'emerald';
  badgeVariant: BadgeVariant;
  headerIcon?: React.ReactNode;
  hasPing?: boolean;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptySubtitle: string;
  isVisibleOnMobile: boolean;
  children: React.ReactNode;
}

const themeStyles = {
  rose: {
    container: 'border-rose-200/80 bg-rose-50/25 dark:border-rose-950/60 dark:bg-rose-950/10',
    headerBorder: 'border-rose-200/60 dark:border-rose-900/40',
    title: 'text-rose-950 dark:text-rose-200',
    emptyIconBg: 'bg-rose-100 dark:bg-rose-950/50 text-rose-500',
  },
  amber: {
    container: 'border-amber-200/80 bg-amber-50/25 dark:border-amber-950/60 dark:bg-amber-950/10',
    headerBorder: 'border-amber-200/60 dark:border-amber-900/40',
    title: 'text-amber-950 dark:text-amber-200',
    emptyIconBg: 'bg-amber-100 dark:bg-amber-950/50 text-amber-600',
  },
  emerald: {
    container: 'border-emerald-200/80 bg-emerald-50/25 dark:border-emerald-950/60 dark:bg-emerald-950/10',
    headerBorder: 'border-emerald-200/60 dark:border-emerald-900/40',
    title: 'text-emerald-950 dark:text-emerald-200',
    emptyIconBg: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600',
  },
};

export const KDSLaneColumn: React.FC<KDSLaneColumnProps> = ({
  title,
  count,
  colorVariant,
  badgeVariant,
  headerIcon,
  hasPing = false,
  emptyIcon,
  emptyTitle,
  emptySubtitle,
  isVisibleOnMobile,
  children,
}) => {
  const styles = themeStyles[colorVariant];

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border p-3.5 sm:p-4 shadow-sm shrink-0 md:shrink w-[88vw] sm:w-[360px] md:w-auto snap-center',
        styles.container,
        !isVisibleOnMobile && 'hidden md:flex'
      )}
    >
      <div className={cn('flex items-center justify-between border-b pb-2.5', styles.headerBorder)}>
        <div className="flex items-center gap-2">
          {hasPing ? (
            <span className="relative flex h-2.5 w-2.5">
              {count > 0 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              )}
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
          ) : (
            headerIcon
          )}
          <h3 className={cn('font-bold text-xs sm:text-sm', styles.title)}>{title}</h3>
        </div>
        <Badge variant={badgeVariant} size="sm" className="font-bold">
          {count}
        </Badge>
      </div>

      <div className="mt-3 flex-1 space-y-3 overflow-y-auto max-h-[calc(100dvh-230px)] pr-1">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center mb-2', styles.emptyIconBg)}>
              {emptyIcon}
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {emptyTitle}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5">{emptySubtitle}</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};
