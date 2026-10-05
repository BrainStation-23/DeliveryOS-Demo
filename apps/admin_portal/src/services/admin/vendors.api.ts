import apiClient, { Paginated, toPaginated, unwrapData } from './shared';

export interface AdminVendor {
  id: string;
  name: string;
  brandId: string;
  brandName: string | null;
  addressText: string;
  contactPhone: string;
  bannerUrl: string | null;
  isBusy: boolean;
  isActive: boolean;
  commissionRate: number;
  deliveryRadiusKm?: number;
  defaultPrepTimeMinutes: number;
  totalOrders?: number;
  totalProducts?: number;
  totalCategories?: number;
  totalStaff?: number;
  staff: Array<{
    id: string;
    userId: string;
    fullName: string;
    phone: string;
    scope: 'ALL_OUTLETS_MASTER' | 'PARTICULAR_OUTLET';
    isActive: boolean;
  }>;
}

export interface AdminBrand {
  id: string;
  name: string;
  logoUrl: string | null;
  totalOutlets: number;
  totalStaff: number;
  createdAt: string;
  owner: AdminStaffAssignment | null;
}

export interface AdminUserSummary {
  id: string;
  phone: string;
  fullName: string;
  role: string;
  status: string;
}

export interface AdminVendorStaffRow {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  userStatus: string;
  scope: 'ALL_OUTLETS_MASTER' | 'PARTICULAR_OUTLET';
  isActive: boolean;
  vendorId: string | null;
  vendorName: string | null;
  brandId: string | null;
  brandName: string | null;
}

export interface AdminCatalogProduct {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  isInStock: boolean;
  sortOrder: number;
  variants: AdminProductVariation[];
}

export interface AdminProductVariation {
  id: string;
  name: string;
  price: number;
  sortOrder: number;
  isInStock: boolean;
}

export interface AdminCatalog {
  vendorId: string;
  vendorName: string;
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    products: AdminCatalogProduct[];
  }>;
}

export interface SaveProductPayload {
  vendorId?: string;
  categoryId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isInStock?: boolean;
  sortOrder?: number;
  variations: Array<{ id?: string; name: string; price: number; isInStock: boolean }>;
}

