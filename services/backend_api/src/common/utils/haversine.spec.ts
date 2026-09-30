import { haversineKm } from './haversine';

describe('haversineKm', () => {
  it('computes a known Dhaka intra-city distance to 1-decimal precision', () => {
    // Dhanmondi (23.7461, 90.3760) → Gulshan-2 (23.7925, 90.4141) ≈ 6.5 km
    expect(haversineKm(23.7461, 90.376, 23.7925, 90.4141)).toBe(6.5);
  });

  it('returns 0 for identical points', () => {
    expect(haversineKm(23.7925, 90.4078, 23.7925, 90.4078)).toBe(0);
  });

  it('is symmetric in argument order', () => {
    expect(haversineKm(23.7461, 90.376, 23.7925, 90.4141)).toBe(
      haversineKm(23.7925, 90.4141, 23.7461, 90.376),
    );
  });

  it('returns undefined when any coordinate is missing', () => {
    expect(haversineKm(null, 90.4078, 23.7925, 90.4141)).toBeUndefined();
    expect(haversineKm(23.7925, undefined, 23.7925, 90.4141)).toBeUndefined();
    expect(haversineKm(23.7925, 90.4078, null, 90.4141)).toBeUndefined();
    expect(haversineKm(23.7925, 90.4078, 23.7925, null)).toBeUndefined();
  });
});
