import { describe, expect, it } from 'vitest';
import { AdminOrder, FleetRider } from '../../../../services/adminApi';
import { buildAssignmentCandidates, filterCandidatesByQuery, haversineKm } from './riderAssignment';

const rider = (overrides: Partial<FleetRider>): FleetRider => ({
  id: 'rider-x',
  userId: 'user-x',
  riderName: 'Courier X',
  phone: '+8801700000000',
  vehicleType: 'motorcycle',
  isOnline: true,
  status: 'ONLINE',
  cashInHand: 0,
  maxCashLimit: 5000,
  cashSafetyWarning: false,
  latitude: null,
  longitude: null,
  activeOrder: null,
  updatedAt: '2026-10-02T00:00:00.000Z',
  ...overrides,
});

const order = (overrides: Partial<AdminOrder>): AdminOrder => ({
  id: 'order-1',
  orderNumber: 'ORD-1',
  vendorId: 'vendor-1',
  vendorName: 'Kacchi Bhai',
  vendorAddress: 'Gulshan 2',
  customerId: 'customer-1',
  customerName: 'Nusrat',
  customerPhone: '+8801711111111',
  riderId: null,
  riderName: null,
  riderPhone: null,
  status: 'PLACED',
  paymentMethod: 'CASH_ON_DELIVERY',
  paymentStatus: 'PENDING',
  totalAmount: 500,
  deliveryFee: 50,
  placedAt: '2026-10-02T00:00:00.000Z',
  items: [],
  deliveryAddress: 'Banani',
  ...overrides,
});

describe('haversineKm', () => {
  it('returns zero for identical fixes', () => {
    expect(haversineKm(23.8103, 90.4125, 23.8103, 90.4125)).toBe(0);
  });

  it('computes rounded real-world distances', () => {
    // Dhaka (Gulshan) → Uttara is roughly 13–14 km straight line.
    const km = haversineKm(23.7925, 90.4078, 23.8759, 90.3796);
    expect(km).toBeGreaterThan(8);
    expect(km).toBeLessThan(18);
  });
});

describe('buildAssignmentCandidates', () => {
  const outletOrder = order({ vendorLatitude: 23.7925, vendorLongitude: 90.4078 });

  it('sorts assignable couriers by outlet proximity, nearest first', () => {
    const near = rider({ id: 'near', riderName: 'Near Rider', latitude: 23.793, longitude: 90.408 });
    const far = rider({ id: 'far', riderName: 'Far Rider', latitude: 23.8759, longitude: 90.3796 });
    const candidates = buildAssignmentCandidates([far, near], outletOrder);

    expect(candidates.map((c) => c.rider.id)).toEqual(['near', 'far']);
    expect(candidates[0].blockedReason).toBeNull();
    expect(candidates[0].distanceKm).toBeLessThan(candidates[1].distanceKm as number);
  });

  it('pushes blocked couriers (off duty / pending / mid-trip) below assignable ones with reasons', () => {
    const offline = rider({ id: 'off', riderName: 'Off', isOnline: false, status: 'OFFLINE' });
    const pending = rider({ id: 'pend', riderName: 'Pend', isApproved: false });
    const onTrip = rider({
      id: 'trip',
      riderName: 'Trip',
      status: 'ON_TRIP',
      activeOrder: { id: 'o2', orderNumber: 'ORD-2', status: 'DISPATCHED' },
    });
    const ready = rider({ id: 'ready', riderName: 'Ready' });

    const candidates = buildAssignmentCandidates([offline, pending, onTrip, ready], outletOrder);
    expect(candidates[0].rider.id).toBe('ready');
    expect(candidates.find((c) => c.rider.id === 'off')?.blockedReason).toBe('Off duty');
    expect(candidates.find((c) => c.rider.id === 'pend')?.blockedReason).toBe('Pending approval');
    expect(candidates.find((c) => c.rider.id === 'trip')?.blockedReason).toBe('On an active trip');
  });

  it('keeps couriers without a GPS fix at the end of the assignable group with null distance', () => {
    const noFix = rider({ id: 'nofix', riderName: 'No Fix' });
    const withFix = rider({ id: 'fix', riderName: 'Fix', latitude: 23.793, longitude: 90.408 });
    const candidates = buildAssignmentCandidates([noFix, withFix], outletOrder);

    expect(candidates.map((c) => c.rider.id)).toEqual(['fix', 'nofix']);
    expect(candidates[1].distanceKm).toBeNull();
  });

  it('leaves distances null when the order carries no outlet coordinates', () => {
    const withFix = rider({ id: 'fix', latitude: 23.793, longitude: 90.408 });
    const candidates = buildAssignmentCandidates([withFix], order({ vendorLatitude: undefined }));
    expect(candidates[0].distanceKm).toBeNull();
  });
});

describe('filterCandidatesByQuery', () => {
  const candidates = buildAssignmentCandidates(
    [rider({ id: 'a', riderName: 'Kamal Hossain', phone: '+8801700000011' }), rider({ id: 'b', riderName: 'Jahangir', vehicleType: 'scooter' })],
    null,
  );

  it('returns every candidate for an empty query', () => {
    expect(filterCandidatesByQuery(candidates, '')).toHaveLength(2);
  });

  it('matches on name, phone fragment, and vehicle type (case-insensitive)', () => {
    expect(filterCandidatesByQuery(candidates, 'kamal').map((c) => c.rider.id)).toEqual(['a']);
    expect(filterCandidatesByQuery(candidates, '000011').map((c) => c.rider.id)).toEqual(['a']);
    expect(filterCandidatesByQuery(candidates, 'SCOOTER').map((c) => c.rider.id)).toEqual(['b']);
  });

  it('returns nothing when no courier matches', () => {
    expect(filterCandidatesByQuery(candidates, 'zzz')).toEqual([]);
  });
});
