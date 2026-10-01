import React, { useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import adminApi from '../../services/adminApi';
import { Alert } from '../../components/ui/Alert';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { extractApiError } from '../../utils/apiError';
import { OrderFlowSettingsCard } from '../../components/settings/OrderFlowSettingsCard';
import { DeliveryFeeSettingsCard, DeliveryFeeConfig } from '../../components/settings/DeliveryFeeSettingsCard';

export const AdminSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const legacyTab = searchParams.get('tab');

  // Seamless redirect if user hits legacy financial tabs on settings URL
  if (legacyTab === 'settlements' || legacyTab === 'deposits') {
    return <Navigate to={`/finance?tab=${legacyTab}`} replace />;
  }

  const [actionError, setActionError] = useState<string | null>(null);

  // Settings query (dispatch mode & delivery fee)
  const {
    data: settings,
    isError: isSettingsError,
    error: settingsError,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminApi.getSettings,
  });

  const updateOrderFlowMutation = useMutation({
    mutationFn: ({ mode, timeout }: { mode: 'RIDER_FIRST' | 'VENDOR_FIRST'; timeout?: number }) =>
      adminApi.updateOrderFlow(mode, timeout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update order flow mode.')),
  });

  const updateDeliveryFeeMutation = useMutation({
    mutationFn: (data: DeliveryFeeConfig) => adminApi.updateDeliveryFeeMode(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update delivery fee settings.')),
  });

  const currentFlowMode = settings?.orderFlow?.mode || 'RIDER_FIRST';

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings & Dispatch Configuration"
        subtitle="Configure real-time dispatch state machines, kitchen coordination pipelines, and dynamic delivery fee economics"
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
          isUpdating={updateOrderFlowMutation.isPending}
          onUpdateMode={(mode) => updateOrderFlowMutation.mutate({ mode })}
        />

        <DeliveryFeeSettingsCard
          initialConfig={settings?.deliveryFee}
          isSaving={updateDeliveryFeeMutation.isPending}
          onSave={(data) => updateDeliveryFeeMutation.mutate(data)}
        />
      </div>
    </div>
  );
};
