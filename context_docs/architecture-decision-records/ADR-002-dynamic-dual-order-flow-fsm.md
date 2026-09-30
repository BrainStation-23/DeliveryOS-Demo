# ADR-002: Dynamic Dual Order Dispatch Finite State Machine (`RIDER_FIRST` vs `VENDOR_FIRST`)

## Status
**Accepted** (2026-09-19)

---

## Context & Problem Statement
Hyperlocal logistics requires divergent fulfillment sequences based on merchant category:
1. **Restaurants (Hot Food)**: If cooking begins before securing a courier, food turns cold during dispatch delays, resulting in food waste and refunds.
2. **Groceries & Retail**: Products must be picked, packed, and verified on shelves before summoning a courier to avoid idle wait times.

Hardcoding a single flow or attempting concurrent "parallel" dispatch introduces race conditions and cancellation deadlocks. A deterministic finite state machine (FSM) is required that switches modes dynamically via configuration.

---

## Decision Drivers
- **Zero Food Waste**: Prevent prepared meals from sitting uncollected.
- **Courier Efficiency**: Minimize courier dwell time inside retail outlets.
- **Dynamic Configuration**: Allow runtime switching via `system_settings` without restarting services.
- **Race Condition Prevention**: Eliminate parallel state synchronization deadlocks.

---

## Considered Options
1. **Fixed Vendor-First Only**: Always cook first. *(Rejected: Causes food waste when couriers are unavailable)*.
2. **Fixed Rider-First Only**: Always dispatch courier first. *(Rejected: Causes excessive courier wait times in retail/grocery)*.
3. **Tri-State Parallel Dispatch**: Broadcast to couriers and kitchen simultaneously. *(Rejected: High concurrency conflicts upon cancellation)*.
4. **Configurable Sequential Dual Mode (Chosen)**: Two strictly validated sequential FSM paths toggled dynamically.

---

## Decision Outcome
Chosen option: **Configurable Sequential Dual Mode (`OrderFlowMode`)**.

```mermaid
flowchart TD
    subgraph RF["Mode A: RIDER_FIRST - Zero Food Waste"]
        A1["Order PLACED"] --> A2["Status: RIDER_SEARCH<br/>Broadcast to riders_pool"]
        A2 --> A3["Courier Claims Order via Redis Mutex"]
        A3 --> A4["Status: RIDER_ASSIGNED<br/>Vendor chime sounds"]
        A4 --> A5["Status: PREPARING<br/>Kitchen cooks"]
        A5 --> A6["Status: READY_FOR_PICKUP"]
        A6 --> A7["Status: DISPATCHED - Handover"]
        A7 --> A8["Status: DELIVERED"]
    end

    subgraph VF["Mode B: VENDOR_FIRST - Retail and Grocery"]
        B1["Order PLACED"] --> B2["Status: PLACED<br/>Vendor chime sounds"]
        B2 --> B3["Vendor packs goods<br/>Status: PREPARING"]
        B3 --> B4["Vendor marks READY_FOR_PICKUP"]
        B4 --> B5["Status: RIDER_SEARCH<br/>Broadcast to riders_pool"]
        B5 --> B6["Courier Claims: RIDER_ASSIGNED"]
        B6 --> B7["Status: DISPATCHED - Handover"]
        B7 --> B8["Status: DELIVERED"]
    end
```

### Positive Consequences
- **Food Quality Preservation**: Kitchens only cook once a courier is physically confirmed and en route.
- **Instant Mode Switching**: Admins switch fulfillment logic dynamically via `PATCH /admin/settings`.
- **Zero Race Conditions**: Clean sequential transitions eliminate overlapping assignment states.

### Negative Consequences & Mitigations
- *Trade-off*: In `RIDER_FIRST`, if rider search takes 60–90 seconds, kitchen acceptance appears delayed to the customer.
- *Mitigation*: Customer app displays explicit "Matching nearby delivery partner" progress indicator.

---

## Technical Implementation Details
- Central state machine and transition table implemented in [`order-state.machine.ts`](../../services/backend_api/src/modules/orders/order-state.machine.ts) with `assertTransition(from, to)` and `assertClaimable(order, mode)`.
- Mode claimability rules: `RIDER_FIRST` claims from `PLACED`; `VENDOR_FIRST` claims from `READY_FOR_PICKUP`.
- Invariant A3 Security Guard: Rider claiming and delivery strictly requires `order.riderId === rider.id`, completely eliminating unassigned order cash collection holes.
- Rider trip ledger records exact `delivery_economics.rider_share_percent` (80%) of delivery fee, maintaining 100% financial consistency across ledger entries and WebSocket broadcasts.
- Stored in `system_settings` table under `order_flow_config`:
  ```json
  {
    "mode": "RIDER_FIRST",
    "rider_search_timeout_seconds": 90
  }
  ```
- Cached in Redis for sub-millisecond retrieval during checkout processing.

---

## Order Cancellation, Vendor Rejection & Refund Flow

### Cancellation State Transitions
- **Customer Cancellation**: Permitted strictly while status is `PLACED` or `RIDER_ASSIGNED`. Once an order enters `PREPARING` or later, customer self-cancellation is strictly forbidden (throws HTTP 400 Bad Request) to protect vendor cooking investments.
- **Vendor Rejection**: Permitted prior to cooking initiation with structured reason codes (`OUT_OF_STOCK`, `KITCHEN_OVERLOAD`, `STORE_CLOSING_SOON`, `OTHER`).
- **Super Admin Force-Cancellation**: Permitted prior to `DISPATCHED` with mandatory audit reason.

