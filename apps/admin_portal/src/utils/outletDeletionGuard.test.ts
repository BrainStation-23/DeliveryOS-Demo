import { describe, it, expect } from 'vitest';
import { canDeleteOutlet } from './outletDeletionGuard';

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

});
