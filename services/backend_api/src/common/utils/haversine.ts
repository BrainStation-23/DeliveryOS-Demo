/**
 * Great-circle distance between two WGS84 points in kilometres (haversine).
 * Returns undefined when either coordinate is missing.
 */
export function haversineKm(
  aLat: number | null | undefined,
  aLng: number | null | undefined,
  bLat: number | null | undefined,
  bLng: number | null | undefined,
): number | undefined {
  if (aLat == null || aLng == null || bLat == null || bLng == null) {
    return undefined;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(2 * earthRadiusKm * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) * 10) / 10;
}
