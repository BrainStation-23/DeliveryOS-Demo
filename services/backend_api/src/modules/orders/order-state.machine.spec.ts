import { OrderStatus } from '@prisma/client';
import { OrderFlowMode } from '../order-flow/dto/update-order-flow.dto';
import {
  ORDER_TRANSITIONS,
  assertClaimable,
  assertTransition,
} from './order-state.machine';

describe('Order State Machine (ADR-002)', () => {
  it('allows the canonical happy-path progression', () => {
    expect(() => assertTransition(OrderStatus.PLACED, OrderStatus.RIDER_ASSIGNED)).not.toThrow();
    expect(() => assertTransition(OrderStatus.RIDER_ASSIGNED, OrderStatus.PREPARING)).not.toThrow();
    expect(() => assertTransition(OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP)).not.toThrow();
    expect(() => assertTransition(OrderStatus.READY_FOR_PICKUP, OrderStatus.DISPATCHED)).not.toThrow();
    expect(() => assertTransition(OrderStatus.DISPATCHED, OrderStatus.DELIVERED)).not.toThrow();
  });

  it('allows cancellation from every active stage', () => {
    for (const from of [
      OrderStatus.PLACED,
      OrderStatus.RIDER_ASSIGNED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
    ]) {
      expect(() => assertTransition(from, OrderStatus.CANCELLED)).not.toThrow();
    }
  });

  it('rejects illegal transitions', () => {
    expect(() => assertTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toThrow();
    expect(() => assertTransition(OrderStatus.CANCELLED, OrderStatus.PLACED)).toThrow();
    expect(() => assertTransition(OrderStatus.PLACED, OrderStatus.DISPATCHED)).toThrow();
    expect(() => assertTransition(OrderStatus.RIDER_ASSIGNED, OrderStatus.DISPATCHED)).toThrow();
    expect(() => assertTransition(OrderStatus.DISPATCHED, OrderStatus.PREPARING)).toThrow();
    expect(() => assertTransition(OrderStatus.DELIVERED, OrderStatus.DISPATCHED)).toThrow();
  });

  it('rejects DISPATCHED → CANCELLED: once on the road the trip never auto-unwinds', () => {
    // Policy (TID-05/ADR-002): a courier on the road either completes delivery
    // or reports a delivery issue (DISPATCHED → READY_FOR_PICKUP). Admin cancel
    // blocks DISPATCHED with the same rule.
    expect(() => assertTransition(OrderStatus.DISPATCHED, OrderStatus.CANCELLED)).toThrow();
    expect(ORDER_TRANSITIONS[OrderStatus.DISPATCHED]).toEqual([
      OrderStatus.DELIVERED,
      OrderStatus.READY_FOR_PICKUP,
    ]);
  });

  it('treats terminal states as absorbing', () => {
    expect(ORDER_TRANSITIONS[OrderStatus.DELIVERED]).toEqual([]);
    expect(ORDER_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
  });

  it('permits claiming only in mode-correct statuses', () => {
    expect(() => assertClaimable(OrderFlowMode.RIDER_FIRST, OrderStatus.PLACED)).not.toThrow();
    expect(() => assertClaimable(OrderFlowMode.RIDER_FIRST, OrderStatus.READY_FOR_PICKUP)).toThrow();
    expect(() => assertClaimable(OrderFlowMode.VENDOR_FIRST, OrderStatus.READY_FOR_PICKUP)).not.toThrow();
    expect(() => assertClaimable(OrderFlowMode.VENDOR_FIRST, OrderStatus.PLACED)).toThrow();
  });
});
