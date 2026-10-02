import apiClient, { unwrapData } from './shared';

export interface SystemSettingsData {
  orderFlow: {
    mode: 'RIDER_FIRST' | 'VENDOR_FIRST';
    rider_search_timeout_seconds: number;
    stale_order_ttl_minutes?: number;
  };
  deliveryFee: {
    mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
    flatFee: number;
    baseFee: number;
    baseKm: number;
    perKmRate: number;
  };
  deliveryEconomics?: {
    rider_share_percent: number;
    eta_avg_speed_kmh: number;
    eta_fallback_minutes: number;
  };
}

export interface UpdateOrderFlowPayload {
  mode: 'RIDER_FIRST' | 'VENDOR_FIRST';
  riderSearchTimeoutSeconds?: number;
  staleOrderTtlMinutes?: number;
}

export interface DeliveryEconomicsPayload {
  riderSharePercent: number;
  etaAvgSpeedKmh: number;
  etaFallbackMinutes: number;
}

export const settingsApi = {
  async getSettings(): Promise<SystemSettingsData> {
    const res = await apiClient.get('/api/v1/admin/settings');
    return unwrapData<SystemSettingsData>(res);
  },

  async updateOrderFlow(payload: UpdateOrderFlowPayload): Promise<{ mode: string; message?: string }> {
    const res = await apiClient.patch('/api/v1/admin/settings/order-flow', {
      mode: payload.mode,
      ...(payload.riderSearchTimeoutSeconds !== undefined
        ? { riderSearchTimeoutSeconds: payload.riderSearchTimeoutSeconds }
        : {}),
      ...(payload.staleOrderTtlMinutes !== undefined
        ? { staleOrderTtlMinutes: payload.staleOrderTtlMinutes }
        : {}),
    });
    return unwrapData<{ mode: string; message?: string }>(res);
  },

  async updateDeliveryFeeMode(data: {
    mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
    flatFee?: number;
    baseFee?: number;
    baseKm?: number;
    perKmRate?: number;
  }): Promise<{ message: string; data?: unknown }> {
    const res = await apiClient.patch('/api/v1/admin/settings/delivery-fee', data);
    return unwrapData<{ message: string; data?: unknown }>(res);
  },

  async updateDeliveryEconomics(data: DeliveryEconomicsPayload): Promise<NonNullable<SystemSettingsData['deliveryEconomics']>> {
    const res = await apiClient.patch('/api/v1/admin/settings/delivery-economics', data);
    return unwrapData<NonNullable<SystemSettingsData['deliveryEconomics']>>(res);
  },
};
