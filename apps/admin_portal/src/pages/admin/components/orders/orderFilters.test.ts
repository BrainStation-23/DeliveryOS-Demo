import { describe, expect, it } from 'vitest';
import { ORDER_LIFECYCLE_STAGES } from './orderFilters';

describe('ORDER_LIFECYCLE_STAGES', () => {
  it('exposes the seven FSM stages, the CANCELLED terminal, and the ALL aggregate in order', () => {
    expect(ORDER_LIFECYCLE_STAGES.map((stage) => stage.id)).toEqual([
      'ALL',
      'PLACED',
      'RIDER_ASSIGNED',
      'ACCEPTED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'DISPATCHED',
      'DELIVERED',
      'CANCELLED',
    ]);
  });

  it('keeps stage ids and labels unique so tab keys and filters can never collide', () => {
    const ids = ORDER_LIFECYCLE_STAGES.map((stage) => stage.id);
    const labels = ORDER_LIFECYCLE_STAGES.map((stage) => stage.label);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
