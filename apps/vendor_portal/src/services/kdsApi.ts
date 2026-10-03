import apiClient from './apiClient';
import { KDSOrder, OutletCatalog, KDSOrderItem, Category, Product, ProductVariant } from '../types/kds';
import { LedgerItem } from '../types/ledger';

export interface RawBackendOrderItem {
  id?: string;
  productId?: string;
  productName?: string;
  productNameSnapshot?: string;
  quantity?: number;
  unitPrice?: number | string;
  subtotal?: number | string;
  totalPrice?: number | string;
  instructions?: string | null;
  specialInstructions?: string | null;
  variant?: { id: string; name: string; priceDelta: number } | null;
  variantSnapshot?: { id: string; name: string; price?: number; priceModifier?: number } | null;
  toppings?: Array<{ id: string; name: string; price: number }>;
  addonsSnapshot?: Array<{ id: string; name: string; price: number }>;
}

export interface RawBackendOrder {
  id?: string;
  orderId?: string;
  orderNumber?: string;
  vendorId?: string;
  status: KDSOrder['status'];
  subtotal?: number | string;
  taxAmount?: number | string;
  deliveryFee?: number | string;
  discountAmount?: number | string;
  couponDiscount?: number | string;
  totalAmount?: number | string;
  paymentMethod?: 'CASH_ON_DELIVERY' | 'ONLINE_GATEWAY';
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED';
  deliveryAddress?: { addressLine: string; label?: string } | null;
  deliveryAddressSnapshot?: { addressLine: string; label?: string } | null;
  customerNotes?: string | null;
  prepTimeMinutes?: number | null;
  vendor?: { defaultPrepTimeMinutes?: number };
  createdAt?: string;
  placedAt?: string;
  updatedAt?: string;
  acceptedAt?: string | null;
  readyAt?: string | null;
  items?: RawBackendOrderItem[];
  orderItems?: RawBackendOrderItem[];
  customer?: { id?: string; fullName?: string; phone?: string };
  customerPhoneSnapshot?: string;
  rider?: {
    id: string;
    fullName?: string;
    phone?: string;
    latitude?: number | null;
    longitude?: number | null;
    user?: { fullName?: string; phone?: string };
  } | null;
}

/**
 * Normalizes backend Prisma order entity into typed KDSOrder format.
 * Bridges differences between Prisma relational fields (orderItems, placedAt, rider.user)
 * and the frontend UI model.
 */
export function normalizeKDSOrder(raw: RawBackendOrder): KDSOrder {
  if (!raw) return raw;

  const rawItems = raw.items || raw.orderItems || [];
  const items: KDSOrderItem[] = rawItems.map((item: RawBackendOrderItem) => ({
    id: item.id || '',
    productId: item.productId || '',
    productName: item.productName || item.productNameSnapshot || 'Item',
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice) || 0,
    subtotal: Number(item.subtotal ?? item.totalPrice) || 0,
    instructions: item.instructions || item.specialInstructions || null,
    variant: item.variant || (item.variantSnapshot ? {
      id: item.variantSnapshot.id,
      name: item.variantSnapshot.name,
      priceDelta: item.variantSnapshot.price ?? item.variantSnapshot.priceModifier ?? 0,
    } : null),
    toppings: item.toppings || item.addonsSnapshot || [],
  }));

  const rider = raw.rider
    ? {
        id: raw.rider.id,
        fullName: raw.rider.fullName || raw.rider.user?.fullName || 'Assigned Rider',
        phone: raw.rider.phone || raw.rider.user?.phone || '',
        latitude: raw.rider.latitude,
        longitude: raw.rider.longitude,
      }
    : null;

  const customer = raw.customer
    ? {
        id: raw.customer.id || '',
        fullName: raw.customer.fullName || raw.customerPhoneSnapshot || 'Customer',
        phone: raw.customer.phone || raw.customerPhoneSnapshot || '',
      }
    : {
        id: '',
        fullName: raw.customerPhoneSnapshot || 'Customer',
        phone: raw.customerPhoneSnapshot || '',
      };

  return {
    id: raw.id || raw.orderId || '',
    orderNumber: raw.orderNumber || '',
    vendorId: raw.vendorId || '',
    status: raw.status,
    subtotal: Number(raw.subtotal) || 0,
    taxAmount: Number(raw.taxAmount) || 0,
    deliveryFee: Number(raw.deliveryFee) || 0,
    discountAmount: Number(raw.couponDiscount ?? raw.discountAmount) || 0,
    totalAmount: Number(raw.totalAmount) || 0,
    paymentMethod: raw.paymentMethod || 'CASH_ON_DELIVERY',
    paymentStatus: raw.paymentStatus || 'PENDING',
    deliveryAddress: raw.deliveryAddress || raw.deliveryAddressSnapshot || null,
    customerNotes: raw.customerNotes || null,
    prepTimeMinutes: raw.prepTimeMinutes ?? raw.vendor?.defaultPrepTimeMinutes ?? null,
    createdAt: raw.createdAt || raw.placedAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.placedAt || new Date().toISOString(),
    acceptedAt: raw.acceptedAt || null,
    readyAt: raw.readyAt || null,
    customer,
    rider,
    items,
  };
}

