import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
}));

vi.mock('./apiClient', () => ({
  default: {
    get: getMock,
    post: postMock,
    patch: patchMock,
  },
  ADMIN_TOKEN_KEY: 'deliveryos_admin_token',
  ADMIN_REFRESH_KEY: 'deliveryos_admin_refresh',
  ADMIN_USER_KEY: 'deliveryos_admin_user',
  ensureFreshToken: vi.fn().mockResolvedValue(null),
  isTokenExpired: vi.fn().mockReturnValue(false),
}));

import adminApi from './adminApi';

describe('adminApi settings and settlements methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('fetches dispatch timing and delivery fee rules', async () => {
      const mockSettings = {
        dispatch: { rider_search_timeout_seconds: 45, stale_order_ttl_minutes: 60 },
        deliveryFee: {
          mode: 'DISTANCE_TIERED',
          flatFee: 50,
          baseFee: 40,
          baseKm: 2,
          perKmRate: 15,
        },
      };
      getMock.mockResolvedValue({ data: { data: mockSettings } });

      const result = await adminApi.getSettings();

      expect(getMock).toHaveBeenCalledWith('/api/v1/admin/settings');
      expect(result).toEqual(mockSettings);
    });
  });

  describe('updateDispatchTiming', () => {
    it('patches dispatch timing knobs', async () => {
      patchMock.mockResolvedValue({
        data: { data: { rider_search_timeout_seconds: 60, stale_order_ttl_minutes: 45 } },
      });

      const result = await adminApi.updateDispatchTiming({ riderSearchTimeoutSeconds: 60, staleOrderTtlMinutes: 45 });

      expect(patchMock).toHaveBeenCalledWith('/api/v1/admin/settings/dispatch', {
        riderSearchTimeoutSeconds: 60,
        staleOrderTtlMinutes: 45,
      });
      expect(result).toEqual({ rider_search_timeout_seconds: 60, stale_order_ttl_minutes: 45 });
    });
  });

  describe('outlet types', () => {
    const type = { id: 'type-1', name: 'Restaurant', slug: 'restaurant', isActive: true, sortOrder: 0 };

    it('lists outlet types', async () => {
      getMock.mockResolvedValue({ data: { data: [type] } });

      const result = await adminApi.listOutletTypes();

      expect(getMock).toHaveBeenCalledWith('/api/v1/admin/outlet-types');
      expect(result).toEqual([type]);
    });

    it('creates an outlet type', async () => {
      postMock.mockResolvedValue({ data: { data: type } });

      const result = await adminApi.createOutletType({ name: 'Restaurant', slug: 'restaurant', sortOrder: 0 });

      expect(postMock).toHaveBeenCalledWith('/api/v1/admin/outlet-types', {
        name: 'Restaurant',
        slug: 'restaurant',
        sortOrder: 0,
      });
      expect(result.slug).toBe('restaurant');
    });

    it('toggles outlet type visibility', async () => {
      patchMock.mockResolvedValue({ data: { data: { ...type, isActive: false } } });

      const result = await adminApi.updateOutletType('type-1', { isActive: false });

      expect(patchMock).toHaveBeenCalledWith('/api/v1/admin/outlet-types/type-1', { isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('fetches outlets assigned to an outlet type', async () => {
      const mockResponse = {
        type: { id: 'type-1', name: 'Restaurant', slug: 'restaurant' },
        outlets: [
          {
            id: 'v-1',
            name: 'Gulshan Branch',
            brandId: 'b-1',
            brandName: 'Burger King',
            brandLogoUrl: null,
            addressText: 'Gulshan',
            contactPhone: '+8801700000002',
            latitude: 23.79,
            longitude: 90.41,
            isActive: true,
            isBusy: false,
            orderFlowMode: 'RIDER_FIRST',
            commissionRate: 15,
            defaultPrepTimeMinutes: 20,
            deliveryRadiusKm: 5,
            totalProducts: 10,
            totalOrders: 30,
            createdAt: '2026-01-01',
          },
        ],
      };
      getMock.mockResolvedValue({ data: { data: mockResponse } });

      const result = await adminApi.getOutletTypeOutlets('type-1');

      expect(getMock).toHaveBeenCalledWith('/api/v1/admin/outlet-types/type-1/outlets');
      expect(result.outlets).toHaveLength(1);
      expect(result.outlets[0].name).toBe('Gulshan Branch');
    });
  });

  describe('updateDeliveryFeeMode', () => {
    it('patches delivery fee economics settings', async () => {
      patchMock.mockResolvedValue({
        data: { message: 'Delivery fee settings updated' },
      });

      const result = await adminApi.updateDeliveryFeeMode({
        mode: 'FIXED_FLAT',
        flatFee: 60,
      });

      expect(patchMock).toHaveBeenCalledWith('/api/v1/admin/settings/delivery-fee', {
        mode: 'FIXED_FLAT',
        flatFee: 60,
      });
      expect(result.message).toBe('Delivery fee settings updated');
    });
  });

  describe('getSettlementStatements', () => {
    it('fetches and normalizes vendor settlement statements', async () => {
      const statements = [
        {
          vendorId: 'v-1',
          vendorName: 'Burger Lab',
          brandName: 'Burger Lab Banani',
          totalOrders: 10,
          grossSales: 5000,
          platformCommission: 750,
          netVendorPayable: 4250,
          settlementStatus: 'PENDING',
        },
      ];
      getMock.mockResolvedValue({ data: { data: statements } });

      const result = await adminApi.getSettlementStatements();

      expect(getMock).toHaveBeenCalledWith('/api/v1/admin/finance/settlement-export', {
        params: { format: 'json' },
      });
      expect(result).toEqual(statements);
    });

    it('returns empty array when API response data is not an array', async () => {
      getMock.mockResolvedValue({ data: { data: null } });

      const result = await adminApi.getSettlementStatements();
      expect(result).toEqual([]);
    });
  });

  describe('getSettlementBatches', () => {
    it('fetches list of closed settlement batches', async () => {
      const batches = [
        {
          id: 'batch-1',
          batchNumber: 'SETTLE-20261001-001',
          startDate: '2026-09-24T00:00:00Z',
          endDate: '2026-10-01T00:00:00Z',
          totalOrders: 25,
          totalVendorPayout: 12500,
          totalRiderPayout: 2500,
          totalPlatformMargin: 3000,
          status: 'COMPLETED',
          executedByUserId: 'admin-1',
          executedAt: '2026-10-01T12:00:00Z',
        },
      ];
      getMock.mockResolvedValue({ data: { data: batches } });

      const result = await adminApi.getSettlementBatches();

      expect(getMock).toHaveBeenCalledWith('/api/v1/admin/finance/settlement-batches');
      expect(result).toEqual(batches);
    });
  });

  describe('executeSettlementCycle', () => {
    it('executes a settlement cycle with optional audit notes', async () => {
      const payload = {
        message: 'Settlement cycle closed successfully.',
        settledOrdersCount: 20,
        batch: {
          id: 'batch-2',
          batchNumber: 'SETTLE-20261001-002',
        },
      };
      postMock.mockResolvedValue({ data: payload });

      const result = await adminApi.executeSettlementCycle('Weekly settlement');

      expect(postMock).toHaveBeenCalledWith('/api/v1/admin/finance/settle-cycle', {
        notes: 'Weekly settlement',
      });
      expect(result.message).toBe('Settlement cycle closed successfully.');
      expect(result.settledOrdersCount).toBe(20);
    });
  });
});
