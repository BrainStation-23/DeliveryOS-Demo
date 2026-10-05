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

export const outletTypesApi = {
  async listOutletTypes(): Promise<AdminOutletType[]> {
    const res = await apiClient.get('/api/v1/admin/outlet-types');
    return normalizeArray<AdminOutletType>(unwrapData<unknown>(res));
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
