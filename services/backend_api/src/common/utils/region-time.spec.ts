import { getCurrentRegionTimeParts, isWithinOperatingHours } from './region-time';

describe('Region time (vendor-local operating hours)', () => {
  describe('isWithinOperatingHours', () => {
    it('accepts times inside a same-day window inclusively', () => {
      expect(isWithinOperatingHours('10:00:00', '10:00', '23:00')).toBe(true);
      expect(isWithinOperatingHours('23:00:00', '10:00', '23:00')).toBe(true);
      expect(isWithinOperatingHours('12:30:45', '10:00', '23:00')).toBe(true);
    });

    it('rejects times outside a same-day window', () => {
      expect(isWithinOperatingHours('09:59:59', '10:00', '23:00')).toBe(false);
      expect(isWithinOperatingHours('23:00:01', '10:00', '23:00')).toBe(false);
      expect(isWithinOperatingHours('03:00:00', '10:00', '23:00')).toBe(false);
    });

    it('handles overnight windows (e.g. 18:00 - 02:00)', () => {
      expect(isWithinOperatingHours('18:00:00', '18:00', '02:00')).toBe(true);
      expect(isWithinOperatingHours('23:30:00', '18:00', '02:00')).toBe(true);
      expect(isWithinOperatingHours('01:59:59', '18:00', '02:00')).toBe(true);
      expect(isWithinOperatingHours('02:00:00', '18:00', '02:00')).toBe(true);
      expect(isWithinOperatingHours('12:00:00', '18:00', '02:00')).toBe(false);
    });

    it('accepts both HH:mm and HH:mm:ss window formats', () => {
      expect(isWithinOperatingHours('10:00:00', '10:00:00', '23:00:00')).toBe(true);
    });
  });

  describe('getCurrentRegionTimeParts', () => {
    it('returns a valid weekday index and HH:mm:ss wall clock', () => {
      const { dayOfWeek, timeHHmmss } = getCurrentRegionTimeParts();
      expect(dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(dayOfWeek).toBeLessThanOrEqual(6);
      expect(timeHHmmss).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('uses the region wall clock, not the server UTC clock', () => {
      // 2025-12-31T20:00:00Z is Wednesday 20:00 UTC but already Thursday 02:00 in
      // Asia/Dhaka (+6) — the day-of-week rollover proves the offset is applied.
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-12-31T20:00:00Z'));

      const { dayOfWeek, timeHHmmss } = getCurrentRegionTimeParts();
      expect(dayOfWeek).toBe(4); // Thursday, not Wednesday
      expect(timeHHmmss).toBe('02:00:00');

      jest.useRealTimers();
    });
  });
});
