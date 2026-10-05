import React from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, PauseCircle, PlayCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { useRushPause } from '../../../../hooks/useRushPause';

interface RushHourPauseWidgetProps {
  outletId: string;
  outletName: string;
  isBusy: boolean;
  onSuccess?: () => void;
}

export const RushHourPauseWidget: React.FC<RushHourPauseWidgetProps> = ({
  outletId,
  outletName,
  isBusy: initialBusy,
}) => {
  const { t } = useTranslation();
  const { isBusy: liveBusy, isTogglingRush, toggleRushPause, canToggle } = useRushPause(outletId);

  // Fall back to prop if hook hasn't loaded target outlet yet
  const isCurrentlyBusy = liveBusy ?? initialBusy;

  return (
    <div
      className={`rounded-xl border p-3.5 sm:p-5 transition-all shadow-sm ${
        isCurrentlyBusy
          ? 'border-amber-400 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('settings.orderIntakeTitle', { defaultValue: 'Store Order Intake (Active / Inactive)' })}
            </h3>
            {isCurrentlyBusy ? (
              <Badge variant="warning" size="sm" className="font-bold animate-pulse">
                <AlertTriangle className="h-3 w-3 mr-1 text-amber-700 dark:text-amber-300" />
                {t('settings.intakeInactive', { defaultValue: 'Inactive' })}
              </Badge>
            ) : (
              <Badge variant="success" size="sm" className="font-semibold">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t('settings.intakeActive', { defaultValue: 'Active' })}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('settings.orderIntakeSubtitle', {
              defaultValue:
                'Configure whether new customer orders proceed to this outlet. Set to Inactive during rush periods to halt incoming orders.',
            })}
          </p>
        </div>

        <div className="shrink-0">
          {isCurrentlyBusy ? (
            <Button
              variant="success"
              size="md"
              className="shadow-sm font-semibold"
              onClick={() => toggleRushPause(false)}
              disabled={!canToggle || isTogglingRush}
              isLoading={isTogglingRush}
              leftIcon={<PlayCircle className="h-4 w-4" />}
            >
              {t('settings.setActive', { defaultValue: 'Set Active' })}
            </Button>
          ) : (
            <Button
              variant="danger"
              size="md"
              className="shadow-sm font-semibold"
              onClick={() => toggleRushPause(true)}
              disabled={!canToggle || isTogglingRush}
              isLoading={isTogglingRush}
              leftIcon={<PauseCircle className="h-4 w-4" />}
            >
              {t('settings.setInactive', { defaultValue: 'Set Inactive' })}
            </Button>
          )}
        </div>
      </div>

      {isCurrentlyBusy ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-amber-100/70 p-3 text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-xs text-amber-950 dark:text-amber-100">
              {t('outlet.orderIntakeInactiveBanner', {
                name: outletName,
                defaultValue: `Order Intake Inactive: New customer orders will not proceed for ${outletName}.`,
              })}
            </p>
            <p className="text-[11px] text-amber-900/90 dark:text-amber-300">
              {t('settings.intakeInactiveWarning', {
                defaultValue:
                  "Order intake is currently Inactive for this outlet. New customer orders will not proceed. Tap 'Set Active' to resume incoming orders.",
              })}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {t('settings.intakeActiveNotice', {
              defaultValue: 'Store order intake is Active and receiving live orders normally.',
            })}
          </span>
        </div>
      )}
    </div>
  );
};
