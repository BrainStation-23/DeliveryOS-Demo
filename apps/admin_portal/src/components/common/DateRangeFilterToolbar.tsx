import React from 'react';
import { Calendar, CalendarDays, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { DatePreset } from '../../utils/dateRange';

export interface DateRangeFilterToolbarProps {
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  customStartDate: string;
  onCustomStartDateChange: (val: string) => void;
  customEndDate: string;
  onCustomEndDateChange: (val: string) => void;
  onClearCustomDates: () => void;
}

const PRESETS: Array<{ id: DatePreset; label: string; icon: typeof Calendar }> = [
  { id: 'TODAY', label: 'Today', icon: Calendar },
  { id: 'YESTERDAY', label: 'Yesterday', icon: Calendar },
  { id: 'LAST_7_DAYS', label: 'Last 7 Days', icon: CalendarDays },
  { id: 'THIS_MONTH', label: 'This Month', icon: CalendarDays },
  { id: 'ALL_TIME', label: 'All Time', icon: CalendarDays },
  { id: 'CUSTOM', label: 'Custom', icon: Calendar },
];

/** Unified date-window selector shared by the dashboard, order history,
 *  customer directory, and financial ledger filters. */
export const DateRangeFilterToolbar: React.FC<DateRangeFilterToolbarProps> = ({
  datePreset,
  onDatePresetChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  onClearCustomDates,
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
        <Calendar className="h-4 w-4 text-primary-600 shrink-0" />
        <span>Date Range</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isSelected = datePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onDatePresetChange(preset.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-xs font-semibold transition-all h-8 select-none cursor-pointer ${
                isSelected
                  ? 'bg-primary-600 text-white shadow-sm'
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
          <span className="text-slate-500 font-medium">Start Date:</span>
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => onCustomStartDateChange(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">End Date:</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => onCustomEndDateChange(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>

        {(customStartDate || customEndDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearCustomDates}
            leftIcon={<X className="h-3.5 w-3.5" />}
          >
            Clear Range
          </Button>
        )}
      </div>
    )}
  </div>
);
