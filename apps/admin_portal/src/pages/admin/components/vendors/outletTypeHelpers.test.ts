import { describe, expect, it } from 'vitest';
import { AdminOutletType } from '../../../../services/adminApi';
import {
  calculateOutletTypeStats,
  canDeleteOutletType,
  filterAndSortOutletTypes,
  getAdjacentReorderSwap,
  slugify,
} from './outletTypeHelpers';

describe('outletTypeHelpers (Brands & Outlets)', () => {
  const mockTypes: AdminOutletType[] = [
    {
      id: 'type-1',
      name: 'Restaurant',
      slug: 'restaurant',
      isActive: true,
      sortOrder: 0,
      _count: { outlets: 9 },
    },
    {
      id: 'type-2',
      name: 'Super Shop',
      slug: 'super-shop',
      isActive: true,
      sortOrder: 1,
      _count: { outlets: 3 },
    },
    {
      id: 'type-3',
      name: 'Grocery',
      slug: 'grocery',
      isActive: true,
      sortOrder: 2,
      _count: { outlets: 2 },
    },
    {
      id: 'type-4',
      name: 'Pharmacy',
      slug: 'pharmacy',
      isActive: true,
      sortOrder: 3,
      _count: { outlets: 2 },
    },
    {
      id: 'type-5',
      name: 'Cafe',
      slug: 'cafe',
      isActive: false,
      sortOrder: 4,
      _count: { outlets: 2 },
    },
    {
      id: 'type-6',
      name: 'Unused Specialty',
      slug: 'unused-specialty',
      isActive: false,
      sortOrder: 5,
      _count: { outlets: 0 },
    },
  ];

  describe('slugify', () => {
    it('converts plain names to kebab-case', () => {
      expect(slugify('Super Shop')).toBe('super-shop');
      expect(slugify('Fast Food & Drinks')).toBe('fast-food-drinks');
    });

    it('handles uppercase, extra whitespace, and special characters', () => {
      expect(slugify('  Café & Bakery  ')).toBe('caf-bakery');
      expect(slugify('PHARMACY---24/7')).toBe('pharmacy-24-7');
    });

    it('preserves already valid kebab-case strings', () => {
      expect(slugify('restaurant')).toBe('restaurant');
      expect(slugify('pet-supplies-101')).toBe('pet-supplies-101');
    });
  });

  describe('calculateOutletTypeStats', () => {
    it('calculates aggregates across all types accurately', () => {
      const stats = calculateOutletTypeStats(mockTypes);
      expect(stats.total).toBe(6);
      expect(stats.visibleCount).toBe(4);
      expect(stats.hiddenCount).toBe(2);
      expect(stats.totalAssignedOutlets).toBe(18);
    });

    it('handles empty input gracefully', () => {
      const stats = calculateOutletTypeStats([]);
      expect(stats.total).toBe(0);
      expect(stats.visibleCount).toBe(0);
      expect(stats.hiddenCount).toBe(0);
      expect(stats.totalAssignedOutlets).toBe(0);
    });
  });

  describe('canDeleteOutletType', () => {
    it('blocks deletion when outlets are assigned to preserve FK integrity', () => {
      const guard = canDeleteOutletType(mockTypes[0]); // Restaurant (9 outlets)
      expect(guard.canDelete).toBe(false);
      expect(guard.assignedCount).toBe(9);
      expect(guard.reason).toContain('Cannot delete "Restaurant" because 9 outlets are currently assigned');
    });

    it('allows deletion when assigned outlet count is zero', () => {
      const guard = canDeleteOutletType(mockTypes[5]); // Unused Specialty (0 outlets)
      expect(guard.canDelete).toBe(true);
      expect(guard.assignedCount).toBe(0);
      expect(guard.reason).toBeUndefined();
    });
  });

  describe('filterAndSortOutletTypes', () => {
    it('returns all sorted by sortOrder asc by default', () => {
      const result = filterAndSortOutletTypes(mockTypes, '', 'all');
      expect(result).toHaveLength(6);
      expect(result[0].slug).toBe('restaurant');
      expect(result[result.length - 1].slug).toBe('unused-specialty');
    });

    it('filters by status: visible only', () => {
      const result = filterAndSortOutletTypes(mockTypes, '', 'visible');
      expect(result).toHaveLength(4);
      expect(result.every((t) => t.isActive)).toBe(true);
    });

    it('filters by status: hidden only', () => {
      const result = filterAndSortOutletTypes(mockTypes, '', 'hidden');
      expect(result).toHaveLength(2);
      expect(result.every((t) => !t.isActive)).toBe(true);
      expect(result.map((t) => t.slug)).toEqual(['cafe', 'unused-specialty']);
    });

    it('filters by search term matching name case-insensitively', () => {
      const result = filterAndSortOutletTypes(mockTypes, 'super', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Super Shop');
    });

    it('filters by search term matching slug', () => {
      const result = filterAndSortOutletTypes(mockTypes, 'pharm', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('pharmacy');
    });

    it('handles query with no match returning an empty list', () => {
      const result = filterAndSortOutletTypes(mockTypes, 'nonexistent', 'all');
      expect(result).toHaveLength(0);
    });
  });

  describe('getAdjacentReorderSwap', () => {
    it('returns null when trying to move the top item up', () => {
      const swap = getAdjacentReorderSwap(mockTypes, 0, 'up');
      expect(swap).toBeNull();
    });

    it('returns null when trying to move the bottom item down', () => {
      const swap = getAdjacentReorderSwap(mockTypes, mockTypes.length - 1, 'down');
      expect(swap).toBeNull();
    });

    it('swaps sortOrder with previous item when moving up', () => {
      const swap = getAdjacentReorderSwap(mockTypes, 1, 'up'); // Super Shop (sortOrder: 1) up with Restaurant (sortOrder: 0)
      expect(swap).toEqual([
        { id: 'type-2', sortOrder: 0 },
        { id: 'type-1', sortOrder: 1 },
      ]);
    });

    it('swaps sortOrder with next item when moving down', () => {
      const swap = getAdjacentReorderSwap(mockTypes, 0, 'down'); // Restaurant down with Super Shop
      expect(swap).toEqual([
        { id: 'type-1', sortOrder: 1 },
        { id: 'type-2', sortOrder: 0 },
      ]);
    });

    it('resolves collisions when items share identical sortOrder', () => {
      const colliding: AdminOutletType[] = [
        { ...mockTypes[0], sortOrder: 0 },
        { ...mockTypes[1], sortOrder: 0 },
      ];
      const swap = getAdjacentReorderSwap(colliding, 1, 'up');
      expect(swap).toEqual([
        { id: 'type-2', sortOrder: 0 },
        { id: 'type-1', sortOrder: 1 },
      ]);
    });
  });
});
