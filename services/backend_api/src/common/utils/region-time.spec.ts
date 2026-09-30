import { getCurrentRegionTimeParts, getRegionTimezone, isWithinOperatingHours, startOfRegionToday } from './region-time';

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

  describe('startOfRegionToday', () => {
    afterEach(() => {
      process.env.REGION_MODE = 'BD';
      jest.useRealTimers();
    });

    it('returns the UTC instant of Asia/Dhaka local midnight (day starts at 18:00 UTC)', () => {
      jest.useFakeTimers();
      // 15:00 UTC on Jan 10 is 21:00 Dhaka the same calendar day; Dhaka's
      // Jan 10 began at Jan 9 18:00 UTC (+6 offset).
      jest.setSystemTime(new Date('2026-01-10T15:00:00Z'));

      const midnight = startOfRegionToday();
      expect(midnight.toISOString()).toBe('2026-01-09T18:00:00.000Z');
    });

    it('rolls to the next UTC-day boundary after Dhaka midnight', () => {
      jest.useFakeTimers();
      // 19:30 UTC on Jan 10 is 01:30 Dhaka on Jan 11; local midnight is Jan 10 18:00 UTC.
      jest.setSystemTime(new Date('2026-01-10T19:30:00Z'));

      const midnight = startOfRegionToday();
      expect(midnight.toISOString()).toBe('2026-01-10T18:00:00.000Z');
    });

    it('honors the KSA region preset (Riyadh, UTC+3)', () => {
      process.env.REGION_MODE = 'KSA';
      jest.useFakeTimers();
      // 10:00 UTC is 13:00 Riyadh; Riyadh midnight was 21:00 UTC the prior day.
      jest.setSystemTime(new Date('2026-01-10T10:00:00Z'));

      const midnight = startOfRegionToday();
      expect(midnight.toISOString()).toBe('2026-01-09T21:00:00.000Z');
    });

    it('resolves the configured timezone identifier', () => {
      expect(getRegionTimezone()).toBe('Asia/Dhaka');
      process.env.REGION_MODE = 'KSA';
      expect(getRegionTimezone()).toBe('Asia/Riyadh');
      process.env.REGION_MODE = 'UNKNOWN';
      expect(getRegionTimezone()).toBe('Asia/Dhaka');
    });
  });
});
