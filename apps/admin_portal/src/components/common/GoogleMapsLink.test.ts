import { describe, expect, it } from 'vitest';
import { buildGoogleMapsUrl } from './GoogleMapsLink';

describe('buildGoogleMapsUrl', () => {
  it('builds query with exact coordinates when valid latitude and longitude are supplied', () => {
    const url = buildGoogleMapsUrl(23.7808875, 90.4192534);
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=23.7808875,90.4192534');
  });

  it('prioritizes exact coordinates over address fallback string', () => {
    const url = buildGoogleMapsUrl(23.7808875, 90.4192534, 'House 12, Road 4, Banani');
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=23.7808875,90.4192534');
  });

  it('falls back to encoded address text when coordinates are null or undefined', () => {
    const url = buildGoogleMapsUrl(null, null, 'House 12, Road 4, Banani');
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=House%2012%2C%20Road%204%2C%20Banani');
  });

  it('falls back to encoded address text when coordinates are (0, 0)', () => {
    const url = buildGoogleMapsUrl(0, 0, 'Gulshan 2, Dhaka');
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=Gulshan%202%2C%20Dhaka');
  });

  it('returns null when both coordinates and address fallback are missing or empty', () => {
    expect(buildGoogleMapsUrl(null, null, null)).toBeNull();
    expect(buildGoogleMapsUrl(undefined, undefined, undefined)).toBeNull();
    expect(buildGoogleMapsUrl(null, null, '   ')).toBeNull();
    expect(buildGoogleMapsUrl(NaN, NaN, null)).toBeNull();
  });
});
