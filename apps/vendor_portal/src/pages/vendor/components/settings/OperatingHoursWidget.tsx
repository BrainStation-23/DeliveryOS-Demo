import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Save, Copy, Check } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { cn } from '../../../../utils/cn';

export interface DayOperatingHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

interface OperatingHoursWidgetProps {
  initialHours: DayOperatingHours[];
  onSave: (hours: DayOperatingHours[]) => Promise<void> | void;
  isLoading?: boolean;
}

export const OperatingHoursWidget: React.FC<OperatingHoursWidgetProps> = ({
  initialHours,
  onSave,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [hours, setHours] = useState<DayOperatingHours[]>(initialHours);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (initialHours && initialHours.length > 0) {
      setHours(initialHours);
    }
  }, [initialHours]);

  const handleApplyFirstDayToAll = () => {
    if (hours.length === 0) return;
    const template = hours[0];
    const updated = hours.map((h) => ({
      ...h,
      openTime: template.openTime,
      closeTime: template.closeTime,
      isClosed: template.isClosed,
    }));
    setHours(updated);
  };

  const handleSave = async () => {
    await onSave(hours);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  // Find today's day of week (0 = Sunday)
  const todayDayOfWeek = new Date().getDay();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('settings.weeklySchedule')}
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('settings.weeklyScheduleSub')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleApplyFirstDayToAll}
            leftIcon={<Copy className="h-3 w-3" />}
            title="Copy first day hours to all days"
          >
            Copy To All
          </Button>

          <Button
            variant="primary"
            size="md"
            className="shadow-xs font-semibold"
            onClick={handleSave}
            isLoading={isLoading}
            leftIcon={justSaved ? <Check className="h-3.5 w-3.5 text-white" /> : <Save className="h-3.5 w-3.5" />}
          >
            {justSaved ? t('settings.savedSuccess') : t('settings.saveSchedule')}
          </Button>
        </div>
      </div>

      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/80">
        {hours.map((h, index) => {
          const isToday = h.dayOfWeek === todayDayOfWeek;
          return (
            <div
              key={h.dayOfWeek}
              className={cn(
                'flex flex-col sm:flex-row sm:items-center justify-between py-2.5 text-xs gap-2 sm:gap-3 transition-colors rounded-lg px-2 -mx-2',
                isToday && 'bg-amber-50/50 dark:bg-amber-950/20'
              )}
            >
              <div className="flex items-center gap-2 w-32">
                <span
                  className={cn(
                    'font-bold text-xs',
                    isToday ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'
                  )}
                >
                  {t(`settings.days.${h.dayOfWeek}`)}
                </span>
                {isToday && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Today
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 text-[11px] font-medium">{t('settings.opens')}</span>
                  <input
                    type="time"
                    value={h.openTime.slice(0, 5)}
                    disabled={h.isClosed}
                    onChange={(e) => {
                      const newHours = [...hours];
                      newHours[index].openTime = `${e.target.value}:00`;
                      setHours(newHours);
                    }}
                    className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-40 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 text-[11px] font-medium">{t('settings.closes')}</span>
                  <input
                    type="time"
                    value={h.closeTime.slice(0, 5)}
                    disabled={h.isClosed}
                    onChange={(e) => {
                      const newHours = [...hours];
                      newHours[index].closeTime = `${e.target.value}:00`;
                      setHours(newHours);
                    }}
                    className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-40 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={h.isClosed}
                    onChange={(e) => {
                      const newHours = [...hours];
                      newHours[index].isClosed = e.target.checked;
                      setHours(newHours);
                    }}
                    className="h-4 w-4 rounded-md border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span
                    className={cn(
                      'font-semibold text-xs',
                      h.isClosed ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                    )}
                  >
                    {t('settings.closed')}
                  </span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
