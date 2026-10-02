import apiClient, { normalizeArray, unwrapData } from './shared';

export interface AdminBanner {
  id: string;
  title: string;
  imageUrl: string;
  linkType: 'OUTLET' | 'CATEGORY' | 'EXTERNAL';
  targetId: string | null;
  targetUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
}

export interface SaveBannerPayload {
  title: string;
  imageUrl: string;
  linkType: AdminBanner['linkType'];
  targetId?: string;
  targetUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string | null;
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

export const promotionsApi = {
  async getBanners(): Promise<AdminBanner[]> {
    const res = await apiClient.get('/api/v1/admin/banners');
    return normalizeArray<AdminBanner>(unwrapData<unknown>(res));
  },

  async createBanner(data: SaveBannerPayload): Promise<AdminBanner> {
    const res = await apiClient.post('/api/v1/admin/banners', data);
    return unwrapData<AdminBanner>(res);
  },

  async updateBanner(id: string, data: Partial<SaveBannerPayload>): Promise<AdminBanner> {
    const res = await apiClient.patch(`/api/v1/admin/banners/${id}`, data);
    return unwrapData<AdminBanner>(res);
  },

  async deleteBanner(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/admin/banners/${id}`);
  },

  async getCoupons(): Promise<AdminCoupon[]> {
    const res = await apiClient.get('/api/v1/admin/coupons');
    return normalizeArray<AdminCoupon>(unwrapData<unknown>(res));
  },

  async createCoupon(data: Partial<AdminCoupon>): Promise<AdminCoupon> {
    const res = await apiClient.post('/api/v1/admin/coupons', data);
    return unwrapData<AdminCoupon>(res);
  },

  async updateCoupon(id: string, data: Partial<AdminCoupon>): Promise<AdminCoupon> {
    const res = await apiClient.patch(`/api/v1/admin/coupons/${id}`, data);
    return unwrapData<AdminCoupon>(res);
  },

  async deleteCoupon(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/admin/coupons/${id}`);
  },
};
