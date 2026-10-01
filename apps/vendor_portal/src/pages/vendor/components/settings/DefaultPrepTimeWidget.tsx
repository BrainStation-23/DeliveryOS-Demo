import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Save, Check } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { cn } from '../../../../utils/cn';

interface DefaultPrepTimeWidgetProps {
  initialMinutes: number;
  onSave: (minutes: number) => Promise<void> | void;
  isLoading?: boolean;
}

const PRESET_OPTIONS = [15, 20, 25, 30, 45, 60];

export const DefaultPrepTimeWidget: React.FC<DefaultPrepTimeWidgetProps> = ({
  initialMinutes,
  onSave,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [selectedMinutes, setSelectedMinutes] = useState<number>(initialMinutes || 20);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (initialMinutes) {
      setSelectedMinutes(initialMinutes);
    }
  }, [initialMinutes]);

  const handleSave = async () => {
    await onSave(selectedMinutes);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  const hasChanged = selectedMinutes !== initialMinutes;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('settings.defaultPrepDuration')}
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('settings.defaultPrepDurationSub')}
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          className="shadow-xs font-semibold self-start sm:self-auto shrink-0"
          onClick={handleSave}
          disabled={!hasChanged || isLoading}
          isLoading={isLoading}
          leftIcon={justSaved ? <Check className="h-3.5 w-3.5 text-white" /> : <Save className="h-3.5 w-3.5" />}
        >
          {justSaved ? t('settings.savedSuccess') : t('settings.saveDuration')}
        </Button>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {PRESET_OPTIONS.map((mins) => {
          const isSelected = selectedMinutes === mins;
          return (
            <button
              key={mins}
              type="button"
              onClick={() => setSelectedMinutes(mins)}
              className={cn(
                'h-9 px-3.5 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer border shadow-xs',
                isSelected
                  ? 'bg-amber-500 text-white border-amber-600 dark:bg-amber-500 dark:border-amber-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700'
              )}
            >
              {t('settings.minutes', { count: mins })}
            </button>
          );
        })}
      </div>
    </div>
  );
};
