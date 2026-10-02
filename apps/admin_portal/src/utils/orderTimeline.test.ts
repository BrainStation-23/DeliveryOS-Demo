import { describe, expect, it } from 'vitest';
import { buildOrderTimeline } from './orderTimeline';

const base = {
  status: 'DELIVERED',
  placedAt: '2026-10-02T10:00:00.000Z',
  acceptedAt: '2026-10-02T10:02:00.000Z',
  pickedUpAt: '2026-10-02T10:25:00.000Z',
  deliveredAt: '2026-10-02T10:50:00.000Z',
};

describe('buildOrderTimeline', () => {
  it('marks every stage done for a delivered order', () => {
    const steps = buildOrderTimeline(base);
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done']);
    expect(steps[3]).toMatchObject({ id: 'delivered', label: 'Delivered' });
  });

  it('marks the first un-timestamped stage as active and later ones pending', () => {
    const steps = buildOrderTimeline({
      ...base,
      status: 'PREPARING',
      pickedUpAt: null,
      deliveredAt: null,
    });
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'active', 'pending']);
  });

  it('treats a brand-new order as placed-done with acceptance active', () => {
    const steps = buildOrderTimeline({
      ...base,
      status: 'PLACED',
      acceptedAt: null,
      pickedUpAt: null,
      deliveredAt: null,
    });
    expect(steps.map((s) => s.state)).toEqual(['done', 'active', 'pending', 'pending']);
  });

  it('ends a cancelled order at its cancellation step with the rejection reason', () => {
    const steps = buildOrderTimeline({
      ...base,
      status: 'CANCELLED',
      pickedUpAt: null,
      deliveredAt: null,
      cancelledAt: '2026-10-02T10:05:00.000Z',
      rejectionReason: 'OUT_OF_STOCK',
    });
    expect(steps).toHaveLength(2);
    expect(steps[0].state).toBe('done');
    expect(steps[1]).toMatchObject({
      id: 'cancelled',
      state: 'cancelled',
      timestamp: '2026-10-02T10:05:00.000Z',
      detail: 'OUT_OF_STOCK',
    });
  });

  it('omits the detail when no rejection reason was recorded', () => {
    const steps = buildOrderTimeline({
      ...base,
      status: 'CANCELLED',
      cancelledAt: '2026-10-02T10:05:00.000Z',
    });
    expect(steps[1].detail).toBeUndefined();
  });
});
