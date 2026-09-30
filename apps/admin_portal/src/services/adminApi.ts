import apiClient from './apiClient';

export interface PaginatedOrders {
  items: AdminOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

export interface FleetRider {
  id: string;
  userId: string;
  riderName: string;
  phone: string;
  vehicleType: string;
  isOnline: boolean;
  isApproved?: boolean;
  status: 'ONLINE' | 'ON_TRIP' | 'OFFLINE';
  cashInHand: number;
  maxCashLimit: number;
  cashSafetyWarning: boolean;
  latitude: number;
  longitude: number;
  activeOrder: {
    id: string;
    orderNumber: string;
    status: string;
    vendorName?: string;
  } | null;
  updatedAt: string;
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
  placedAt: string;
  acceptedAt?: string | null;
  prepTimeMinutes?: number | null;
  customerNotes?: string | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  deliveryAddress: string;
}

export interface AdminBanner {
  id: string;
  title: string;
  imageUrl: string;
  linkType: 'OUTLET' | 'CATEGORY' | 'EXTERNAL';
  targetId: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
}

export interface AdminCoupon {
  id: string;
  code: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  usageLimit: number;
  currentUses: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminVendor {
  id: string;
  name: string;
  brandId: string | null;
  brandName: string | null;
  addressText: string;
  contactPhone: string;
  isBusy: boolean;
  isActive: boolean;
  commissionRate: number;
  deliveryRadiusKm?: number;
  defaultPrepTimeMinutes: number;
  totalOrders: number;
  totalProducts: number;
  staff: Array<{
    id: string;
    userId: string;
    fullName: string;
    phone: string;
    scope: 'ALL_OUTLETS_MASTER' | 'PARTICULAR_OUTLET';
    isActive: boolean;
  }>;
}

export interface SystemSettingsData {
  orderFlow: {
    mode: 'RIDER_FIRST' | 'VENDOR_FIRST';
    rider_search_timeout_seconds: number;
  };
  deliveryFee: {
    mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
    flatFee: number;
    baseFee: number;
    baseKm: number;
    perKmRate: number;
  };
}

export interface SettlementStatement {
  vendorId: string;
  vendorName: string;
  brandName: string;
  totalOrders: number;
  grossSales: number;
  platformCommission: number;
  netVendorPayable: number;
  settlementStatus: string;
}

export interface SettlementBatchItem {
  id: string;
  batchNumber: string;
  startDate: string;
  endDate: string;
  totalOrders: number;
  totalVendorPayout: number;
  totalRiderPayout: number;
  totalPlatformMargin: number;
  status: string;
  executedByUserId: string;
  executedAt: string;
}

export interface AdminRiderDetail {
  id: string;
  userId: string;
  phone: string;
  fullName: string;
  vehicleType: string;
  isOnline: boolean;
  isApproved: boolean;
  maxCashLimit: number;
  cashInHand: number;
  rating: number;
  completedDeliveries: number;
  totalOrders: number;
  createdAt: string;
}

export const adminApi = {
  // 1. Overview
  async getOverview(): Promise<AdminOverview> {
    const res = await apiClient.get('/api/v1/admin/overview');
    return res.data?.data || res.data;
  },

  // 2. Fleet Radar
  async getFleet(): Promise<FleetRider[]> {
    const res = await apiClient.get('/api/v1/admin/fleet');
    return res.data?.data || res.data;
  },

  async getRiders(params?: { approvalStatus?: 'ALL' | 'PENDING' | 'APPROVED'; isOnline?: boolean }): Promise<AdminRiderDetail[]> {
    const res = await apiClient.get('/api/v1/admin/riders', { params });
    const payload = res.data?.data || res.data;
    return Array.isArray(payload) ? payload : (payload.data || []);
  },

  async setRiderApproval(riderId: string, isApproved: boolean): Promise<{ message: string; data: { id: string; isApproved: boolean } }> {
    const res = await apiClient.patch(`/api/v1/admin/riders/${riderId}/approval`, { isApproved });
    return res.data?.data || res.data;
  },

  async updateRiderCashLimit(riderId: string, maxCashLimit: number): Promise<void> {
    await apiClient.patch(`/api/v1/admin/riders/${riderId}/cash-limit`, { maxCashLimit });
  },

  // 3. Live Order Monitor & Force Assign
  async getOrders(status?: string, page = 1, limit = 20, search?: string): Promise<PaginatedOrders> {
    const params = {
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(search?.trim() ? { search: search.trim() } : {}),
      page,
      limit,
    };
    const res = await apiClient.get('/api/v1/admin/orders', { params });
    const payload = res.data?.data || res.data;
    return {
      items: payload?.items ?? [],
      total: payload?.total ?? 0,
      page: payload?.page ?? page,
      limit: payload?.limit ?? limit,
      totalPages: payload?.totalPages ?? 1,
    };
  },

  async forceAssignRider(orderId: string, riderId: string): Promise<{ message: string; data?: AdminOrder }> {
    const res = await apiClient.post(`/api/v1/admin/orders/${orderId}/force-assign`, { riderId });
    return res.data?.data || res.data;
  },

  async cancelOrder(orderId: string, reason: string): Promise<{ message: string }> {
    const res = await apiClient.post(`/api/v1/admin/orders/${orderId}/cancel`, { reason });
    return res.data?.data || res.data;
  },

  // 4. Banners
  async getBanners(): Promise<AdminBanner[]> {
    const res = await apiClient.get('/api/v1/admin/banners');
    return res.data?.data || res.data;
  },

  async uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await apiClient.post('/api/v1/admin/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const payload = res.data?.data || res.data;
    const base = (apiClient.defaults.baseURL as string) || '';
    const url = payload?.url as string;
    // Relative /uploads URLs resolve against the API origin, not the SPA origin
    if (url.startsWith('/') && base && !base.includes(window.location.origin)) {
      return `${base.replace(/\/$/, '').replace(/\/api\/v1$/, '')}${url}`;
    }
    return url;
  },

  async createBanner(data: Partial<AdminBanner>): Promise<AdminBanner> {
    const res = await apiClient.post('/api/v1/admin/banners', data);
    return res.data?.data || res.data;
  },

  async updateBanner(id: string, data: Partial<AdminBanner>): Promise<AdminBanner> {
    const res = await apiClient.patch(`/api/v1/admin/banners/${id}`, data);
    return res.data?.data || res.data;
  },

  async deleteBanner(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/admin/banners/${id}`);
  },

  // 5. Coupons
  async getCoupons(): Promise<AdminCoupon[]> {
    const res = await apiClient.get('/api/v1/admin/coupons');
    return res.data?.data || res.data;
  },

  async createCoupon(data: Partial<AdminCoupon>): Promise<AdminCoupon> {
    const res = await apiClient.post('/api/v1/admin/coupons', data);
    return res.data?.data || res.data;
  },

  async updateCoupon(id: string, data: Partial<AdminCoupon>): Promise<AdminCoupon> {
    const res = await apiClient.patch(`/api/v1/admin/coupons/${id}`, data);
    return res.data?.data || res.data;
  },

  async deleteCoupon(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/admin/coupons/${id}`);
  },

