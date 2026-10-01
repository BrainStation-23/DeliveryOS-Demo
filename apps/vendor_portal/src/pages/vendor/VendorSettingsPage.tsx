import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Store, RefreshCw } from 'lucide-react';
import { useVendorOutlet } from '../../contexts/VendorOutletContext';
import kdsApi from '../../services/kdsApi';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { RushHourPauseWidget } from './components/settings/RushHourPauseWidget';
import { DefaultPrepTimeWidget } from './components/settings/DefaultPrepTimeWidget';
import { OperatingHoursWidget, DayOperatingHours } from './components/settings/OperatingHoursWidget';
import { OutletProfileWidget } from './components/settings/OutletProfileWidget';

export const VendorSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeOutletId, activeOutlet, outlets, setActiveOutletId, refetchOutlets } = useVendorOutlet();

  const [selectedOutletOverride, setSelectedOutletOverride] = useState<string | null>(null);

  // Determine effective outlet ID
  const effectiveOutletId =
    selectedOutletOverride ||
    (activeOutletId !== 'ALL' ? activeOutletId : outlets[0]?.id || '');

  const {
    data: settings,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['vendor-settings', effectiveOutletId],
    queryFn: () => kdsApi.getOutletSettings(effectiveOutletId),
    enabled: !!effectiveOutletId,
  });

  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Mutation for default prep duration & general outlet settings
  const updateSettingsMutation = useMutation({
    mutationFn: (data: { defaultPrepTimeMinutes?: number; isBusy?: boolean }) =>
      kdsApi.updateOutletSettings(effectiveOutletId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-settings'] });
      refetchOutlets();
      setFeedbackMsg({
        type: 'success',
        text: t('settings.settingsUpdated'),
      });
    },
    onError: () => {
      setFeedbackMsg({
        type: 'error',
        text: t('settings.settingsUpdateFailed'),
      });
    },
  });

  // Mutation for weekly operating schedule
  const updateHoursMutation = useMutation({
    mutationFn: (hours: DayOperatingHours[]) =>
      kdsApi.updateOperatingHours(effectiveOutletId, hours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-settings'] });
      setFeedbackMsg({
        type: 'success',
        text: t('settings.savedSuccess'),
      });
    },
    onError: () => {
      setFeedbackMsg({
        type: 'error',
        text: t('settings.saveFailed'),
      });
    },
  });

  const handleSavePrepTime = async (minutes: number) => {
    await updateSettingsMutation.mutateAsync({ defaultPrepTimeMinutes: minutes });
  };

  const handleSaveHours = async (hours: DayOperatingHours[]) => {
    await updateHoursMutation.mutateAsync(hours);
  };

  const handleSelectOutlet = (newId: string) => {
    setSelectedOutletOverride(newId);
    if (activeOutletId !== 'ALL') {
      setActiveOutletId(newId);
    }
  };

  if (isLoading && !settings) {
    return (
      <div className="py-20">
        <LoadingSpinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  const currentOutletName =
    settings?.name || activeOutlet?.name || outlets.find((o) => o.id === effectiveOutletId)?.name || t('outlet.primaryStore');

  // Build full 7-day schedule map with safe defaults
  const hoursMap = new Map(settings?.operatingHours?.map((h) => [h.dayOfWeek, h]) || []);
  const fullWeekHours: DayOperatingHours[] = [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const existing = hoursMap.get(day);
    return {
      dayOfWeek: day,
      openTime: existing?.openTime || '09:00:00',
      closeTime: existing?.closeTime || '22:00:00',
      isClosed: existing ? existing.isClosed : false,
    };
  });

  return (
    <div className="max-w-5xl space-y-4 sm:space-y-5">
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description', { outlet: currentOutletName })}
        icon={<Store className="h-5 w-5 text-amber-500" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isRefetching}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            {t('common.refresh')}
          </Button>
        }
      />

      {feedbackMsg && (
        <Alert
          type={feedbackMsg.type}
          message={feedbackMsg.text}
          onDismiss={() => setFeedbackMsg(null)}
        />
      )}

      {/* Grid Layout: Profile & Operational Control */}
      <div className="space-y-4 sm:space-y-5">
        {/* Outlet Identity & Multi-Branch Switcher */}
        {settings && (
          <OutletProfileWidget
            outlet={settings}
            outlets={outlets}
            activeOutletId={effectiveOutletId}
            onSelectOutlet={handleSelectOutlet}
          />
        )}

        {/* Rush Hour Pause Widget (Synced with Topbar) */}
        <RushHourPauseWidget
          outletId={effectiveOutletId}
          outletName={currentOutletName}
          isBusy={settings?.isBusy ?? activeOutlet?.isBusy ?? false}
        />

        {/* Default Preparation Time Duration */}
        <DefaultPrepTimeWidget
          initialMinutes={settings?.defaultPrepTimeMinutes || 20}
          onSave={handleSavePrepTime}
          isLoading={updateSettingsMutation.isPending}
        />

        {/* Weekly Operating Hours Schedule */}
        <OperatingHoursWidget
          initialHours={fullWeekHours}
          onSave={handleSaveHours}
          isLoading={updateHoursMutation.isPending}
        />
      </div>
    </div>
  );
};
