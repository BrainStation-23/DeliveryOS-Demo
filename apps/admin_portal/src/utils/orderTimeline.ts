export interface OrderTimelineInput {
  status: string;
  placedAt: string;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  rejectionReason?: string | null;
}

export interface OrderTimelineStep {
  id: string;
  label: string;
  /** Present once the stage has actually happened. */
  timestamp?: string;
  /** Extra context (e.g. a rejection reason on the cancelled step). */
  detail?: string;
  state: 'done' | 'active' | 'pending' | 'cancelled';
}

/**
 * Derives the admin-facing lifecycle timeline: every step with a timestamp
 * happened, the first timestamp-less step before termination is the one in
 * progress, and a cancelled order stops the chain at its cancellation step.
 */
export function buildOrderTimeline(order: OrderTimelineInput): OrderTimelineStep[] {
  const cancelled = order.status === 'CANCELLED';

  const chain: Array<{ id: string; label: string; timestamp?: string | null }> = [
    { id: 'placed', label: 'Order Placed', timestamp: order.placedAt },
    { id: 'accepted', label: 'Accepted by Kitchen', timestamp: order.acceptedAt },
    { id: 'picked_up', label: 'Picked Up by Courier', timestamp: order.pickedUpAt },
    { id: 'delivered', label: 'Delivered', timestamp: order.deliveredAt },
  ];

  if (cancelled) {
    return [
      {
        id: 'placed',
        label: 'Order Placed',
        timestamp: order.placedAt,
        state: 'done',
      },
      {
        id: 'cancelled',
        label: 'Cancelled',
        timestamp: order.cancelledAt || undefined,
        detail: order.rejectionReason || undefined,
        state: 'cancelled',
      },
    ];
  }

  const steps: OrderTimelineStep[] = [];
  let activeAssigned = false;
  for (const step of chain) {
    if (step.timestamp) {
      steps.push({ ...step, timestamp: step.timestamp, state: 'done' });
    } else if (!activeAssigned) {
      steps.push({ id: step.id, label: step.label, state: 'active' });
      activeAssigned = true;
    } else {
      steps.push({ id: step.id, label: step.label, state: 'pending' });
    }
  }
  return steps;
}
