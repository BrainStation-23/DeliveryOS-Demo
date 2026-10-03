# 06 — Rider Fleet & Dispatch Handbook

Operational protocols, shift management, dispatch algorithms, fulfillment lifecycles, and cash limits for the **Rider Mobile App** (Flutter (Dart ^3.8), Riverpod 3).

---

## 1. Courier Onboarding & Verification Gate

- **Registration**: Courier registers phone number (`+880` / `+966`), full name, and vehicle type (`motorcycle`, `bicycle`) via `PhoneLoginScreen`.
- **Administrative Gate (`PendingApprovalScreen`)**:
  - Initial account status: `is_approved = false` (`PENDING_APPROVAL`).
  - App displays an explanatory locked state preventing shift access until authorized by Super Admin (`PATCH /admin/riders/:id/approval`).
  - Upon approval, the app unlocks the shift dashboard immediately.

---

## 2. Shift Management & Telemetry

- **Duty Switch (`RiderDashboardScreen`)**:
  - One-tap switch toggling between `Online (Start Shift)` and `Offline (End Shift)`.
  - **In-Flight Duty Lock Invariant**: Couriers cannot go offline while carrying an active order (`RIDER_ASSIGNED` or `DISPATCHED`). The app blocks the switch and alerts: *"Cannot go offline while you have an active in-flight delivery. Please complete or release the order first."*
- **GPS Telemetry**:
  - Android `FOREGROUND_SERVICE_LOCATION` foreground service and iOS background location service.
  - Streams coordinates every 10 meters via WebSocket `rider:location:update` to update Redis GEO key `riders:locations:active`, with HTTP fallback (`PATCH /riders/duty`).

---

## 3. Proximity Broadcast & Dispatch Sequences

Governed by the `order_flow_config` system setting ([ADR-002](../architecture-decision-records/ADR-002-dynamic-dual-order-flow-fsm.md)):

### 3.1 Mode 1: `RIDER_FIRST` (Zero Food Waste — Default)
1. Customer checkout completed & payment verified.
2. System searches Redis GEO index for online idle couriers within 3–5 km.
3. Socket.IO broadcasts `dispatch:broadcast` to matching couriers.
4. First courier to tap claims the trip via atomic Redis mutex lock (`POST /riders/orders/:id/claim`).
5. Order assigned (`RIDER_ASSIGNED`); vendor KDS sounds incoming audio chime to start prep.

### 3.2 Mode 2: `VENDOR_FIRST` (Traditional Retail)
1. Store prepares and packs items, then taps "Ready for Pickup" (`READY_FOR_PICKUP`).
2. System initiates proximity broadcast to nearby couriers.
3. Arriving courier picks up parcel and begins delivery.

---

## 4. The 3-Step Delivery Fulfillment Journey

```
[ STEP 1: CLAIM & PICK UP ] ──► [ STEP 2: DELIVER TO CUSTOMER ] ──► [ STEP 3: HANDOVER & CASH ]
```

### Step 1: Claim & Pick Up Food (`ActiveTripScreen` Step 1)
- **Broadcast Alert Modal (`IncomingTripModal`)**:
  - Displays outlet name, distance to outlet, customer delivery zone, and delivery remuneration.
  - Haptic feedback (`HapticFeedback.heavyImpact()`) and system alert sound pulsating every 3 seconds.
  - 45-second animated countdown bar shifting green ➔ amber ➔ urgent red (final 10 seconds).
  - One-tap claim button acquires Redis mutex lock (`SET NX EX 10`).
- **Store Pickup Execution**:
  - Direct turn-by-turn navigation handoff to Google Maps / Apple Maps.
  - One-tap direct store phone dialer button (`tel:`).
  - Visual parcel label: `LOOK FOR PACKAGE BAG - Order #...`.
  - Action: `"ORDER PICKED UP ➔ START DELIVERY"` calls `POST /orders/:id/pickup` (transitions to `DISPATCHED`).

### Step 2: Deliver to Customer (`ActiveTripScreen` Step 2)
- One-tap navigation to customer delivery coordinates.
- Displays full street address, building/floor, and customer delivery notes.
- Direct customer phone dialer button (`tel:`).
- Action: `"ARRIVED AT DOORSTEP ➔ HANDOVER"` advances to Step 3.

### Step 3: Complete Handover & Cash Verification (`ActiveTripScreen` Step 3)
- **Prepaid Online Orders**: Green banner indicating zero cash collection.
- **Cash on Delivery (COD) Orders**: Amber banner indicating exact cash amount in local currency with mandatory verification checkbox: *"I have collected ৳[Amount] in cash from customer"*. Button remains disabled until checked.
- Action: `"COMPLETE DELIVERY"` calls `POST /orders/:id/deliver` with `codCashCollected: true`, recording delivery and updating ledgers.

---

## 5. Doorstep Exceptions & Safety Protocols

### 5.1 Unresponsive Customer 5-Minute SOP Modal
- Triggered from Step 2 or 3 via `"Customer Unreachable at Doorstep?"` button (`_showUnreachableBottomSheet`).
- **Standard Operating Procedure**:
  1. Phone customer at least twice via dialer shortcut.
  2. Ring doorbell / knock at physical door.
  3. Wait minimum 5 minutes before reporting failure.
- **Digital 5-Minute Timer**: 300-second countdown in monospace `$minutes:$seconds`. Tapping "Call Customer" starts timer automatically.
- **Escalation**: `"Report Unresponsive & Release Order"` invokes `POST /orders/:id/issue`, releases courier, and alerts Dispatch HQ.

### 5.2 Real-Time Remote Cancellation Handling
- Listens to WebSocket event `order:cancelled`.
- If cancelled while on trip, app displays a full-screen cancellation modal with server-provided reason and releases courier to dashboard.

---

## 6. Daily Earnings & COD Cash Settlement

- **Timeframe Filter**: Toggle between `Today` and `This Week` (`RiderEarningsScreen`).
- **KPI Summary**: Total earnings, completed deliveries count, and average payout per trip.
- **COD Cash in Hand & Safety Limits**:
  - Progress meter tracking collected cash against configured safety limit (`max_cash_limit`, default ৳5,000 / 500 SAR).
  - Shifts color: Green ➔ Amber (80%) ➔ Red (100%).
  - Invariant: Couriers reaching 100% limit are excluded from new COD broadcasts until cash is deposited.
- **Hub Cash Deposit Flow**: Courier records physical cash handover at logistics hub (`POST /rider/cash/deposit`) with reference number and deposit amount for administrative audit.
- **Trip Receipts & Lazy List Virtualization**: Itemized history of completed deliveries with order numbers, addresses, and earnings. Rendered via `CustomScrollView` with lazy `SliverList.builder` to ensure smooth 60/120fps scrolling and eliminate memory leaks over extended multi-hour shifts.
