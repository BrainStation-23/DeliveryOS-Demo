import { AdminOrder } from '../../../../services/adminApi';

export interface UnassignedPoolSummary {
  waitingCount: number;
  poolVolume: number;
  maxAgingMinutes: number;
}

export function computeUnassignedPoolSummary(
  orders: AdminOrder[],
  nowMs: number = Date.now(),
): UnassignedPoolSummary {
  const safeOrders = Array.isArray(orders) ? orders : [];
  if (safeOrders.length === 0) {
    return { waitingCount: 0, poolVolume: 0, maxAgingMinutes: 0 };
  }

  let poolVolume = 0;
  let maxAgingMinutes = 0;
  for (const order of safeOrders) {
    poolVolume += order?.totalAmount || 0;
    const agingMinutes = Math.max(0, Math.floor((nowMs - new Date(order.placedAt).getTime()) / 60000));
    if (agingMinutes > maxAgingMinutes) {
      maxAgingMinutes = agingMinutes;
    }
  }

  return { waitingCount: safeOrders.length, poolVolume, maxAgingMinutes };
}
