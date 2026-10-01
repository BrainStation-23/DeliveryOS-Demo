import React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  onDismiss,
  className,
}) => {
  const styles = {
    info: {
      container: 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-200',
      icon: <Info className="w-4 h-4 mt-0.5 text-sky-600 dark:text-sky-400 shrink-0" />,
    },
    success: {
      container: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200',
      icon: <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200',
      icon: <TriangleAlert className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />,
    },
    error: {
      container: 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200',
      icon: <AlertCircle className="w-4 h-4 mt-0.5 text-rose-600 dark:text-rose-400 shrink-0" />,
    },
  };

  const current = styles[type];

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 p-3 sm:p-3.5 rounded-xl border transition-all text-xs sm:text-sm',
        current.container,
        className
      )}
      role="alert"
    >
      {current.icon}
      <div className="flex-1 min-w-0">
        {title && <h5 className="font-semibold mb-0.5">{title}</h5>}
        <div className="opacity-90 leading-relaxed">{message}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
