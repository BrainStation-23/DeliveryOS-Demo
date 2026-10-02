import React, { useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import adminApi from '../../services/adminApi';
import { Alert } from '../../components/ui/Alert';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { extractApiError } from '../../utils/apiError';
import { OrderFlowSettingsCard, DispatchTimingConfig } from '../../components/settings/OrderFlowSettingsCard';
import { DeliveryFeeSettingsCard, DeliveryFeeConfig } from '../../components/settings/DeliveryFeeSettingsCard';
import { DeliveryEconomicsSettingsCard } from '../../components/settings/DeliveryEconomicsSettingsCard';

export const AdminSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const legacyTab = searchParams.get('tab');

  // Seamless redirect if user hits legacy financial tabs on settings URL
  if (legacyTab === 'settlements' || legacyTab === 'deposits') {
    return <Navigate to={`/finance?tab=${legacyTab}`} replace />;
  }

  const [actionError, setActionError] = useState<string | null>(null);

  // Settings query (dispatch mode, delivery fee, delivery economics)
  const {
    data: settings,
    isError: isSettingsError,
    error: settingsError,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminApi.getSettings,
  });

  const invalidateSettings = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
  };

  const updateOrderFlowMutation = useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.updateOrderFlow>[0]) => adminApi.updateOrderFlow(payload),
    onSuccess: invalidateSettings,
    onError: (err) => setActionError(extractApiError(err, 'Failed to update order flow settings.')),
  });

  const updateDeliveryFeeMutation = useMutation({
    mutationFn: (data: DeliveryFeeConfig) => adminApi.updateDeliveryFeeMode(data),
    onSuccess: invalidateSettings,
    onError: (err) => setActionError(extractApiError(err, 'Failed to update delivery fee settings.')),
  });

  const updateEconomicsMutation = useMutation({
    mutationFn: (data: Parameters<typeof adminApi.updateDeliveryEconomics>[0]) =>
      adminApi.updateDeliveryEconomics(data),
    onSuccess: invalidateSettings,
    onError: (err) => setActionError(extractApiError(err, 'Failed to update delivery economics.')),
  });

  const currentFlowMode = settings?.orderFlow?.mode || 'RIDER_FIRST';
  const timing: DispatchTimingConfig | null = settings?.orderFlow
    ? {
        riderSearchTimeoutSeconds: settings.orderFlow.rider_search_timeout_seconds ?? 90,
        staleOrderTtlMinutes: settings.orderFlow.stale_order_ttl_minutes ?? 60,
      }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings & Dispatch Configuration"
        subtitle="Configure real-time dispatch state machines, delivery fee and payout economics, and pipeline timing"
        icon={Settings}
      />

      {actionError && (
        <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} />
      )}

      {isSettingsError && (
        <QueryErrorBanner error={settingsError} onRetry={() => refetchSettings()} />
      )}

      <div className="space-y-6">
        <OrderFlowSettingsCard
          currentMode={currentFlowMode}
          timing={timing}
          isUpdating={updateOrderFlowMutation.isPending}
          onUpdateMode={(mode) => updateOrderFlowMutation.mutate({ mode })}
          onUpdateTiming={(next) => updateOrderFlowMutation.mutate({ mode: currentFlowMode, ...next })}
        />

        <DeliveryFeeSettingsCard
          initialConfig={settings?.deliveryFee}
          isSaving={updateDeliveryFeeMutation.isPending}
          onSave={(data) => updateDeliveryFeeMutation.mutate(data)}
        />

        <DeliveryEconomicsSettingsCard
          initialConfig={settings?.deliveryEconomics ?? null}
          isSaving={updateEconomicsMutation.isPending}
          onSave={(config) =>
            updateEconomicsMutation.mutate({
              riderSharePercent: config.rider_share_percent,
              etaAvgSpeedKmh: config.eta_avg_speed_kmh,
              etaFallbackMinutes: config.eta_fallback_minutes,
            })
          }
        />
      </div>
    </div>
  );
};
