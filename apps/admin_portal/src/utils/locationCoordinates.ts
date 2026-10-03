/**
 * Geolocation coordinates formatting, validation, and regional defaults.
 */

export const DHAKA_DEFAULT: [number, number] = [23.7925, 90.4078];

export interface GeoAreaPreset {
  name: string;
  lat: number;
  lng: number;
}

export const POPULAR_AREAS: GeoAreaPreset[] = [
  { name: 'Gulshan', lat: 23.7925, lng: 90.4078 },
  { name: 'Banani', lat: 23.7937, lng: 90.4043 },
  { name: 'Uttara', lat: 23.8759, lng: 90.3796 },
  { name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
  { name: 'Mirpur', lat: 23.8071, lng: 90.3686 },
  { name: 'Motijheel', lat: 23.733, lng: 90.4172 },
];

export function formatCoordinates(lat?: number | null, lng?: number | null): string {
  if (
    typeof lat !== 'number' ||
    !Number.isFinite(lat) ||
    typeof lng !== 'number' ||
    !Number.isFinite(lng)
  ) {
    return 'No location selected';
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function isValidCoordinate(lat?: number | null, lng?: number | null): boolean {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}
