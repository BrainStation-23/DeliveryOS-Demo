import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon | React.ReactNode;
  badge?: React.ReactNode;
  /** Leading affordance rendered left of the title (e.g. a back button). */
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  description,
  icon,
  badge,
  leading,
  actions,
  children,
  className,
}) => {
  const subText = subtitle || description;
  const actionSlot = actions || children;

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return <div className="shrink-0">{icon}</div>;
    }
    const IconComp = icon as LucideIcon;
    return <IconComp className="h-6 w-6 text-primary-600 dark:text-primary-400 shrink-0" />;
  };

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex items-start gap-2 min-w-0">
        {leading && <div className="shrink-0 pt-0.5">{leading}</div>}
        <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          {renderIcon()}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
            {title}
          </h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {subText && (
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {subText}
          </p>
        )}
        </div>
      </div>

      {actionSlot && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
          {actionSlot}
        </div>
      )}
    </div>
  );
};
