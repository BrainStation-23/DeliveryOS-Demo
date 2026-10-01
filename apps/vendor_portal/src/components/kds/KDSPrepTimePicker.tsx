import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';

interface KDSPrepTimePickerProps {
  isOpen: boolean;
  selectedMinutes: number;
  onSelectMinutes: (minutes: number) => void;
  presetOptions?: number[];
}

export const KDSPrepTimePicker: React.FC<KDSPrepTimePickerProps> = ({
  isOpen,
  selectedMinutes,
  onSelectMinutes,
  presetOptions = [15, 20, 25, 35, 45],
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="flex flex-wrap items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs gap-1.5 dark:border-slate-700 dark:bg-slate-800">
      <span className="text-slate-600 dark:text-slate-300 font-semibold text-xs px-1">
        {t('kds.prep')}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {presetOptions.map((mins) => (
          <button
            key={mins}
            type="button"
            onClick={() => onSelectMinutes(mins)}
            className={cn(
              'h-6.5 px-2.5 rounded-md font-semibold text-xs transition-colors cursor-pointer',
              selectedMinutes === mins
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
            )}
          >
            {mins}m
          </button>
        ))}
      </div>
    </div>
  );
};
