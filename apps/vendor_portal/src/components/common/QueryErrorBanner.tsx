import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { extractApiError } from '../../utils/apiError';

interface QueryErrorBannerProps {
  error: unknown;
  onRetry?: () => void;
}

/** Rendered when a data query fails — failures must never look like empty data. */
export const QueryErrorBanner: React.FC<QueryErrorBannerProps> = ({ error, onRetry }) => {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs sm:text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 shadow-xs"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" />
      <span className="flex-1 font-medium">{extractApiError(error)}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/50 transition-colors shadow-xs shrink-0 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('kds.retryNow')}
        </button>
      )}
    </div>
  );
};