export interface AdminOperatingHour {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface AdminStaffAssignment {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  userStatus: string;
  scope: 'ALL_OUTLETS_MASTER' | 'PARTICULAR_OUTLET';
  isActive: boolean;
  vendorId: string | null;
  vendorName: string | null;
  brandId: string | null;
  brandName: string | null;
}

export interface OutletDetail {
  vendor: {
    id: string;
    name: string;
    brandId: string;
    brandName: string | null;
    brandLogoUrl: string | null;
    bannerUrl: string | null;
    addressText: string;
    contactPhone: string;
    latitude: number;
    longitude: number;
    commissionRate: number;
    deliveryRadiusKm: number;
    defaultPrepTimeMinutes: number;
    isActive: boolean;
    isBusy: boolean;
    totalStaff?: number;
    totalCategories?: number;
    totalProducts?: number;
    totalOrders?: number;
  };
  operatingHours: AdminOperatingHour[];
  staff: AdminStaffAssignment[];
  categories: AdminCatalog['categories'];
}

export interface CentralCategory {
  id: string;
  name: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { products: number };
}

export const vendorsApi = {
  async getCentralCategories(): Promise<CentralCategory[]> {
    const res = await apiClient.get('/api/v1/admin/catalog/categories');
    return unwrapData<CentralCategory[]>(res);
  },

  async getVendors(): Promise<AdminVendor[]> {
    const res = await apiClient.get('/api/v1/admin/vendors');
    const payload = res.data?.data || res.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  },

  async createVendor(data: {
    name: string;
    brandId: string;
    addressText: string;
    latitude?: number;
    longitude?: number;
    contactPhone: string;
    bannerUrl?: string;
    commissionRate?: number;
    defaultPrepTimeMinutes?: number;
    deliveryRadiusKm?: number;
  }): Promise<AdminVendor> {
    const res = await apiClient.post('/api/v1/admin/vendors', data);
    return unwrapData<AdminVendor>(res);
  },

  async updateVendor(
    vendorId: string,
    data: {
      name?: string;
      contactPhone?: string;
      addressText?: string;
      bannerUrl?: string;
      commissionRate?: number;
      deliveryRadiusKm?: number;
      defaultPrepTimeMinutes?: number;
      latitude?: number;
      longitude?: number;
      isActive?: boolean;
      isBusy?: boolean;
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

  async toggleVendorPause(vendorId: string, isBusy: boolean): Promise<AdminVendor> {
    const res = await apiClient.patch(`/api/v1/admin/vendors/${vendorId}/pause`, { isBusy });
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
    return unwrapData<{ message: string; data?: unknown }>(res);
  },

  async getBrands(params?: { page?: number; limit?: number; search?: string }): Promise<Paginated<AdminBrand>> {
    const res = await apiClient.get('/api/v1/admin/brands', {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 12,
        ...(params?.search?.trim() ? { search: params.search.trim() } : {}),
      },
    });
    return toPaginated<AdminBrand>(unwrapData<unknown>(res), params?.page ?? 1, params?.limit ?? 12);
  },

  async createBrand(data: { name: string; logoUrl?: string }): Promise<AdminBrand> {
    const res = await apiClient.post('/api/v1/admin/brands', data);
    return unwrapData<AdminBrand>(res);
  },

  async updateBrand(brandId: string, data: { name?: string; logoUrl?: string }): Promise<AdminBrand> {
    const res = await apiClient.patch(`/api/v1/admin/brands/${brandId}`, data);
    return unwrapData<AdminBrand>(res);
  },

  async deleteBrand(brandId: string): Promise<void> {
    await apiClient.delete(`/api/v1/admin/brands/${brandId}`);
  },

  async deleteVendor(vendorId: string): Promise<{ id: string; name: string }> {
    const res = await apiClient.delete(`/api/v1/admin/vendors/${vendorId}`);
    return unwrapData<{ id: string; name: string }>(res);
  },

  async deleteOutlet(vendorId: string): Promise<{ id: string; name: string }> {
    return this.deleteVendor(vendorId);
  },

  async setBrandOwner(brandId: string, userId: string | null): Promise<{ owner: AdminBrand['owner']; demotedCount: number }> {
    const res = await apiClient.put(`/api/v1/admin/brands/${brandId}/owner`, userId ? { userId } : {});
    return unwrapData<{ owner: AdminBrand['owner']; demotedCount: number }>(res);
  },

  async getOutletDetail(vendorId: string): Promise<OutletDetail> {
    const res = await apiClient.get(`/api/v1/admin/outlets/${vendorId}`);
    return unwrapData<OutletDetail>(res);
  },

  async saveProduct(
    payload: SaveProductPayload,
    productId?: string,
  ): Promise<{ id: string; name: string }> {
    const res = productId
      ? await apiClient.patch(`/api/v1/admin/products/${productId}`, payload)
      : await apiClient.post('/api/v1/admin/products', payload);
    return unwrapData<{ id: string; name: string }>(res);
  },

  async deleteProduct(productId: string): Promise<{ id: string; name: string }> {
    const res = await apiClient.delete(`/api/v1/admin/products/${productId}`);
    return unwrapData<{ id: string; name: string }>(res);
  },

  async updateOperatingHours(
    vendorId: string,
    hours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>,
  ): Promise<void> {
    await apiClient.put(`/api/v1/admin/vendors/${vendorId}/operating-hours`, { hours });
  },

  async createOutletCategory(vendorId: string, data: { name: string; sortOrder?: number }): Promise<void> {
    await apiClient.post(`/api/v1/admin/vendors/${vendorId}/categories`, data);
  },

  async updateCategory(
    categoryId: string,
    data: { name?: string; sortOrder?: number; isActive?: boolean },
  ): Promise<void> {
    await apiClient.patch(`/api/v1/admin/categories/${categoryId}`, data);
  },

  async deleteCategory(categoryId: string): Promise<{ id: string; name: string }> {
    const res = await apiClient.delete(`/api/v1/admin/categories/${categoryId}`);
    return unwrapData<{ id: string; name: string }>(res);
  },

  async updateVendorStaff(
    staffId: string,
    data: { isActive?: boolean; scope?: 'PARTICULAR_OUTLET' | 'ALL_OUTLETS_MASTER'; brandId?: string },
  ): Promise<void> {
    await apiClient.patch(`/api/v1/admin/vendor-staff/${staffId}`, data);
  },

  async updateStaffAccount(userId: string, data: { fullName?: string; phone?: string }): Promise<void> {
    await apiClient.patch(`/api/v1/admin/users/${userId}`, data);
  },

  async searchUsersByPhone(phone: string): Promise<AdminUserSummary[]> {
    const res = await apiClient.get('/api/v1/admin/users/search', { params: { phone } });
    return unwrapData<AdminUserSummary[]>(res);
  },

  async createStaffUser(data: { phone: string; fullName: string }): Promise<AdminUserSummary> {
    const res = await apiClient.post('/api/v1/admin/users', data);
    return unwrapData<AdminUserSummary>(res);
  },

  async getVendorStaff(): Promise<AdminVendorStaffRow[]> {
    const res = await apiClient.get('/api/v1/admin/vendor-staff');
    return unwrapData<AdminVendorStaffRow[]>(res);
  },

  async removeVendorStaff(staffId: string): Promise<{ removed: boolean; demoted: boolean }> {
    const res = await apiClient.delete(`/api/v1/admin/vendor-staff/${staffId}`);
    return res.data?.data || { removed: true, demoted: false };
  },
};
