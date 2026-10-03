import apiClient, { Paginated, toPaginated, unwrapData } from './shared';

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
  latitude: number | null;
  longitude: number | null;
  activeOrder: {
    id: string;
    orderNumber: string;
    status: string;
    vendorName?: string;
  } | null;
  updatedAt: string;
}

export interface RiderRosterRow {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  email: string | null;
  vehicleType: string;
  isOnline: boolean;
  isApproved: boolean;
  userStatus: string;
  status: 'ONLINE' | 'ON_TRIP' | 'OFFLINE';
  cashInHand: number;
  maxCashLimit: number;
  cashSafetyWarning: boolean;
  latitude: number | null;
  longitude: number | null;
  totalDeliveries: number;
  earnings30d: number;
  activeOrder: { id: string; orderNumber: string; status: string; vendorName: string | null } | null;
  joinedAt: string;
}

export interface RiderDetail {
  rider: {
    id: string;
    userId: string;
    fullName: string;
    phone: string;
    email: string | null;
    userStatus: string;
    vehicleType: string;
    isOnline: boolean;
    isApproved: boolean;
    cashInHand: number;
    maxCashLimit: number;
    cashSafetyWarning: boolean;
    latitude: number | null;
    longitude: number | null;
    joinedAt: string;
    lastSeenAt: string;
  };
  status: 'ONLINE' | 'ON_TRIP' | 'OFFLINE';
  stats: {
    totalDeliveries: number;
    totalTrips: number;
    lifetimeEarnings: number;
    lifetimeCodCollected: number;
    earnings30d: number;
  };
  activeOrder: { id: string; orderNumber: string; status: string; vendorName: string | null } | null;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    vendorName: string;
    totalAmount: number;
    paymentMethod: string;
    placedAt: string;
  }>;
  recentDeposits: Array<{
    id: string;
    amount: number;
    status: string;
    depositedAt: string;
    referenceNo: string;
    note: string | null;
  }>;
}

export interface RiderRosterParams {
  page?: number;
  limit?: number;
  search?: string;
  approvalStatus?: 'ALL' | 'PENDING' | 'APPROVED';
  /** Derived duty status — ignored server-side while the applicant queue is active. */
  status?: 'ONLINE' | 'ON_TRIP' | 'OFFLINE';
  isOnline?: 'true' | 'false';
}

export const fleetApi = {
  async getFleet(): Promise<FleetRider[]> {
    const res = await apiClient.get('/api/v1/admin/fleet');
    const payload = res.data?.data || res.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  },

  async getRiderRoster(params: RiderRosterParams): Promise<Paginated<RiderRosterRow>> {
    const res = await apiClient.get('/api/v1/admin/riders', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        ...(params.search?.trim() ? { search: params.search.trim() } : {}),
        ...(params.approvalStatus ? { approvalStatus: params.approvalStatus } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.isOnline ? { isOnline: params.isOnline } : {}),
      },
    });
    return toPaginated<RiderRosterRow>(unwrapData<unknown>(res), params.page ?? 1, params.limit ?? 20);
  },

  async getRiderDetail(riderId: string): Promise<RiderDetail> {
    const res = await apiClient.get(`/api/v1/admin/riders/${riderId}`);
    return unwrapData<RiderDetail>(res);
  },

  async setRiderApproval(riderId: string, isApproved: boolean): Promise<{ message: string; data: { id: string; isApproved: boolean } }> {
    const res = await apiClient.patch(`/api/v1/admin/riders/${riderId}/approval`, { isApproved });
    return unwrapData<{ message: string; data: { id: string; isApproved: boolean } }>(res);
  },

  async updateRiderCashLimit(riderId: string, maxCashLimit: number): Promise<void> {
    await apiClient.patch(`/api/v1/admin/riders/${riderId}/cash-limit`, { maxCashLimit });
  },
};
