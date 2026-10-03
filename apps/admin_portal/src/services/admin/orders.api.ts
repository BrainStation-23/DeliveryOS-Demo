import apiClient, { normalizeArray, unwrapData } from './shared';

export interface AdminOverview {
  metrics: {
    totalOrders: number;
    todayOrders: number;
    activeRiders: number;
    ridersOnTrip: number;
    totalRiders: number;
    onlineVendors: number;
    totalVendors: number;
    todayVolume: number;
    todayCommission: number;
    todayNetPayable: number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    outletName: string;
    riderName: string | null;
    status: string;
    totalAmount: number;
    paymentMethod: string;
    placedAt: string;
  }>;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  vendorAddress: string;
  vendorLatitude?: number | null;
  vendorLongitude?: number | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  riderId: string | null;
  riderName: string | null;
  riderPhone: string | null;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  deliveryFee: number;
  subtotal?: number;
  couponDiscount?: number;
  taxAmount?: number;
  placedAt: string;
  acceptedAt?: string | null;
  prepTimeMinutes?: number | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  rejectionReason?: string | null;
  customerNotes?: string | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  deliveryAddress: string;
}

export interface PaginatedOrders {
  items: AdminOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const ordersApi = {
  async getOverview(): Promise<AdminOverview> {
    const res = await apiClient.get('/api/v1/admin/overview');
    const payload = unwrapData<AdminOverview | { metrics?: AdminOverview['metrics']; recentOrders?: AdminOverview['recentOrders'] }>(res);
    return {
      metrics: payload?.metrics || {
        totalOrders: 0,
        todayOrders: 0,
        activeRiders: 0,
        ridersOnTrip: 0,
        totalRiders: 0,
        onlineVendors: 0,
        totalVendors: 0,
        todayVolume: 0,
        todayCommission: 0,
        todayNetPayable: 0,
      },
      recentOrders: normalizeArray<AdminOverview['recentOrders'][number]>(payload?.recentOrders),
    };
  },

  async getOrders(
    status?: string,
    page = 1,
    limit = 20,
    search?: string,
    dateFrom?: string,
    dateTo?: string,
    assignment?: 'UNASSIGNED' | 'ASSIGNED',
  ): Promise<PaginatedOrders> {
    const params = {
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(search?.trim() ? { search: search.trim() } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(assignment ? { assignment } : {}),
      page,
      limit,
    };
    const res = await apiClient.get('/api/v1/admin/orders', { params });
    const payload = unwrapData<unknown>(res);

    let items: AdminOrder[] = normalizeArray<AdminOrder>(payload);
    let total = items.length;
    let totalPages = 1;
    const body = payload as PaginatedOrders | null;
    if (body && Array.isArray(body.items)) {
      items = body.items;
      total = typeof body.total === 'number' ? body.total : items.length;
      totalPages = typeof body.totalPages === 'number' ? body.totalPages : Math.ceil(total / limit);
    }

    return {
      items,
      total: Math.max(0, total),
      page,
      limit,
      totalPages: Math.max(1, totalPages),
    };
  },

  async getOrderById(orderId: string): Promise<AdminOrder> {
    const res = await apiClient.get(`/api/v1/admin/orders/${orderId}`);
    return unwrapData<AdminOrder>(res);
  },

  async forceAssignRider(orderId: string, riderId: string): Promise<{ message: string; data?: AdminOrder }> {
    const res = await apiClient.post(`/api/v1/admin/orders/${orderId}/force-assign`, { riderId });
    return unwrapData<{ message: string; data?: AdminOrder }>(res);
  },

  async cancelOrder(orderId: string, reason: string): Promise<{ message: string }> {
    const res = await apiClient.post(`/api/v1/admin/orders/${orderId}/cancel`, { reason });
    return unwrapData<{ message: string }>(res);
  },
};
