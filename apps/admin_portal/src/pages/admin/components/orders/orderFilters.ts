export const ORDER_LIFECYCLE_STAGES = [
  { id: 'ALL', label: 'All Orders' },
  { id: 'PLACED', label: '1. Placed' },
  { id: 'RIDER_ASSIGNED', label: '2. Courier Assigned' },
  { id: 'ACCEPTED', label: '3. Accepted' },
  { id: 'PREPARING', label: '4. Preparing' },
  { id: 'READY_FOR_PICKUP', label: '5. Ready for Pickup' },
  { id: 'DISPATCHED', label: '6. On Delivery' },
  { id: 'DELIVERED', label: '7. Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
] as const;

export type OrderLifecycleStageId = (typeof ORDER_LIFECYCLE_STAGES)[number]['id'];
