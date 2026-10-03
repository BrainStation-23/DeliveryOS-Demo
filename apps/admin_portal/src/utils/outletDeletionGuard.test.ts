import { describe, it, expect } from 'vitest';
import { canDeleteOutlet, getOutletDeletionBlockingReasons } from './outletDeletionGuard';

describe('outletDeletionGuard', () => {
  describe('canDeleteOutlet', () => {
    it('returns true when staff, categories, and items are all 0', () => {
      expect(
        canDeleteOutlet({
          staffCount: 0,
          categoryCount: 0,
          itemCount: 0,
        }),
      ).toBe(true);
    });

    it('returns false when outlet has tagged staff', () => {
      expect(
        canDeleteOutlet({
          staffCount: 1,
          categoryCount: 0,
          itemCount: 0,
        }),
      ).toBe(false);

      expect(
        canDeleteOutlet({
          staffCount: 5,
          categoryCount: 0,
          itemCount: 0,
        }),
      ).toBe(false);
    });

    it('returns false when outlet has categories', () => {
      expect(
        canDeleteOutlet({
          staffCount: 0,
          categoryCount: 1,
          itemCount: 0,
        }),
      ).toBe(false);

      expect(
        canDeleteOutlet({
          staffCount: 0,
          categoryCount: 4,
          itemCount: 0,
        }),
      ).toBe(false);
    });

    it('returns false when outlet has items / products', () => {
      expect(
        canDeleteOutlet({
          staffCount: 0,
          categoryCount: 0,
          itemCount: 1,
        }),
      ).toBe(false);

      expect(
        canDeleteOutlet({
          staffCount: 0,
          categoryCount: 0,
          itemCount: 12,
        }),
      ).toBe(false);
    });

    it('returns false when multiple or all conditions are non-zero', () => {
      expect(
        canDeleteOutlet({
          staffCount: 2,
          categoryCount: 3,
          itemCount: 10,
        }),
      ).toBe(false);

      expect(
        canDeleteOutlet({
          staffCount: 1,
          categoryCount: 0,
          itemCount: 5,
        }),
      ).toBe(false);
    });
  });

  describe('getOutletDeletionBlockingReasons', () => {
    it('returns empty array when outlet is completely empty', () => {
      expect(
        getOutletDeletionBlockingReasons({
          staffCount: 0,
          categoryCount: 0,
          itemCount: 0,
        }),
      ).toEqual([]);
    });

    it('includes tagged staff, category, and item counts when blocked', () => {
      const reasons = getOutletDeletionBlockingReasons({
        staffCount: 3,
        categoryCount: 2,
        itemCount: 8,
        orderCount: 1,
      });

      expect(reasons).toHaveLength(4);
      expect(reasons).toContain('3 tagged staff assignment(s)');
      expect(reasons).toContain('2 category/categories');
      expect(reasons).toContain('8 item(s)');
      expect(reasons).toContain('1 historical order(s)');
    });
  });
});
