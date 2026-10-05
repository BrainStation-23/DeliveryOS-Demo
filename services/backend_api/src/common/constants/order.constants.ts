import { OrderStatus } from '@prisma/client';

/**
 * Orders currently being actively processed or delivered by a courier.
 * Canonical single source of truth across fleet radar, dispatch, and lifecycle queries.
 */
export const IN_FLIGHT_STATUSES = [
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.DISPATCHED,
] as const;

export type InFlightOrderStatus = (typeof IN_FLIGHT_STATUSES)[number];