  // 6. Vendors & Staff
  async getVendors(): Promise<AdminVendor[]> {
    const res = await apiClient.get('/api/v1/admin/vendors');
    return res.data?.data || res.data;
  },

  async createVendor(data: {
    name: string;
    brandId?: string;
    addressText: string;
    latitude: number;
    longitude: number;
    contactPhone: string;
    commissionRate?: number;
    defaultPrepTimeMinutes?: number;
  }): Promise<AdminVendor> {
    const res = await apiClient.post('/api/v1/admin/vendors', data);
    return res.data?.data || res.data;
  },

  async updateVendor(
    vendorId: string,
    data: {
      name?: string;
      contactPhone?: string;
      commissionRate?: number;
      deliveryRadiusKm?: number;
      defaultPrepTimeMinutes?: number;
      isActive?: boolean;
    },
  ): Promise<AdminVendor> {
    const res = await apiClient.patch(`/api/v1/admin/vendors/${vendorId}`, data);
    const payload = res.data?.data || res.data;
    return payload?.data || payload;
  },

  async toggleVendorStatus(vendorId: string, isActive: boolean): Promise<AdminVendor> {
    const res = await apiClient.patch(`/api/v1/admin/vendors/${vendorId}/status`, { isActive });
    const payload = res.data?.data || res.data;
    return payload?.data || payload;
  },

  async assignVendorStaff(
    vendorId: string,
    data: {
      userId: string;
      scope: 'ALL_OUTLETS_MASTER' | 'PARTICULAR_OUTLET';
      brandId?: string;
    },
  ): Promise<{ message: string; data?: unknown }> {
    const res = await apiClient.post(`/api/v1/admin/vendors/${vendorId}/staff`, data);
    return res.data?.data || res.data;
  },

  // 7. System Settings
  async getSettings(): Promise<SystemSettingsData> {
    const res = await apiClient.get('/api/v1/admin/settings');
    return res.data?.data || res.data;
  },

  async updateOrderFlow(mode: 'RIDER_FIRST' | 'VENDOR_FIRST', timeout?: number): Promise<{ message: string; data?: unknown }> {
    const res = await apiClient.patch('/api/v1/admin/settings/order-flow', {
      mode,
      riderSearchTimeoutSeconds: timeout,
    });
    return res.data?.data || res.data;
  },

  async updateDeliveryFeeMode(data: {
    mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
    flatFee?: number;
    baseFee?: number;
    baseKm?: number;
    perKmRate?: number;
  }): Promise<{ message: string; data?: unknown }> {
    const res = await apiClient.patch('/api/v1/admin/settings/delivery-fee', data);
    return res.data?.data || res.data;
  },

  // 8. Financial Settlements
  async getSettlementStatements(): Promise<SettlementStatement[]> {
    const res = await apiClient.get('/api/v1/admin/finance/settlement-export', {
      params: { format: 'json' },
    });
    return res.data?.data || res.data;
  },

  async exportSettlementCsv(): Promise<Blob> {
    const res = await apiClient.get('/api/v1/admin/finance/settlement-export', {
      params: { format: 'csv' },
      responseType: 'blob',
    });
    return res.data;
  },

  async executeSettlementCycle(notes?: string): Promise<{ message: string; batch: SettlementBatchItem; settledOrdersCount: number }> {
    const res = await apiClient.post('/api/v1/admin/finance/settle-cycle', { notes });
    const payload = res.data?.data || res.data;
    return payload;
  },

  async getSettlementBatches(): Promise<SettlementBatchItem[]> {
    const res = await apiClient.get('/api/v1/admin/finance/settlement-batches');
    const payload = res.data?.data || res.data;
    return Array.isArray(payload) ? payload : (payload.data || []);
  },
};

export default adminApi;
