import React from 'react';
import { useTranslation } from 'react-i18next';
import { Category } from '../../../../types/kds';

interface CategoryFilterBarProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  const { t } = useTranslation();

  return (
    <div className="border-y border-slate-100 dark:border-slate-800/80 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectCategory('ALL')}
          className={`inline-flex items-center gap-2 h-9 px-3.5 sm:px-4 rounded-xl text-xs font-semibold transition-all select-none cursor-pointer ${
            selectedCategory === 'ALL'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 shadow-xs'
          }`}
        >
          <span>{t('catalog.allCategories')}</span>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              selectedCategory === 'ALL'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {categories.length}
          </span>
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`inline-flex items-center gap-2 h-9 px-3.5 sm:px-4 rounded-xl text-xs font-semibold transition-all select-none cursor-pointer ${
                isSelected
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 shadow-xs'
              }`}
            >
              <span>{cat.name}</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {Array.isArray(cat.products) ? cat.products.length : 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
