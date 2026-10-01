import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, CalendarDays, X } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';

export type DatePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'THIS_MONTH'
  | 'ALL_TIME'
  | 'CUSTOM';

interface OrderDateFilterToolbarProps {
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  customStartDate: string;
  onCustomStartDateChange: (val: string) => void;
  customEndDate: string;
  onCustomEndDateChange: (val: string) => void;
  onClearCustomDates: () => void;
}

export const OrderDateFilterToolbar: React.FC<OrderDateFilterToolbarProps> = ({
  datePreset,
  onDatePresetChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  onClearCustomDates,
}) => {
  const { t } = useTranslation();

  const presets = [
    { id: 'TODAY' as const, label: t('orders.dateFilters.today'), icon: Calendar },
    { id: 'YESTERDAY' as const, label: t('orders.dateFilters.yesterday'), icon: Calendar },
    { id: 'LAST_7_DAYS' as const, label: t('orders.dateFilters.last7Days'), icon: CalendarDays },
    { id: 'THIS_MONTH' as const, label: t('orders.dateFilters.thisMonth'), icon: CalendarDays },
    { id: 'ALL_TIME' as const, label: t('orders.dateFilters.allTime'), icon: CalendarDays },
    { id: 'CUSTOM' as const, label: t('orders.dateFilters.custom'), icon: Calendar },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Calendar className="h-4 w-4 text-amber-500 shrink-0" />
          <span>{t('orders.dateFilters.label')}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map((preset) => {
            const Icon = preset.icon;
            const isSelected = datePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onDatePresetChange(preset.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-xs font-semibold transition-all h-8 select-none cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {datePreset === 'CUSTOM' && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">
              {t('orders.dateFilters.startDate')}:
            </span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => onCustomStartDateChange(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-2xs focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">
              {t('orders.dateFilters.endDate')}:
            </span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => onCustomEndDateChange(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-2xs focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          {(customStartDate || customEndDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearCustomDates}
              leftIcon={<X className="h-3.5 w-3.5" />}
            >
              {t('orders.dateFilters.clearRange')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