### Atomic Rollback & Financial Reversal Invariants
When an order is cancelled:
1. **FSM Transition**: Status transitions to `CANCELLED` and `cancelledAt` / `rejectionReason` are recorded.
2. **Payment Reversal**: If `paymentStatus === PAID`, payment status updates to `REFUNDED`; if `PENDING`, updates to `FAILED`.
3. **Coupon Restoral**: If `couponId` is present, `Coupon.currentUses` is atomically decremented by 1.
4. **Ledger Purge**: Pending `CommissionLedger` and `RiderTripLedger` records are atomically deleted to eliminate accidental settlement payouts.
5. **Courier Lock Release**: Active Redis keys `rider:active_order:${riderId}` and `lock:order_claim:${orderId}` are removed to restore courier availability.
6. **Real-time Push**: Emits `order:cancelled` and `order:status:changed` (newStatus `CANCELLED`) to rooms and dispatches FCM notifications.

---

## Delivery Issue, Re-Dispatch Recovery & Fulfillment Invariants

### 1. Delivery Issue Re-Dispatch Flow (`DISPATCHED → READY_FOR_PICKUP`)
- When a courier encounters vehicle breakdown, road accident, or customer reachability failure on an in-flight order (`POST /rider/orders/:id/report-issue`):
  1. The FSM permits transition `DISPATCHED → READY_FOR_PICKUP`.
  2. The database updates `riderId = null`, status to `READY_FOR_PICKUP`, and records the audit trail in `rejectionReason`.
  3. The courier's Redis busy lock `rider:active_order:${riderId}` is released via `releaseRiderActiveTrip`.
  4. Realtime status events are broadcast to customer/vendor rooms and dispatch room `admin_hq` (`order:delivery_failed`).
  5. The order automatically re-enters dispatch via `orderFlowService.handleOrderReady`, broadcasting to `riders_pool` so a replacement courier can fulfill delivery without customer cancellation.

### 2. Courier In-Flight Active Trip Rehydration
- `GET /rider/active-trip` queries live in-flight orders (`[RIDER_ASSIGNED, ACCEPTED, PREPARING, READY_FOR_PICKUP, DISPATCHED]`) for the authenticated courier.
- The courier mobile client restores full navigation and handover state upon app reboot, OS process recreation, or reconnect, preventing stranded active locks.

### 3. Takeaway Order Fulfillment Bypass
- Orders with `deliveryAddressSnapshot.deliveryMethod === 'TAKEAWAY'` represent self-pickup orders.
- Upon placement (`handleOrderPlaced`) or ready status (`handleOrderReady`), the KDS kitchen console is notified immediately, while courier pool broadcasting and dispatch escalation sweeps are completely bypassed.

---

## Compliance & Verification
- Integration verification: [`test-order-dispatch-fsm.ts`](../../services/backend_api/scripts/test-order-dispatch-fsm.ts) validates runtime switching and concurrent claims.
- Fulfillment verification: [`test-vendor-rider.ts`](../../services/backend_api/scripts/test-vendor-rider.ts) and [`test-e2e-lifecycle.ts`](../../services/backend_api/scripts/test-e2e-lifecycle.ts) validate full lifecycle progression and penny-perfect financial balancing.
- Cancellation verification: [`test-order-cancellation.ts`](../../services/backend_api/scripts/test-order-cancellation.ts) validates all 4 boundary conditions: customer cancel, pre-prep boundary guard, vendor rejection, and admin force-cancel with refund.

---

## Amendments

### 2026-09-30 — Hardened mode scoping, dead-edge removal & stale-order reaper
- **`PLACED → PREPARING` is now mode-enforced**: `acceptOrder` returns `409` for a `PLACED` order while `RIDER_FIRST` is active. Previously the FSM permitted the transition in both modes; a kitchen accepting a riderless order in `RIDER_FIRST` moved it to `PREPARING`, where `assertClaimable()` rejects every claim — stranding the order with no courier and no customer-cancellation path. The KDS board's New lane still shows the order, but Accept is server-blocked until a rider secures it.
- **`DISPATCHED → CANCELLED` removed from the transition graph**: no code path could legally execute it (admin cancel blocks `DISPATCHED` by policy — the rider reports a delivery issue or completes the trip). The dead edge is deleted from `ORDER_TRANSITIONS` so the machine matches enforced behavior.
- **Status-conditional writes on all fulfillment mutations**: `markOrderReady`, `handoverOrder`, `pickupOrder`, and `reportDeliveryIssue` now update `WHERE id AND status = observed` (P2025 → `409`), matching `acceptOrder`. A concurrent cancellation can never be silently resurrected.
- **Handover requires an assigned courier for delivery orders** (takeaway excepted): dispatching a riderless delivery order left it in `DISPATCHED`, a status no rider can claim.
- **Stale-order reaper**: `OrderService.sweepStaleOrders()` (leader-locked, 60s tick) auto-cancels kitchen-unaccepted orders older than `order_flow_config.stale_order_ttl_minutes` (default 60) via the central cancellation engine; the escalation scanner caps its window at the same TTL so forgotten orders stop re-broadcasting hourly.
- **Takeaway snapshot field**: checkout now stamps the canonical `deliveryMethod` field (legacy `type`-only snapshots are honored). Section 3's bypass previously read a field checkout never wrote and was dead in production — unit tests now pin the exact checkout-produced snapshot shape.
