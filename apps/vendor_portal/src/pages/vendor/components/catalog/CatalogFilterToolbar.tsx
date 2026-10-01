import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, CheckCircle2, XCircle, X } from 'lucide-react';
import { Input } from '../../../../components/ui/Input';

export type StockFilterType = 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK';

interface CatalogFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  stockFilter: StockFilterType;
  onStockFilterChange: (filter: StockFilterType) => void;
  totalItems: number;
  inStockCount: number;
  outOfStockCount: number;
}

export const CatalogFilterToolbar: React.FC<CatalogFilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  stockFilter,
  onStockFilterChange,
  totalItems,
  inStockCount,
  outOfStockCount,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="relative w-full sm:max-w-md">
        <Input
          placeholder={t('catalog.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<Search className="h-4 w-4 text-slate-400" />}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={t('common.clear')}
            aria-label={t('common.clear')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Stock Status Filter Buttons */}
      <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0 bg-slate-100 p-1.5 rounded-xl border border-slate-200 dark:bg-slate-800/80 dark:border-slate-700/80">
        <button
          type="button"
          onClick={() => onStockFilterChange('ALL')}
          className={`inline-flex items-center gap-2 h-9 px-3.5 sm:px-4 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer ${
            stockFilter === 'ALL'
              ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span>{t('catalog.allItems')}</span>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              stockFilter === 'ALL'
                ? 'bg-slate-100 text-slate-800 dark:bg-slate-600 dark:text-slate-100'
                : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {totalItems}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onStockFilterChange('IN_STOCK')}
          className={`inline-flex items-center gap-2 h-9 px-3.5 sm:px-4 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer ${
            stockFilter === 'IN_STOCK'
              ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-700 dark:text-emerald-400'
              : 'text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{t('catalog.inStock')}</span>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              stockFilter === 'IN_STOCK'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {inStockCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onStockFilterChange('OUT_OF_STOCK')}
          className={`inline-flex items-center gap-2 h-9 px-3.5 sm:px-4 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer ${
            stockFilter === 'OUT_OF_STOCK'
              ? 'bg-white text-rose-700 shadow-xs dark:bg-slate-700 dark:text-rose-400'
              : 'text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400'
          }`}
        >
          <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
          <span>{t('catalog.soldOut')}</span>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              stockFilter === 'OUT_OF_STOCK'
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {outOfStockCount}
          </span>
        </button>
      </div>
    </div>
  );
};
