import apiClient, { Paginated, toPaginated, unwrapData } from './shared';

export interface CustomerRow {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: string;
  suspensionReason?: string | null;
  createdAt: string;
  orderCount: number;
  lifetimeSpend: number;
  lastOrderAt: string | null;
}

export interface CustomerDetail {
  customer: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    status: string;
    suspensionReason?: string | null;
    createdAt: string;
    addresses: Array<{
      id: string;
      label: string;
      addressLine: string;
      latitude: number;
      longitude: number;
      isDefault: boolean;
    }>;
  };
  metrics: {
    statusCounts: Record<string, number>;
    totalOrders: number;
    orderCount: number;
    lifetimeSpend: number;
    totalDeliveryFees: number;
    totalCouponSavings: number;
    avgOrderValue: number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    vendorName: string;
    totalAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    placedAt: string;
    deliveryAddress?: string | null;
    deliveryLatitude?: number | null;
    deliveryLongitude?: number | null;
  }>;
}

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'ALL';
  dateFrom?: string;
  dateTo?: string;
}

export const customersApi = {
  async getCustomers(params: CustomerListParams): Promise<Paginated<CustomerRow>> {
    const res = await apiClient.get('/api/v1/admin/customers', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        ...(params.search?.trim() ? { search: params.search.trim() } : {}),
        ...(params.status && params.status !== 'ALL' ? { status: params.status } : {}),
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
      },
    });
    return toPaginated<CustomerRow>(unwrapData<unknown>(res), params.page ?? 1, params.limit ?? 20);
  },

  async getCustomerDetail(customerId: string): Promise<CustomerDetail> {
    const res = await apiClient.get(`/api/v1/admin/customers/${customerId}`);
    return unwrapData<CustomerDetail>(res);
  },

  async updateCustomerStatus(
    customerId: string,
    status: 'ACTIVE' | 'SUSPENDED',
    reason?: string,
  ): Promise<{ id: string; fullName: string; phone: string; status: string; suspensionReason: string | null }> {
    const res = await apiClient.patch(`/api/v1/admin/customers/${customerId}/status`, {
      status,
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    });
    return unwrapData<{ id: string; fullName: string; phone: string; status: string; suspensionReason: string | null }>(res);
  },
};
