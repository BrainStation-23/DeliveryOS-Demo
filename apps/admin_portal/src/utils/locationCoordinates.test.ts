import { describe, expect, it } from 'vitest';
import {
  DHAKA_DEFAULT,
  POPULAR_AREAS,
  formatCoordinates,
  isValidCoordinate,
} from './locationCoordinates';

describe('locationCoordinates utilities', () => {
  describe('formatCoordinates', () => {
    it('formats valid floating coordinates to 5 decimal places', () => {
      expect(formatCoordinates(23.79251234, 90.40781234)).toBe('23.79251, 90.40781');
    });

    it('handles negative coordinates correctly', () => {
      expect(formatCoordinates(-33.868812, 151.209312)).toBe('-33.86881, 151.20931');
    });

    it('returns "No location selected" for invalid or missing coordinates', () => {
      expect(formatCoordinates(null, null)).toBe('No location selected');
      expect(formatCoordinates(undefined, undefined)).toBe('No location selected');
      expect(formatCoordinates(NaN, 90.4)).toBe('No location selected');
      expect(formatCoordinates(23.7, NaN)).toBe('No location selected');
      expect(formatCoordinates(Infinity, 90.4)).toBe('No location selected');
    });
  });

  describe('isValidCoordinate', () => {
    it('validates realistic coordinates within bounds', () => {
      expect(isValidCoordinate(23.7925, 90.4078)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
      expect(isValidCoordinate(90, 180)).toBe(true);
    });

    it('rejects coordinates out of latitude bounds [-90, 90]', () => {
      expect(isValidCoordinate(90.0001, 90)).toBe(false);
      expect(isValidCoordinate(-90.0001, 90)).toBe(false);
    });

    it('rejects coordinates out of longitude bounds [-180, 180]', () => {
      expect(isValidCoordinate(23.7, 180.0001)).toBe(false);
      expect(isValidCoordinate(23.7, -180.0001)).toBe(false);
    });

    it('rejects non-numeric, null, undefined, or NaN inputs', () => {
      expect(isValidCoordinate(null, null)).toBe(false);
      expect(isValidCoordinate(undefined, undefined)).toBe(false);
      expect(isValidCoordinate(NaN, 90)).toBe(false);
      expect(isValidCoordinate(23, NaN)).toBe(false);
    });
  });

  describe('DHAKA_DEFAULT and POPULAR_AREAS constants', () => {
    it('provides valid Dhaka fallback coordinates', () => {
      expect(isValidCoordinate(DHAKA_DEFAULT[0], DHAKA_DEFAULT[1])).toBe(true);
    });

    it('ensures all popular quick-jump areas have valid coordinates within Bangladesh', () => {
      expect(POPULAR_AREAS.length).toBeGreaterThan(0);
      POPULAR_AREAS.forEach((area) => {
        expect(area.name).toBeTruthy();
        expect(isValidCoordinate(area.lat, area.lng)).toBe(true);
        expect(area.lat).toBeGreaterThan(20);
        expect(area.lat).toBeLessThan(27);
        expect(area.lng).toBeGreaterThan(88);
        expect(area.lng).toBeLessThan(93);
      });
    });
  });
});
