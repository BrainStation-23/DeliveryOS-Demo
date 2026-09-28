import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { extractApiError } from '../../utils/apiError';

interface QueryErrorBannerProps {
  error: unknown;
  onRetry?: () => void;
}

/** Rendered when a data query fails — failures must never look like empty data. */
export const QueryErrorBanner: React.FC<QueryErrorBannerProps> = ({ error, onRetry }) => (
  <div
    role="alert"
    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800"
  >
    <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" />
    <span className="flex-1">Failed to load data: {extractApiError(error)}</span>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
    )}
  </div>
);
