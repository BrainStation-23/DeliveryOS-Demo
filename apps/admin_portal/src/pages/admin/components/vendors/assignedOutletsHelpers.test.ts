import { describe, expect, it } from 'vitest';
import { AssignedOutletRow } from '../../../../services/adminApi';
import {
  calculateAssignedOutletsStats,
  filterAssignedOutlets,
  formatOutletRowTitle,
} from './assignedOutletsHelpers';

describe('assignedOutletsHelpers', () => {
  const mockOutlets: AssignedOutletRow[] = [
    {
      id: 'v-1',
      name: 'Gulshan Branch',
      brandId: 'b-1',
      brandName: 'Burger King',
      brandLogoUrl: 'https://example.com/bk.png',
      addressText: 'Plot 15, Kamal Ataturk Ave, Gulshan 2',
      contactPhone: '+8801711000001',
      latitude: 23.7925,
      longitude: 90.4078,
      isActive: true,
      isBusy: false,
      orderFlowMode: 'RIDER_FIRST',
      commissionRate: 15,
      defaultPrepTimeMinutes: 15,
      deliveryRadiusKm: 5,
      totalProducts: 12,
      totalOrders: 47,
      createdAt: '2025-03-25T07:12:39.594Z',
    },
    {
      id: 'v-2',
      name: 'Dhanmondi Branch',
      brandId: 'b-1',
      brandName: 'Burger King',
      brandLogoUrl: 'https://example.com/bk.png',
      addressText: 'Road 27, Dhanmondi, Dhaka',
      contactPhone: '+8801711000002',
      latitude: 23.7461,
      longitude: 90.3742,
      isActive: true,
      isBusy: true,
      orderFlowMode: 'RIDER_FIRST',
      commissionRate: 15,
      defaultPrepTimeMinutes: 18,
      deliveryRadiusKm: 4.5,
      totalProducts: 7,
      totalOrders: 25,
      createdAt: '2025-04-20T07:12:39.594Z',
    },
    {
      id: 'v-3',
      name: 'Banani',
      brandId: 'b-2',
      brandName: "Sultan's Dine",
      brandLogoUrl: null,
      addressText: 'Road 12, Banani, Dhaka',
      contactPhone: '+8801711000005',
      latitude: 23.7941,
      longitude: 90.4025,
      isActive: false,
      isBusy: false,
      orderFlowMode: 'VENDOR_FIRST',
      commissionRate: 18,
      defaultPrepTimeMinutes: 30,
      deliveryRadiusKm: 5,
      totalProducts: 5,
      totalOrders: 10,
      createdAt: '2025-09-23T07:12:39.594Z',
    },
  ];

  describe('filterAssignedOutlets', () => {
    it('returns all outlets when search query is empty or whitespace', () => {
      expect(filterAssignedOutlets(mockOutlets, '')).toHaveLength(3);
      expect(filterAssignedOutlets(mockOutlets, '   ')).toHaveLength(3);
    });

    it('filters by outlet name case-insensitively', () => {
      const result = filterAssignedOutlets(mockOutlets, 'gulshan');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('v-1');
    });

    it('filters by brand name', () => {
      const result = filterAssignedOutlets(mockOutlets, "Sultan's");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('v-3');
    });

    it('filters by physical address keywords', () => {
      const result = filterAssignedOutlets(mockOutlets, 'Dhanmondi');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('v-2');
    });

    it('filters by contact phone number', () => {
      const result = filterAssignedOutlets(mockOutlets, '000005');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('v-3');
    });

    it('returns empty array when query does not match any property', () => {
      expect(filterAssignedOutlets(mockOutlets, 'non-existent-keyword')).toHaveLength(0);
    });
  });

  describe('formatOutletRowTitle', () => {
    it('prepends brand name if not already included in outlet name', () => {
      expect(formatOutletRowTitle(mockOutlets[0])).toBe('Burger King - Gulshan Branch');
      expect(formatOutletRowTitle(mockOutlets[2])).toBe("Sultan's Dine - Banani");
    });

    it('does not duplicate brand name if already included in outlet name', () => {
      const outletWithBrandInName: AssignedOutletRow = {
        ...mockOutlets[0],
        name: 'Burger King Banani Express',
        brandName: 'Burger King',
      };
      expect(formatOutletRowTitle(outletWithBrandInName)).toBe('Burger King Banani Express');
    });

    it('returns name directly if brandName is null', () => {
      const outletWithoutBrand: AssignedOutletRow = {
        ...mockOutlets[0],
        brandName: null,
      };
      expect(formatOutletRowTitle(outletWithoutBrand)).toBe('Gulshan Branch');
    });
  });

  describe('calculateAssignedOutletsStats', () => {
    it('aggregates counts and status metrics accurately', () => {
      const stats = calculateAssignedOutletsStats(mockOutlets);
      expect(stats.total).toBe(3);
      expect(stats.activeCount).toBe(2);
      expect(stats.suspendedCount).toBe(1);
      expect(stats.busyCount).toBe(1);
      expect(stats.acceptingCount).toBe(2);
      expect(stats.totalOrders).toBe(82); // 47 + 25 + 10
      expect(stats.totalProducts).toBe(24); // 12 + 7 + 5
    });

    it('handles empty outlets list safely', () => {
      const stats = calculateAssignedOutletsStats([]);
      expect(stats.total).toBe(0);
      expect(stats.activeCount).toBe(0);
      expect(stats.suspendedCount).toBe(0);
      expect(stats.totalOrders).toBe(0);
    });
  });
});
