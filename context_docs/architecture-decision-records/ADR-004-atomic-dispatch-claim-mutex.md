# ADR-004: High-Concurrency Order Dispatch Claiming via Redis Atomic Distributed Mutex

## Status
**Accepted** (2026-09-20)

---

## Context & Problem Statement
When an order is broadcast to nearby couriers in the `riders_pool`, multiple riders receive push notifications simultaneously. Under high volume, multiple couriers may tap "Accept Order" within milliseconds of each other.

Without atomic concurrency control:
1. Multiple worker processes read `order.riderId == null` simultaneously.
2. Concurrent database updates succeed or create deadlocks.
3. Multiple couriers arrive at the merchant claiming the same order.

---

## Decision Drivers
- **Strict Single-Winner Guarantee**: Exactly one courier must secure the dispatch claim.
- **Immediate Rejection Feedback**: Losing couriers must receive an immediate `409 Conflict` response with zero server lag.
- **Deadlock Protection**: If a backend process crashes mid-claim, locks must release automatically.
- **Sub-5ms Lock Latency**: Claiming operations cannot introduce perceptible latency in the mobile app.

---

## Considered Options
1. **Pessimistic Database Locking (`SELECT FOR UPDATE`)**: Lock rows at the relational database level. *(Rejected: High row lock contention under peak load)*.
2. **Optimistic Concurrency Control (Version column)**: Check entity version at write. *(Rejected: Requires rollbacks and multiple database roundtrips)*.
3. **Redis Atomic Distributed Mutex (`SET key val PX 5000 NX`) (Chosen)**: In-memory single-cycle atomic lock before database commit.

---

## Decision Outcome
Chosen option: **Redis Atomic Distributed Mutex**.

```mermaid
sequenceDiagram
    autonumber
    actor CourierA as Courier A
    actor CourierB as Courier B
    participant Redis as Redis 7.2
    participant API as OrderFlowService
    participant DB as PostgreSQL 16

    CourierA->>API: POST /rider/orders/ORD_101/claim
    CourierB->>API: POST /rider/orders/ORD_101/claim
    
    API->>Redis: SET lock:order:claim:ORD_101 CourierA PX 5000 NX
    Redis-->>API: OK - Lock Acquired
    
    API->>Redis: SET lock:order:claim:ORD_101 CourierB PX 5000 NX
    Redis-->>API: nil - Lock Refused
    
    API-->>CourierB: HTTP 409 Conflict - Already claimed

    Note over API,DB: Courier A proceeds with PostgreSQL transaction
    API->>DB: UPDATE orders SET rider_id = CourierA, status = RIDER_ASSIGNED
    DB-->>API: Order Assigned
    API->>Redis: DEL lock:order:claim:ORD_101
    API-->>CourierA: HTTP 200 OK - Trip Confirmed
```

### Positive Consequences
- **Absolute Concurrency Safety**: Guaranteed single assignment regardless of concurrent claim spikes.
- **Zero Database Load for Rejected Claims**: Non-winning requests are rejected in $<1$ ms by Redis before touching PostgreSQL.
- **Self-Healing TTL**: The 5-second TTL (`PX 5000`) guarantees lock expiration even if the worker container abruptly crashes.

### Negative Consequences & Mitigations
- *Trade-off*: Dependency on Redis availability for order claiming.
- *Mitigation*: Docker Compose health checks and automated restarts ensure high Redis uptime.

---

## Technical Implementation Details
Implemented in [`order-flow.service.ts`](../../services/backend_api/src/modules/order-flow/order-flow.service.ts):
```typescript
const lockKey = `lock:order:claim:${orderId}`;
const acquired = await this.redis.set(lockKey, riderId, 'PX', 5000, 'NX');

if (!acquired) {
  throw new ConflictException('This delivery order has already been claimed by another courier.');
}

try {
  return await this.prisma.order.update({
    where: { id: orderId },
    data: { riderId, status: OrderStatus.RIDER_ASSIGNED },
  });
} finally {
  await this.redis.del(lockKey);
}
```

---

## Dispatch Escalation Architecture (Phase 2)
To prevent unassigned orders from starving when nearby couriers do not claim them promptly, the dispatch engine implements an autonomous 2-tier escalation loop scanning unassigned orders every 30 seconds:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Tier 0 (T = 0s): Initial Broadcast                                   │
│  - Proximity radius: 3.0 km                                            │
│  - Push FCM alert + Socket event [dispatch:broadcast] to riders_pool   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Unclaimed after > 90s
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Tier 1 Escalation (T > 90s): Expanded Proximity Broadcast             │
│  - Radius expanded: 6.0 km                                             │
│  - Idempotent Redis key: dispatch:escalated:{orderId}:tier1 (TTL 10m)  │
│  - Re-broadcasts via WebSockets & FCM notification                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Unclaimed after > 180s
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Tier 2 Escalation (T > 180s): Super Admin Emergency Radar Alert       │
│  - Idempotent Redis key: dispatch:escalated:{orderId}:tier2 (TTL 10m)  │
│  - Emits [dispatch:escalated] to admin_hq socket room                  │
│  - Displays high-priority warning banner in Admin Dispatch Live Radar  │
│  - Allows dispatcher manual courier override                           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Compliance & Verification
- **Distributed Mutex Test**: Verified via `npm run test:dispatch` (`scripts/test-dispatch-fsm.ts`) asserting 6 concurrent rider claims result in exactly 1 winner (200 OK) and 5 rejections (409 Conflict).
- **Escalation & FCM Test**: Verified via `npm run test:escalation` (`scripts/test-fcm-notifications.ts`) asserting Tier 1 radius expansion and Tier 2 `admin_hq` room escalation.
- **Courier UI error handling**: Handled via Riverpod exception interception in [`trip_provider.dart`](../../apps/rider_app/lib/features/trips/providers/trip_provider.dart).
- **Admin Fleet Map Radar**: Verified in [`LiveFleetMap.tsx`](../../apps/admin_portal/src/components/dispatch/LiveFleetMap.tsx) showing real-time rider pins and escalation badges.
