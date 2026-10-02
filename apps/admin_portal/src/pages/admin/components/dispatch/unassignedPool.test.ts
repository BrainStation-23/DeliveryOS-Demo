import { describe, expect, it } from 'vitest';
import { AdminOrder } from '../../../../services/adminApi';
import { computeUnassignedPoolSummary } from './unassignedPool';

const NOW = new Date('2026-10-01T12:00:00.000Z').getTime();

const order = (overrides: Partial<AdminOrder>): AdminOrder => ({
  id: 'order-1',
  orderNumber: 'ORD-20261001-0001',
  vendorId: 'vendor-1',
  vendorName: 'Burger Point Gulshan',
  vendorAddress: 'Gulshan 2, Dhaka',
  customerId: 'customer-1',
  customerName: 'Nusrat Jahan',
  customerPhone: '+8801700000005',
  riderId: null,
  riderName: null,
  riderPhone: null,
  status: 'PLACED',
  paymentMethod: 'CASH_ON_DELIVERY',
  paymentStatus: 'PENDING',
  totalAmount: 500,
  deliveryFee: 50,
  placedAt: new Date(NOW - 5 * 60000).toISOString(),
  items: [],
  deliveryAddress: 'Road 11, Banani, Dhaka',
  ...overrides,
});

describe('computeUnassignedPoolSummary', () => {
  it('sums pool volume and reports the oldest wait in minutes', () => {
    const summary = computeUnassignedPoolSummary(
      [
        order({ id: 'o-1', totalAmount: 500, placedAt: new Date(NOW - 5 * 60000).toISOString() }),
        order({ id: 'o-2', totalAmount: 250.5, placedAt: new Date(NOW - 17 * 60000).toISOString() }),
        order({ id: 'o-3', totalAmount: 149.5, placedAt: new Date(NOW - 2 * 60000).toISOString() }),
      ],
      NOW,
    );

    expect(summary).toEqual({ waitingCount: 3, poolVolume: 900, maxAgingMinutes: 17 });
  });

  it('clamps future-dated placedAt timestamps to zero aging instead of going negative', () => {
    const summary = computeUnassignedPoolSummary(
      [order({ placedAt: new Date(NOW + 10 * 60000).toISOString() })],
      NOW,
    );
    expect(summary.maxAgingMinutes).toBe(0);
  });

  it('returns zeroed summary for an empty pool', () => {
    expect(computeUnassignedPoolSummary([], NOW)).toEqual({
      waitingCount: 0,
      poolVolume: 0,
      maxAgingMinutes: 0,
    });
  });
});
