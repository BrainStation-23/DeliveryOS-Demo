import { FleetRider } from '../../../../services/adminApi';

export type FleetStatusFilter = 'ALL' | 'ONLINE' | 'ON_TRIP' | 'OFFLINE';
export type FleetApprovalFilter = 'ALL' | 'APPROVED' | 'PENDING';

export interface FleetFilterCriteria {
  statusFilter: FleetStatusFilter;
  approvalFilter: FleetApprovalFilter;
  searchQuery: string;
}

export function filterFleet(riders: FleetRider[], criteria: FleetFilterCriteria): FleetRider[] {
  const { statusFilter, approvalFilter, searchQuery } = criteria;
  const q = (searchQuery || '').toLowerCase();
  return (Array.isArray(riders) ? riders : []).filter((r) => {
    if (!r) return false;
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesApproval =
      approvalFilter === 'ALL' ||
      (approvalFilter === 'APPROVED' && r.isApproved !== false) ||
      (approvalFilter === 'PENDING' && r.isApproved === false);
    const matchesSearch =
      (r.riderName || '').toLowerCase().includes(q) ||
      (r.phone || '').includes(q) ||
      (r.vehicleType || '').toLowerCase().includes(q);
    return matchesStatus && matchesApproval && matchesSearch;
  });
}

export interface FleetStats {
  onlineCount: number;
  onTripCount: number;
  idleCount: number;
  safetyWarningsCount: number;
  pendingApplicantsCount: number;
}

export function computeFleetStats(riders: FleetRider[]): FleetStats {
  const safeRiders = Array.isArray(riders) ? riders : [];
  return {
    onlineCount: safeRiders.filter((r) => Boolean(r && r.isOnline)).length,
    onTripCount: safeRiders.filter((r) => Boolean(r && r.status === 'ON_TRIP')).length,
    idleCount: safeRiders.filter((r) => Boolean(r && r.status === 'ONLINE')).length,
    safetyWarningsCount: safeRiders.filter((r) => Boolean(r && r.cashSafetyWarning)).length,
    pendingApplicantsCount: safeRiders.filter((r) => Boolean(r && r.isApproved === false)).length,
  };
}
