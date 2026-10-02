import { describe, expect, it } from 'vitest';
import { AdminOrder } from '../../../../services/adminApi';
import { ORDER_LIFECYCLE_STAGES, filterOrdersByQuery } from './orderFilters';

const order = (overrides: Partial<AdminOrder>): AdminOrder => ({
  id: 'order-1',
  orderNumber: 'ORD-20261001-0001',
  vendorId: 'vendor-1',
  vendorName: 'Burger Point Gulshan',
  vendorAddress: 'Gulshan 2, Dhaka',
  customerId: 'customer-1',
  customerName: 'Nusrat Jahan',
  customerPhone: '+8801700000005',
  riderId: 'rider-1',
  riderName: 'Kamal Hossain',
  riderPhone: '+8801700000010',
  status: 'DISPATCHED',
  paymentMethod: 'CASH_ON_DELIVERY',
  paymentStatus: 'PENDING',
  totalAmount: 550,
  deliveryFee: 50,
  placedAt: '2026-10-01T11:30:00.000Z',
  items: [{ id: 'item-1', name: 'Classic Burger', quantity: 2, unitPrice: 250 }],
  deliveryAddress: 'Road 11, Banani, Dhaka',
  ...overrides,
});

const orders = [
  order({ id: 'o-1', orderNumber: 'ORD-20261001-0001', customerName: 'Nusrat Jahan' }),
  order({
    id: 'o-2',
    orderNumber: 'ORD-20261001-0002',
    vendorName: 'FreshMart Dhanmondi',
    customerName: 'Imran Khan',
    riderName: null,
  }),
  order({ id: 'o-3', orderNumber: 'ORD-20261001-0003', customerName: 'Rashed Karim', riderName: 'Jamal Uddin' }),
];

describe('filterOrdersByQuery', () => {
  it('returns every order when the query is empty', () => {
    expect(filterOrdersByQuery(orders, '')).toHaveLength(3);
  });

  it('matches on order number, customer, vendor, courier, and phone fragments', () => {
    expect(filterOrdersByQuery(orders, '0002').map((o) => o.id)).toEqual(['o-2']);
    expect(filterOrdersByQuery(orders, 'freshmart').map((o) => o.id)).toEqual(['o-2']);
    expect(filterOrdersByQuery(orders, 'nusrat').map((o) => o.id)).toEqual(['o-1']);
    expect(filterOrdersByQuery(orders, 'jamal').map((o) => o.id)).toEqual(['o-3']);
    expect(filterOrdersByQuery(orders, '+8801700000005').map((o) => o.id)).toEqual(['o-1', 'o-2', 'o-3']);
  });

  it('returns an empty result when nothing matches and tolerates non-array payloads', () => {
    expect(filterOrdersByQuery(orders, 'zzz-not-found')).toEqual([]);
    expect(
      filterOrdersByQuery(undefined as unknown as AdminOrder[], ''),
    ).toEqual([]);
  });
});

describe('ORDER_LIFECYCLE_STAGES', () => {
  it('exposes the seven FSM stages plus the ALL aggregate in order', () => {
    expect(ORDER_LIFECYCLE_STAGES.map((stage) => stage.id)).toEqual([
      'ALL',
      'PLACED',
      'RIDER_ASSIGNED',
      'ACCEPTED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'DISPATCHED',
      'DELIVERED',
    ]);
  });
});
