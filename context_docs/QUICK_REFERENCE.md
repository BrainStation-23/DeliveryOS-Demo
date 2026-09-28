# DeliveryOS — Quick Reference & AI Context Router

> **AI AGENT USAGE**: Read this file first to locate the **exact file** you need. Do NOT load the entire documentation directory into context.  
> **ENGINEERING PROTOCOL**: Every code modification must follow the 3-Phase Spec-Driven Development Workflow:  
> 👉 **[`README.md#spec-driven-development-workflow-3-phase-protocol`](../README.md#-spec-driven-development-workflow-3-phase-protocol)**

---

## 1. 3-Phase Spec-Driven Development Workflow Quick Index

| Phase | Core Objective | Key Gateways & Checkpoints |
| :--- | :--- | :--- |
| **Phase 1: Plan & Grounding** | Spec alignment & ambiguity clearance | Context Router lookup ➔ Check ADRs/BRDs/TIDs ➔ Formulate plan ➔ Zero assumptions (`/grill-me`) |
| **Phase 2: Implementation** | Production-ready execution | Strict typing (`"strict": true`, 0 `any`) ➔ Design system tokens (`AppColors`, `AppTypography`, `AppSpacing`, Tailwind semantic classes) ➔ Zero mock shortcuts ➔ Minimal comments (§ 3.6) |
| **Phase 3: Verification & Sync** | Quality gate & living docs synchronization | Automated tests (`npm test`, `flutter test`) ➔ Static analysis (`tsc`, `flutter analyze`) ➔ Update `FEATURES.md`, `CHANGELOG.md` ➔ Await explicit commit command |

👉 For full workflow details and repeatable checklists, see [root README.md](../README.md#-spec-driven-development-workflow-3-phase-protocol).

---

## 2. Task-to-File Context Router (Read Only What You Need)

| If Your Task Involves... | Load ONLY These Documents |
| :--- | :--- |
| **3-Phase Spec-Driven Development Workflow** | [`README.md (Spec-Driven Workflow)`](../README.md#-spec-driven-development-workflow-3-phase-protocol) |
| **Master AI Engineering Rules, Standards & DoD** | [`AGENT_RULES.md`](./AGENT_RULES.md) |
| **Granular Master System Feature Catalog** | [`FEATURES.md`](../FEATURES.md) |
| **Engineering Roadmap, Milestones & Changelog** | [`CHANGELOG.md`](../CHANGELOG.md) |
| **Non-Technical Master Product Overview** | `BRD-00` (`00-master-product-overview.md`) |
| **Architecture Decision Records (ADR Index)** | [`ADR Index`](./architecture-decision-records/README.md) (`ADR-001` through `ADR-011`) |
| **Monorepo Topology, Ingress & Routing** | `ADR-001`, `ADR-005` + `TID-01`, `TID-07` |
| **Design System Tokens & Governance (Flutter/React)** | `AGENT_RULES.md` (§ 3.7) + `CHANGELOG.md` (v1.4.3) + `apps/*/constants/` |
| **Order Flow FSM (`RIDER_FIRST` vs `VENDOR_FIRST`)** | `ADR-002` + `TID-05` + `BRD-03` |
| **Order Cancellation, Vendor Rejection & Refunds** | `ADR-002` + `TID-03` (Sec 3.10) + `apps/vendor_portal` |
| **Spatial PostGIS Geofencing & Redis Geohash Radar** | `ADR-003` + `TID-02` + `TID-05` |
| **Rider Atomic Claim Mutex & Concurrency** | `ADR-004` + `TID-05` + `TID-04` |
| **Frontend State (Zustand + React Query) & WS** | `ADR-006` + `TID-06` + `TID-04` |
| **Vendor KDS Web Audio Synthesizer Chime** | `ADR-007` + `apps/vendor_portal` + `BRD-05` |
| **Vendor Store Hours & Busy Pause Guard** | `BRD-05` (Sec 4) + `TID-03` (Sec 4.4) + `services/backend_api` |
| **Vendor 2-Tier Permissions (Outlet vs Master)** | `BRD-05` (Sec 2) + `TID-02` + `TID-03` (Sec 4.1) |
| **Vendor Catalog, Menu, Variants & Stockout Toggles**| `BRD-05` (Sec 5) + `TID-03` (Sec 4.3) + `TID-02` |
| **Immutable JSONB Snapshots & Financial Ledgers** | `ADR-008`, `ADR-009` + `TID-02` + `BRD-03` |
| **Multi-Gateway Payment & Webhook Idempotency** | `ADR-011` + `TID-03` (Sec 7) + `TID-04` |
| **Financial Settlement Cycles & Net COD Cash Offset**| `ADR-009` + `TID-03` (Sec 6.6) + `BRD-07` |
| **AI Governance, Invariants & No-Auto-Commits** | `ADR-010` + `AGENT_RULES.md` + `README.md` |
| **Authentication, OTP, JWT, Role Guards** | `TID-03` (API Specs: Sec 2) + `TID-02` (Users table) |
| **Customer App UI, Cart, Banners, Coupons** | `BRD-04` (Customer Journey) + `TID-03` (API Specs: Sec 3) |
| **Customer Search Direct Add & Cart Conflict Modal** | `BRD-04` (Sec 3) + `apps/customer_app` |
| **Cart Address Geofence Guard & Radius Check** | `BRD-03` (Sec 1.3) + `BRD-04` (Screen 6) + `TID-02` + `TID-03` |
| **Switch-to-COD Failure Recovery** | `BRD-04` (Screen 8) + `TID-03` (Sec 3.9) + `ADR-011` |
| **Re-Order Validation Logic** | `BRD-04` (Screen 9) + `TID-03` (Sec 3.8) + `BRD-03` |
| **Rider App UI & 3-Step Delivery Fulfillment** | `BRD-06` (Rider Ops) + `TID-03` (Sec 5.3) |
| **Rider Duty In-Flight Lock & Background GPS** | `BRD-06` (Sec 2) + `apps/rider_app` + `TID-03` (Sec 5.1) |
| **Rider COD Cash Deposit & Hub Verification Flow** | `BRD-06` (Sec 6) + `TID-03` (Sec 5.5) + `TID-02` |
| **Rider 5-Min Doorstep SOP Modal & Issue Report** | `BRD-06` (Sec 5.1) + `TID-03` (Sec 5.4) |
| **Rider Dispatch, Radius Search, Redis Mutex** | `TID-05` (State Machine & Dispatch) + `TID-04` (Sec 3.3) |
| **Super Admin Console, Banners, Coupons, Orders** | `apps/admin_portal` + `BRD-07` + `TID-03` (Sec 6) + `TID-06` |
| **Super Admin Live Fleet Radar (Leaflet OSM)** | `apps/admin_portal` + `BRD-07` (Sec 2.1) + `TID-06` |
| **Super Admin Courier Approval Queue & COD Limits** | `apps/admin_portal` + `BRD-07` (Sec 2.2) + `TID-03` (Sec 6.2) |
| **Order Deep Linking (?orderNumber) & Overrides** | `apps/admin_portal` + `BRD-07` (Sec 2.3) + `TID-03` (Sec 6.1) |
| **Delivery Fees (Flat vs Distance) & Ledgers** | `BRD-03` (Sec 4 & 5) + `TID-02` (Ledger tables) |
| **CSV/JSON Settlement Statements Export** | `BRD-07` (Sec 2.6) + `TID-03` (Sec 6.6) + `ADR-009` |
| **Database Schema, PostGIS Queries, Migrations** | `TID-02` (Database Schema & DDL) |
| **WebSockets, Realtime Rooms & Payloads** | `TID-04` (WebSocket Protocol) |
| **Docker, Nginx, Environment Variables, Setup** | `TID-07` (DevOps & Environment Setup) |

---

## 3. Core Enums & Invariant Values

```typescript
// Roles & Permissions
enum UserRole { SUPER_ADMIN = 'SUPER_ADMIN', VENDOR_ADMIN = 'VENDOR_ADMIN', RIDER = 'RIDER', CUSTOMER = 'CUSTOMER' }
enum PermissionScope { PARTICULAR_OUTLET = 'PARTICULAR_OUTLET', ALL_OUTLETS_MASTER = 'ALL_OUTLETS_MASTER' }

// Order Lifecycle FSM
enum OrderStatus { 
  PLACED = 'PLACED', 
  RIDER_ASSIGNED = 'RIDER_ASSIGNED',
  ACCEPTED = 'ACCEPTED', // Deprecated runtime state: transitions directly to PREPARING (ADR-002)
  PREPARING = 'PREPARING', 
  READY_FOR_PICKUP = 'READY_FOR_PICKUP', 
  DISPATCHED = 'DISPATCHED', 
  DELIVERED = 'DELIVERED', 
  CANCELLED = 'CANCELLED' 
}

// Payment & Fees
enum PaymentMethod { CASH_ON_DELIVERY = 'CASH_ON_DELIVERY', ONLINE_GATEWAY = 'ONLINE_GATEWAY' }
enum PaymentStatus { PENDING = 'PENDING', PAID = 'PAID', REFUNDED = 'REFUNDED', FAILED = 'FAILED' }
enum SettlementStatus { PENDING = 'PENDING', PROCESSING = 'PROCESSING', SETTLED = 'SETTLED' }
enum CashDepositStatus { PENDING_APPROVAL = 'PENDING_APPROVAL', APPROVED = 'APPROVED', REJECTED = 'REJECTED' }
enum DeliveryFeeMode { FIXED_FLAT = 'FIXED_FLAT', DISTANCE_TIERED = 'DISTANCE_TIERED' }
enum DiscountType { PERCENTAGE = 'PERCENTAGE', FLAT = 'FLAT' }

// Configurable Order Dispatch Flow Sequence
enum OrderFlowMode { 
  RIDER_FIRST = 'RIDER_FIRST',     // Rider claimed first -> Sent to Vendor for manual acceptance -> Zero food waste
  VENDOR_FIRST = 'VENDOR_FIRST'    // Vendor accepts & preps first -> Rider broadcasted when ready
}
```

---

## 4. Production Code Patterns (Copy-Paste Ready)

### A. Atomic Order Status / Financial Transaction (NestJS + Prisma)
```typescript
await prisma.$transaction(async (tx) => {
  const order = await tx.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.DELIVERED, deliveredAt: new Date() }
  });
  await tx.riderTripLedger.create({
    data: { orderId: orderId, riderId: riderId, deliveryEarnings: earnings, codCollected: codAmount }
  });
});
```

### B. Redis Atomic Lock for Order Claims (Prevents Race Conditions)
```typescript
const acquired = await redis.set(`lock:order_claim:${orderId}`, riderId, 'NX', 'EX', 10);
if (!acquired) throw new ConflictException('Order already accepted by another rider');
```

### C. Standard API Response Envelope
```typescript
return { success: true, statusCode: HttpStatus.OK, message: 'Success', data: payload };
```
