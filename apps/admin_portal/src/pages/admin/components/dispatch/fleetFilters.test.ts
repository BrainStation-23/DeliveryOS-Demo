import { describe, expect, it } from 'vitest';
import { FleetRider } from '../../../../services/adminApi';
import { computeFleetStats, filterFleet } from './fleetFilters';

const rider = (overrides: Partial<FleetRider>): FleetRider => ({
  id: 'rider-1',
  userId: 'user-1',
  riderName: 'Kamal Hossain',
  phone: '+8801700000010',
  vehicleType: 'MOTORBIKE',
  isOnline: true,
  isApproved: true,
  status: 'ONLINE',
  cashInHand: 0,
  maxCashLimit: 5000,
  cashSafetyWarning: false,
  latitude: null,
  longitude: null,
  activeOrder: null,
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

const fleet = [
  rider({ id: 'r-1', riderName: 'Kamal Hossain', status: 'ONLINE', isOnline: true }),
  rider({ id: 'r-2', riderName: 'Jamal Uddin', status: 'ON_TRIP', isOnline: true, vehicleType: 'BICYCLE' }),
  rider({ id: 'r-3', riderName: 'Rafiq Islam', status: 'OFFLINE', isOnline: false, isApproved: false }),
  rider({ id: 'r-4', riderName: 'Salam Sheikh', status: 'ONLINE', isOnline: true, cashSafetyWarning: true }),
];

describe('filterFleet', () => {
  it('returns every rider for the ALL/ALL filters with an empty query', () => {
    expect(
      filterFleet(fleet, { statusFilter: 'ALL', approvalFilter: 'ALL', searchQuery: '' }),
    ).toHaveLength(4);
  });

  it('filters by status, approval, and search text together', () => {
    const result = filterFleet(fleet, {
      statusFilter: 'ONLINE',
      approvalFilter: 'APPROVED',
      searchQuery: 'salam',
    });
    expect(result.map((r) => r.id)).toEqual(['r-4']);

    const pending = filterFleet(fleet, {
      statusFilter: 'ALL',
      approvalFilter: 'PENDING',
      searchQuery: '',
    });
    expect(pending.map((r) => r.id)).toEqual(['r-3']);
  });

  it('matches search against name, phone, and vehicle type case-insensitively', () => {
    expect(
      filterFleet(fleet, { statusFilter: 'ALL', approvalFilter: 'ALL', searchQuery: 'JAMAL' }).map((r) => r.id),
    ).toEqual(['r-2']);
    expect(
      filterFleet(fleet, { statusFilter: 'ALL', approvalFilter: 'ALL', searchQuery: 'bicycle' }).map((r) => r.id),
    ).toEqual(['r-2']);
    expect(
      filterFleet(fleet, { statusFilter: 'ALL', approvalFilter: 'ALL', searchQuery: '+8801700000010' }).map((r) => r.id),
    ).toEqual(['r-1', 'r-2', 'r-3', 'r-4']);
  });

  it('tolerates non-array fleet payloads defensively', () => {
    expect(
      filterFleet(undefined as unknown as FleetRider[], {
        statusFilter: 'ALL',
        approvalFilter: 'ALL',
        searchQuery: '',
      }),
    ).toEqual([]);
  });
});

describe('computeFleetStats', () => {
  it('counts online, on-trip, idle, cash-warning, and pending-approval riders', () => {
    expect(computeFleetStats(fleet)).toEqual({
      onlineCount: 3,
      onTripCount: 1,
      idleCount: 2,
      safetyWarningsCount: 1,
      pendingApplicantsCount: 1,
    });
  });

  it('returns zeroed stats for an empty fleet', () => {
    expect(computeFleetStats([])).toEqual({
      onlineCount: 0,
      onTripCount: 0,
      idleCount: 0,
      safetyWarningsCount: 0,
      pendingApplicantsCount: 0,
    });
  });

  it('does not classify suspended riders as pending applicants', () => {
    const fleetWithSuspended = [
      ...fleet,
      rider({ id: 'r-5', riderName: 'Suspended Rider', isApproved: true, userStatus: 'SUSPENDED' }),
    ];
    const stats = computeFleetStats(fleetWithSuspended);
    expect(stats.pendingApplicantsCount).toBe(1);
  });
});
