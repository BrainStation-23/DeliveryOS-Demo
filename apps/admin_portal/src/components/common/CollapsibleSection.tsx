import React, { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  icon,
  badge,
  action,
  defaultOpen = true,
  children,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
        >
          {icon && <span className="text-slate-500 shrink-0">{icon}</span>}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {title}
              </h3>
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {action}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </button>
        </div>
      </div>

      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
};
