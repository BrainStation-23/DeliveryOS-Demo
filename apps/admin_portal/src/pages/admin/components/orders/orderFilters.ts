import { AdminOrder } from '../../../../services/adminApi';

export const ORDER_LIFECYCLE_STAGES = [
  { id: 'ALL', label: 'All Orders' },
  { id: 'PLACED', label: '1. Placed' },
  { id: 'RIDER_ASSIGNED', label: '2. Courier Assigned' },
  { id: 'ACCEPTED', label: '3. Accepted' },
  { id: 'PREPARING', label: '4. Preparing' },
  { id: 'READY_FOR_PICKUP', label: '5. Ready for Pickup' },
  { id: 'DISPATCHED', label: '6. On Delivery' },
  { id: 'DELIVERED', label: '7. Delivered' },
] as const;

export type OrderLifecycleStageId = (typeof ORDER_LIFECYCLE_STAGES)[number]['id'];

export function filterOrdersByQuery(orders: AdminOrder[], query: string): AdminOrder[] {
  const q = (query || '').toLowerCase();
  return (Array.isArray(orders) ? orders : []).filter((o) => {
    if (!o) return false;
    const matchesSearch =
      (o.orderNumber || '').toLowerCase().includes(q) ||
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.vendorName || '').toLowerCase().includes(q) ||
      (o.riderName && o.riderName.toLowerCase().includes(q)) ||
      (o.customerPhone && o.customerPhone.includes(q));
    return matchesSearch;
  });
}
