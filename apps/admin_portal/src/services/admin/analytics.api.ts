import apiClient, { unwrapData } from './shared';

export interface AnalyticsMetricCard {
  value: number;
  delta: number | null;
}

export interface AnalyticsOverview {
  window: { from: string; to: string };
  cards: {
    totalOrders: AnalyticsMetricCard;
    deliveredOrders: AnalyticsMetricCard;
    cancelledOrders: AnalyticsMetricCard;
    cancellationRate: AnalyticsMetricCard;
    grossVolume: AnalyticsMetricCard;
    commission: AnalyticsMetricCard;
    deliveryFees: AnalyticsMetricCard;
    avgOrderValue: AnalyticsMetricCard;
    avgDeliveryMinutes: { value: number | null; delta: number | null };
    newCustomers: AnalyticsMetricCard;
  };
  snapshots: { activeOutlets: number; onlineRiders: number };
  statusCounts: Record<string, number>;
  timeseries: Array<{ bucketStart: string; orders: number; revenue: number; cancelled: number }>;
  topOutlets: Array<{
    vendorId: string;
    vendorName: string;
    brandName: string | null;
    orders: number;
    grossVolume: number;
  }>;
  topRiders: Array<{
    riderId: string;
    riderName: string;
    phone: string | null;
    trips: number;
    earnings: number;
    codCollected: number;
  }>;
}

export interface OrdersStatusSummary {
  counts: Record<string, number>;
  total: number;
  /** Active (non-terminal) orders with no courier — the dispatch queue size. */
  unassignedCount?: number;
}

export interface AnalyticsOverviewParams {
  dateFrom?: string;
  dateTo?: string;
  granularity?: 'day' | 'hour';
}

export const analyticsApi = {
  async getAnalyticsOverview(params: AnalyticsOverviewParams): Promise<AnalyticsOverview> {
    const res = await apiClient.get('/api/v1/admin/analytics/overview', { params });
    return unwrapData<AnalyticsOverview>(res);
  },

  async getOrdersStatusSummary(params: {
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    assignment?: 'UNASSIGNED' | 'ASSIGNED';
  }): Promise<OrdersStatusSummary> {
    const res = await apiClient.get('/api/v1/admin/analytics/orders-summary', { params });
    return unwrapData<OrdersStatusSummary>(res);
  },
};
