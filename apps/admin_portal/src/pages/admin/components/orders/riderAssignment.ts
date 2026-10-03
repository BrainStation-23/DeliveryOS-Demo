import { AdminOrder, FleetRider } from '../../../../services/adminApi';

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two GPS fixes (same formula as the backend
 *  haversine util) used to rank couriers by proximity to the outlet. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a)) * 10) / 10;
}

export interface AssignCandidate {
  rider: FleetRider;
  /** Outlet → courier distance; null when either side has no GPS fix. */
  distanceKm: number | null;
  /** Mirrors the backend force-assign guards; null when assignable now. */
  blockedReason: string | null;
}

/** Derives each courier's assignability (same invariants the API enforces on
 *  POST /admin/orders/:id/force-assign) and their distance from the outlet. */
export function buildAssignmentCandidates(fleet: FleetRider[], order: AdminOrder | null): AssignCandidate[] {
  const outletLat = order?.vendorLatitude ?? null;
  const outletLng = order?.vendorLongitude ?? null;

  const candidates: AssignCandidate[] = (fleet || []).map((rider) => {
    const hasFix = outletLat != null && outletLng != null && rider.latitude != null && rider.longitude != null;
    const distanceKm = hasFix
      ? haversineKm(outletLat as number, outletLng as number, rider.latitude as number, rider.longitude as number)
      : null;

    let blockedReason: string | null = null;
    if (rider.isApproved === false) {
      blockedReason = 'Pending approval';
    } else if (!rider.isOnline) {
      blockedReason = 'Off duty';
    } else if (rider.activeOrder) {
      blockedReason = 'On an active trip';
    }

    return { rider, distanceKm, blockedReason };
  });

  // Assignable couriers first, nearest to the outlet; blocked ones keep their
  // distance order below so the operator still sees the full on-duty picture.
  return candidates.sort((a, b) => {
    if (!!a.blockedReason !== !!b.blockedReason) return a.blockedReason ? 1 : -1;
    const aDist = a.distanceKm;
    const bDist = b.distanceKm;
    if (aDist == null && bDist == null) return a.rider.riderName.localeCompare(b.rider.riderName);
    if (aDist == null) return 1;
    if (bDist == null) return -1;
    return aDist - bDist;
  });
}

/** Client-side courier search over the candidate list (name / phone / vehicle). */
export function filterCandidatesByQuery(candidates: AssignCandidate[], query: string): AssignCandidate[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return candidates;
  return candidates.filter((c) => {
    if (!c.rider) return false;
    return (
      (c.rider.riderName || '').toLowerCase().includes(q) ||
      (c.rider.phone || '').includes(q) ||
      (c.rider.vehicleType || '').toLowerCase().includes(q)
    );
  });
}
