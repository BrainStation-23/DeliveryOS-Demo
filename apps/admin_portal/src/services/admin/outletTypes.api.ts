import apiClient, { normalizeArray, unwrapData } from './shared';

export interface AdminOutletType {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  _count?: { outlets: number };
}

export interface CreateOutletTypePayload {
  name: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateOutletTypePayload {
  name?: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface AssignedOutletRow {
  id: string;
  name: string;
  brandId: string;
  brandName: string | null;
  brandLogoUrl: string | null;
  addressText: string;
  contactPhone: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  isBusy: boolean;
  orderFlowMode: string;
  commissionRate: number;
  defaultPrepTimeMinutes: number;
  deliveryRadiusKm: number;
  totalProducts?: number;
  totalOrders?: number;
  totalStaff?: number;
  createdAt: string;
}

export interface OutletTypeOutletsResponse {
  type: {
    id: string;
    name: string;
    slug: string;
    isActive?: boolean;
  };
  outlets: AssignedOutletRow[];
}

export const outletTypesApi = {
  async listOutletTypes(): Promise<AdminOutletType[]> {
    const res = await apiClient.get('/api/v1/admin/outlet-types');
    return normalizeArray<AdminOutletType>(unwrapData<unknown>(res));
  },

  async getOutletTypeOutlets(id: string): Promise<OutletTypeOutletsResponse> {
    const res = await apiClient.get(`/api/v1/admin/outlet-types/${id}/outlets`);
    return unwrapData<OutletTypeOutletsResponse>(res);
  },

  async createOutletType(payload: CreateOutletTypePayload): Promise<AdminOutletType> {
    const res = await apiClient.post('/api/v1/admin/outlet-types', payload);
    return unwrapData<AdminOutletType>(res);
  },

  async updateOutletType(id: string, payload: UpdateOutletTypePayload): Promise<AdminOutletType> {
    const res = await apiClient.patch(`/api/v1/admin/outlet-types/${id}`, payload);
    return unwrapData<AdminOutletType>(res);
  },

  async deleteOutletType(id: string): Promise<{ id: string; name: string }> {
    const res = await apiClient.delete(`/api/v1/admin/outlet-types/${id}`);
    return unwrapData<{ id: string; name: string }>(res);
  },
};
