import { OrderStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { OrderFlowMode } from '../order-flow/dto/update-order-flow.dto';

/**
 * Authoritative Order State Machine Transitions (ADR-002)
 * Invariant: Any order status transition must follow this directed graph.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: [OrderStatus.RIDER_ASSIGNED, OrderStatus.PREPARING, OrderStatus.CANCELLED],
  RIDER_ASSIGNED: [
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.CANCELLED,
  ],
  ACCEPTED: [OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED], // Deprecated, preserved for safety
  PREPARING: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
  READY_FOR_PICKUP: [OrderStatus.DISPATCHED, OrderStatus.CANCELLED],
  // No CANCELLED edge by policy: an on-the-road courier either reports a
  // delivery issue (→ READY_FOR_PICKUP) or completes the trip. Admin cancel
  // blocks DISPATCHED with the same rule.
  DISPATCHED: [OrderStatus.DELIVERED, OrderStatus.READY_FOR_PICKUP],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * Legal order statuses from which a rider can claim an order per dispatch mode.
 */
export const CLAIMABLE_STATUSES: Record<OrderFlowMode, OrderStatus[]> = {
  RIDER_FIRST: [OrderStatus.PLACED],
  VENDOR_FIRST: [OrderStatus.READY_FOR_PICKUP],
};

/**
 * Asserts that a transition from `from` to `to` is legally permissible.
 * Throws BadRequestException if the transition violates the state machine.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = ORDER_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new BadRequestException(`Illegal order transition ${from} → ${to}`);
  }
}

/**
 * Asserts that an order can be claimed by a rider given the active dispatch mode.
 */
export function assertClaimable(mode: OrderFlowMode, status: OrderStatus): void {
  const allowed = CLAIMABLE_STATUSES[mode];
  if (!allowed || !allowed.includes(status)) {
    throw new BadRequestException(
      `Order in status "${status}" cannot be claimed in "${mode}" dispatch mode. Allowed statuses: ${allowed.join(', ')}`,
    );
  }
}