export interface RawBackendCatalogVariant {
  id: string;
  productId: string;
  name: string;
  price?: number;
  priceDelta?: number;
  priceModifier?: number;
  isInStock: boolean;
}

export interface RawBackendCatalogProduct {
  id: string;
  vendorId: string;
  categoryId: string;
  name: string;
  description?: string | null;
  basePrice: number;
  unitType: string;
  imageUrl?: string | null;
  isInStock: boolean;
  variants?: RawBackendCatalogVariant[];
}

export interface RawBackendCatalogCategory {
  id: string;
  vendorId: string;
  name: string;
  displayOrder: number;
  products?: RawBackendCatalogProduct[];
}

export interface RawBackendCatalog {
  vendorId?: string;
  vendorName?: string;
  defaultPrepTimeMinutes?: number;
  categories?: RawBackendCatalogCategory[];
}

export const kdsApi = {
  /** Unified per-order detail (ledger shape) powering the order info dialog. */
  async getOrderDetail(orderId: string): Promise<LedgerItem> {
    const response = await apiClient.get(`/api/v1/vendor/orders/${orderId}/detail`);
    return response.data?.data || response.data;
  },

  /**
   * Fetch active order board queue
   */
  async getLiveOrders(vendorId?: string): Promise<KDSOrder[]> {
    const params = vendorId ? { vendorId } : undefined;
    const response = await apiClient.get('/api/v1/vendor/orders/live', { params });
    const payload = response.data?.data || response.data;
    const rawList = Array.isArray(payload) ? payload : [];
    return rawList.map(normalizeKDSOrder);
  },

  /**
   * Accept incoming order with default or custom preparation time
   */
  async acceptOrder(orderId: string, prepTimeMinutes?: number): Promise<KDSOrder> {
    const response = await apiClient.patch(`/api/v1/vendor/orders/${orderId}/accept`, {
      prepTimeMinutes,
    });
    const payload = response.data?.data || response.data;
    return normalizeKDSOrder(payload);
  },

  /**
   * Reject incoming order with structured reason code and optional notes
   */
  async rejectOrder(
    orderId: string,
    reasonCode: string,
    reasonNotes?: string,
  ): Promise<KDSOrder> {
    const response = await apiClient.post(`/api/v1/vendor/orders/${orderId}/reject`, {
      reasonCode,
      reasonNotes,
    });
    const payload = response.data?.data || response.data;
    return normalizeKDSOrder(payload);
  },

  /**
   * Mark order as packaged and ready for rider pickup
   */
  async markOrderReady(orderId: string): Promise<KDSOrder> {
    const response = await apiClient.patch(`/api/v1/vendor/orders/${orderId}/ready`);
    const payload = response.data?.data || response.data;
    return normalizeKDSOrder(payload);
  },

  /**
   * Confirm food parcel handover to rider at store counter
   */
  async handoverOrder(orderId: string): Promise<KDSOrder> {
    const response = await apiClient.patch(`/api/v1/vendor/orders/${orderId}/handover`);
    const payload = response.data?.data || response.data;
    return normalizeKDSOrder(payload);
  },

  /**
   * Retrieve full outlet catalog for stock management (includes out-of-stock items)
   */
  async getOutletCatalog(vendorId?: string): Promise<OutletCatalog> {
    const params = vendorId && vendorId !== 'ALL' ? { vendorId } : undefined;
    const response = await apiClient.get('/api/v1/vendor/catalog', { params });
    const payload: RawBackendCatalog | undefined = response.data?.data || response.data;
    if (!payload || !payload.categories) {
      return {
        vendorId: vendorId || '',
        vendorName: payload?.vendorName || '',
        defaultPrepTimeMinutes: payload?.defaultPrepTimeMinutes || 20,
        categories: [],
      };
    }
    const categories: Category[] = payload.categories.map((cat: RawBackendCatalogCategory) => ({
      id: cat.id,
      vendorId: cat.vendorId,
      name: cat.name,
      displayOrder: cat.displayOrder,
      products: (cat.products || []).map((prod: RawBackendCatalogProduct) => ({
        id: prod.id,
        vendorId: prod.vendorId,
        categoryId: prod.categoryId,
        name: prod.name,
        description: prod.description,
        basePrice: prod.basePrice,
        unitType: prod.unitType,
        imageUrl: prod.imageUrl,
        isInStock: prod.isInStock,
        variants: (prod.variants || []).map((v: RawBackendCatalogVariant) => ({
          id: v.id,
          productId: v.productId,
          name: v.name,
          isInStock: v.isInStock,
          price: Number(v.price ?? v.priceDelta ?? v.priceModifier) || 0,
        })),
      })),
    }));
    return {
      vendorId: payload.vendorId || vendorId || '',
      vendorName: payload.vendorName || '',
      defaultPrepTimeMinutes: payload.defaultPrepTimeMinutes || 20,
      categories,
    };
  },

  /**
   * Instant toggle for product stock availability
   */
  async toggleProductStock(productId: string, isInStock: boolean): Promise<{ id: string; isInStock: boolean }> {
    const response = await apiClient.patch(`/api/v1/vendor/products/${productId}/stock`, {
      isInStock,
    });
    return response.data?.data || response.data;
  },

  /**
   * Instant toggle for product variant stock availability
   */
  async toggleVariantStock(variantId: string, isInStock: boolean): Promise<{ id: string; isInStock: boolean }> {
    const response = await apiClient.patch(`/api/v1/vendor/products/variants/${variantId}/stock`, {
      isInStock,
    });
    return response.data?.data || response.data;
  },

  /**
   * Get accessible outlets based on staff scope (Particular vs Brand Owner)
   */
  async getAccessibleOutlets(): Promise<
    Array<{
      id: string;
      name: string;
      addressText: string;
      isBusy: boolean;
      isActive: boolean;
      defaultPrepTimeMinutes: number;
      brandId?: string | null;
      brandName?: string | null;
    }>
  > {
    const response = await apiClient.get('/api/v1/vendor/outlets');
    const payload = response.data?.data || response.data;
    return Array.isArray(payload) ? payload : [];
  },

  /**
   * Get outlet settings and operating schedule
   */
  async getOutletSettings(vendorId?: string): Promise<{
    id: string;
    name: string;
    addressText: string;
    contactPhone: string;
    isBusy: boolean;
    isActive: boolean;
    commissionRate: number;
    defaultPrepTimeMinutes: number;
    brand?: { id: string; name: string } | null;
    operatingHours: Array<{
      id: string;
      dayOfWeek: number;
      openTime: string;
      closeTime: string;
      isClosed: boolean;
    }>;
  }> {
    const params = vendorId && vendorId !== 'ALL' ? { vendorId } : undefined;
    const response = await apiClient.get('/api/v1/vendor/settings', { params });
    return response.data?.data || response.data;
  },

  /**
   * Update outlet settings (prep time, emergency pause, active state)
   */
  async updateOutletSettings(
    vendorId: string,
    data: {
      defaultPrepTimeMinutes?: number;
      isBusy?: boolean;
      isActive?: boolean;
    }
  ) {
    const response = await apiClient.patch('/api/v1/vendor/settings', data, {
      params: { vendorId },
    });
    return response.data?.data || response.data;
  },

  /**
   * Update weekly operating schedule
   */
  async updateOperatingHours(
    vendorId: string,
    hours: Array<{
      dayOfWeek: number;
      openTime: string;
      closeTime: string;
      isClosed: boolean;
    }>
  ) {
    const response = await apiClient.put(
      '/api/v1/vendor/operating-hours',
      { hours },
      { params: { vendorId } }
    );
    return response.data?.data || response.data;
  },

  /**
   * Get daily sales ledger and commission breakdown
   */
  async getSalesLedger(vendorId?: string, dateFrom?: string, dateTo?: string): Promise<{
    summary: {
      totalOrders: number;
      grossSales: number;
      commissionDeducted: number;
      netVendorPayable: number;
    };
    ledgers: LedgerItem[];
  }> {
    const params: Record<string, string> = {};
    if (vendorId && vendorId !== 'ALL') params.vendorId = vendorId;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    const response = await apiClient.get('/api/v1/vendor/sales', { params });
    const payload = response.data?.data || response.data;
    if (!payload || typeof payload !== 'object') {
      return {
        summary: { totalOrders: 0, grossSales: 0, commissionDeducted: 0, netVendorPayable: 0 },
        ledgers: [],
      };
    }
    const ledgers: LedgerItem[] = Array.isArray(payload.ledgers)
      ? payload.ledgers
      : (Array.isArray(payload) ? payload : []);
    const summary = payload.summary || {
      totalOrders: ledgers.length,
      grossSales: 0,
      commissionDeducted: 0,
      netVendorPayable: 0,
    };
    return { summary, ledgers };
  },
};

export default kdsApi;

