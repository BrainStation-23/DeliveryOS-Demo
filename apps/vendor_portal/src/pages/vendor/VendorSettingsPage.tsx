import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  PauseCircle,
  PlayCircle,
  Calendar,
  Save,
  Store,
  AlertTriangle,
} from 'lucide-react';
import { useVendorOutlet } from '../../contexts/VendorOutletContext';
import kdsApi from '../../services/kdsApi';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const VendorSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeOutletId, activeOutlet, outlets, refetchOutlets } = useVendorOutlet();

  const targetVendorId =
    activeOutletId !== 'ALL' ? activeOutletId : outlets[0]?.id || '';

  const { data: settings, isLoading } = useQuery({
    queryKey: ['vendor-settings', targetVendorId],
    queryFn: () => kdsApi.getOutletSettings(targetVendorId),
    enabled: !!targetVendorId,
  });

  const [defaultPrepTime, setDefaultPrepTime] = useState<number>(20);
  const [operatingHours, setOperatingHours] = useState<
    Array<{
      dayOfWeek: number;
      openTime: string;
      closeTime: string;
      isClosed: boolean;
    }>
  >([]);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (settings) {
      setDefaultPrepTime(settings.defaultPrepTimeMinutes || 20);

      const hoursMap = new Map(
        settings.operatingHours?.map((h) => [h.dayOfWeek, h]) || []
      );
      const fullWeek = [0, 1, 2, 3, 4, 5, 6].map((day) => {
        const existing = hoursMap.get(day);
        return {
          dayOfWeek: day,
          openTime: existing?.openTime || '09:00:00',
          closeTime: existing?.closeTime || '22:00:00',
          isClosed: existing ? existing.isClosed : false,
        };
      });
      setOperatingHours(fullWeek);
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data: { defaultPrepTimeMinutes?: number; isBusy?: boolean }) =>
      kdsApi.updateOutletSettings(targetVendorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-settings', targetVendorId] });
      refetchOutlets();
      setFeedbackMsg({
        type: 'success',
        text: 'Outlet settings updated successfully.',
      });
    },
    onError: () => {
      setFeedbackMsg({
        type: 'error',
        text: 'Failed to update outlet settings. Please try again.',
      });
    },
  });

  const updateHoursMutation = useMutation({
    mutationFn: (hours: typeof operatingHours) =>
      kdsApi.updateOperatingHours(targetVendorId, hours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-settings', targetVendorId] });
      setFeedbackMsg({
        type: 'success',
        text: 'Weekly operating schedule saved successfully.',
      });
    },
    onError: () => {
      setFeedbackMsg({
        type: 'error',
        text: 'Failed to save operating schedule.',
      });
    },
  });

  const handleToggleRushPause = (isBusy: boolean) => {
    updateSettingsMutation.mutate({ isBusy });
  };

  const handleSavePrepTime = () => {
    updateSettingsMutation.mutate({ defaultPrepTimeMinutes: defaultPrepTime });
  };

  const handleSaveHours = () => {
    updateHoursMutation.mutate(operatingHours);
  };

  if (isLoading) {
    return (
      <div className="py-20">
        <LoadingSpinner size="lg" label="Loading store operations & schedule..." />
      </div>
    );
  }

  const currentOutletName = activeOutlet?.name || settings?.name || 'Store Outlet';
  const isBusy = settings?.isBusy ?? false;

  return (
    <div className="max-w-4xl space-y-5 sm:space-y-6">
      <PageHeader
        title="Outlet Operations & Schedule"
        description={`Operational status, rush hour controls, and operating schedule for ${currentOutletName}`}
        icon={<Store className="h-5 w-5 text-amber-500" />}
      />

      {feedbackMsg && (
        <Alert
          type={feedbackMsg.type}
          message={feedbackMsg.text}
          onDismiss={() => setFeedbackMsg(null)}
        />
      )}

      {/* Rush Hour Pause Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Rush Hour Pause
              </h3>
              {isBusy ? (
                <Badge variant="danger" size="sm">
                  Paused
                </Badge>
              ) : (
                <Badge variant="success" size="sm">
                  Operational
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Temporarily block incoming checkout orders during extreme kitchen volume or breaks.
            </p>
          </div>

          <div>
            {isBusy ? (
              <Button
                variant="success"
                size="md"
                className="shadow-xs"
                onClick={() => handleToggleRushPause(false)}
                isLoading={updateSettingsMutation.isPending}
                leftIcon={<PlayCircle className="h-4 w-4" />}
              >
                Resume Store Orders
              </Button>
            ) : (
              <Button
                variant="danger"
                size="md"
                className="shadow-xs"
                onClick={() => handleToggleRushPause(true)}
                isLoading={updateSettingsMutation.isPending}
                leftIcon={<PauseCircle className="h-4 w-4" />}
              >
                Pause Incoming Orders
              </Button>
            )}
          </div>
        </div>

        {isBusy && (
          <div className="mt-3.5 flex items-center gap-2.5 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Orders are currently paused for this outlet. Customers are informed that the kitchen is busy. Tap <strong>Resume Store Orders</strong> to re-open.
            </span>
          </div>
        )}
      </div>

      {/* Default Preparation Time Duration */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Default Preparation Duration
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Standard prep time allocated upon single-click accept on the kitchen board.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={defaultPrepTime}
              onChange={(e) => setDefaultPrepTime(Number(e.target.value))}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-xs focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer"
            >
              {[15, 20, 25, 30, 45].map((m) => (
                <option
                  key={m}
                  value={m}
                  className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {m} minutes
                </option>
              ))}
            </select>

            <Button
              variant="primary"
              size="md"
              className="shadow-xs"
              onClick={handleSavePrepTime}
              isLoading={updateSettingsMutation.isPending}
              leftIcon={<Save className="h-3.5 w-3.5" />}
            >
              Save Duration
            </Button>
          </div>
        </div>
      </div>

      {/* Weekly Operating Schedule */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Weekly Operating Schedule
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Operating hours configuration across each day of the week.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            className="shadow-xs"
            onClick={handleSaveHours}
            isLoading={updateHoursMutation.isPending}
            leftIcon={<Save className="h-3.5 w-3.5" />}
          >
            Save Schedule
          </Button>
        </div>

        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/80">
          {operatingHours.map((h, index) => (
            <div
              key={h.dayOfWeek}
              className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 text-xs gap-2.5 sm:gap-3"
            >
              <span className="w-24 font-bold text-xs text-slate-900 dark:text-slate-100">
                {DAY_NAMES[h.dayOfWeek]}
              </span>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 text-[11px] font-medium">Opens:</span>
                  <input
                    type="time"
                    value={h.openTime.slice(0, 5)}
                    disabled={h.isClosed}
                    onChange={(e) => {
                      const newHours = [...operatingHours];
                      newHours[index].openTime = `${e.target.value}:00`;
                      setOperatingHours(newHours);
                    }}
                    className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-40"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 text-[11px] font-medium">Closes:</span>
                  <input
                    type="time"
                    value={h.closeTime.slice(0, 5)}
                    disabled={h.isClosed}
                    onChange={(e) => {
                      const newHours = [...operatingHours];
                      newHours[index].closeTime = `${e.target.value}:00`;
                      setOperatingHours(newHours);
                    }}
                    className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-40"
                  />
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={h.isClosed}
                    onChange={(e) => {
                      const newHours = [...operatingHours];
                      newHours[index].isClosed = e.target.checked;
                      setOperatingHours(newHours);
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span
                    className={
                      h.isClosed
                        ? 'font-bold text-rose-600 text-xs'
                        : 'text-slate-600 dark:text-slate-400 font-medium text-xs'
                    }
                  >
                    Closed
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
