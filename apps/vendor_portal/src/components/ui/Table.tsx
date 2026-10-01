import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (item: T) => void;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage,
  className,
  onRowClick,
  page,
  totalPages,
  totalItems,
  onPageChange,
}: TableProps<T>) {
  const { t } = useTranslation();
  const safeData = Array.isArray(data) ? data : [];
  const displayEmptyMessage = emptyMessage || t('common.empty');

  return (
    <div className={cn('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900', className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full w-full text-left text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] uppercase font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn('px-4 sm:px-5 py-3 whitespace-nowrap', col.headerClassName)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-primary-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t('common.loading')}</span>
                  </div>
                </td>
              </tr>
            ) : safeData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                  {displayEmptyMessage}
                </td>
              </tr>
            ) : (
              safeData.map((item, index) => (
                <tr
                  key={keyExtractor(item, index)}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={cn(
                    'transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 sm:px-5 py-3 whitespace-nowrap', col.className)}>
                      {col.render
                        ? col.render(item, index)
                        : (item as Record<string, unknown>)[col.key]?.toString() ?? '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages !== undefined && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 sm:px-6 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 gap-2">
          <div>
            {totalItems !== undefined && <span>{t('common.showing')} {totalItems} {t('common.results')}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange && onPageChange((page || 1) - 1)}
              disabled={(page || 1) <= 1}
              className="h-8 px-3 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
            >
              {t('common.previous')}
            </button>
            <span className="font-semibold text-slate-700 dark:text-slate-200 px-1">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange && onPageChange((page || 1) + 1)}
              disabled={(page || 1) >= totalPages}
              className="h-8 px-3 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
