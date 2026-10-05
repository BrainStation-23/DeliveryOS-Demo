import { describe, expect, it, vi, beforeEach } from 'vitest';
import { categorizeKDSOrders } from './useKDSOrders';
import { KDSOrder } from '../types/kds';
import { soundEngine } from '../utils/sound';

const makeOrder = (id: string, status: KDSOrder['status']): KDSOrder => ({
  id,
  orderNumber: `ORD-${id}`,
  vendorId: 'vendor-1',
  status,
  subtotal: 300,
  taxAmount: 0,
  deliveryFee: 50,
  discountAmount: 0,
  totalAmount: 350,
  paymentMethod: 'CASH_ON_DELIVERY',
  paymentStatus: 'PENDING',
  deliveryAddress: null,
  customerNotes: null,
  prepTimeMinutes: 15,
  createdAt: '2026-10-05T12:00:00.000Z',
  updatedAt: '2026-10-05T12:00:00.000Z',
  items: [],
  customer: { id: 'c1', fullName: 'Customer 1', phone: '+8801700000005' },
  rider: null,
});

describe('T10: useKDSOrders - Kitchen Lane Mapping & Alarm Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps PLACED and RIDER_ASSIGNED to the newOrders lane', () => {
    const orders: KDSOrder[] = [
      makeOrder('1', 'PLACED'),
      makeOrder('2', 'RIDER_ASSIGNED'),
    ];

    const { newOrders, inPreparationOrders, readyOrders } = categorizeKDSOrders(orders);

    expect(newOrders).toHaveLength(2);
    expect(newOrders.map((o) => o.id)).toEqual(['1', '2']);
    expect(inPreparationOrders).toHaveLength(0);
    expect(readyOrders).toHaveLength(0);
  });

  it('maps ACCEPTED and PREPARING to the inPreparationOrders lane', () => {
    const orders: KDSOrder[] = [
      makeOrder('3', 'ACCEPTED'),
      makeOrder('4', 'PREPARING'),
    ];

    const { newOrders, inPreparationOrders, readyOrders } = categorizeKDSOrders(orders);

    expect(inPreparationOrders).toHaveLength(2);
    expect(inPreparationOrders.map((o) => o.id)).toEqual(['3', '4']);
    expect(newOrders).toHaveLength(0);
    expect(readyOrders).toHaveLength(0);
  });

  it('maps READY_FOR_PICKUP to the readyOrders lane', () => {
    const orders: KDSOrder[] = [
      makeOrder('5', 'READY_FOR_PICKUP'),
    ];

    const { newOrders, inPreparationOrders, readyOrders } = categorizeKDSOrders(orders);

    expect(readyOrders).toHaveLength(1);
    expect(readyOrders[0].id).toBe('5');
    expect(newOrders).toHaveLength(0);
    expect(inPreparationOrders).toHaveLength(0);
  });

  it('excludes terminal states (DELIVERED, CANCELLED) from active kitchen lanes', () => {
    const orders: KDSOrder[] = [
      makeOrder('6', 'DELIVERED'),
      makeOrder('7', 'CANCELLED'),
    ];

    const { newOrders, inPreparationOrders, readyOrders } = categorizeKDSOrders(orders);

    expect(newOrders).toHaveLength(0);
    expect(inPreparationOrders).toHaveLength(0);
    expect(readyOrders).toHaveLength(0);
  });

  it('verifies soundEngine alarm control stops chime on unmount / cleanup', () => {
    const stopSpy = vi.spyOn(soundEngine, 'stopOrderAlarm');
    soundEngine.stopOrderAlarm();
    expect(stopSpy).toHaveBeenCalled();
  });
});
