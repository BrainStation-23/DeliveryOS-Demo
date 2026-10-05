# 02 — Stakeholder Roles & Access Specifications

Authoritative definitions of platform roles, interface boundaries, functional capabilities, inputs, outputs, and operational invariants for all platform actors.

---

## 1. Role Matrix Overview

| Role Enum | Interface Platform | Tenant Scope | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| `CUSTOMER` | Mobile App (Flutter) | User-owned records | Store discovery, cart configuration, checkout, order tracking, phone dialer handoffs, re-order. |
| `VENDOR_ADMIN` | Web Portal (`/vendor`) | Assigned outlet(s) | Order receipt via Web Audio chime, KDS progression, stockout toggles, store hours, sales ledger. |
| `RIDER` | Mobile App (Flutter) | Assigned trips | Shift duty toggle, proximity broadcast claim, 3-step fulfillment, COD collection, cash hub deposit. |
| `SUPER_ADMIN` | Web Portal (`/admin`) | Global (unrestricted) | Master catalog authority, live fleet radar, dispatch override, promotions, settings, financial export. |
| `SUPPORT` | Web Portal (`/admin`) | Read-only global | Order timeline audit, customer/rider details inspection, operational issue resolution. |

---

## 2. Granular Role Specifications

### 2.1 Customer (`CUSTOMER`)
- **Interface**: Flutter Customer Mobile App (iOS & Android).
- **Core Capabilities**:
  - Authenticate via Phone OTP (`+880` / `+966`) or browse catalogs anonymously as Guest.
  - Pin delivery coordinates on interactive map; manage saved addresses with custom delivery notes.
  - Maintain a single-vendor cart; select item variants.
  - Validate address delivery coverage against outlet radius via PostGIS.
  - Apply promotional coupon codes with automatic threshold validation.
  - Pay via Cash on Delivery (COD) or Online Payment Gateway.
  - Track live order status stepper and real-time courier map location.
  - Initiate direct OS phone calls to merchant or courier via native dialer.
  - Repeat past orders via 1-tap Smart Re-Order with automated inventory and operational checks.
- **Inputs**: Phone number, OTP code, delivery coordinates, cart selections, coupon code, customer notes.
- **Outputs**: Created order, payment transaction, cancellation request, saved address record.
- **Invariants & Constraints**:
  - Cannot place multi-vendor orders in a single checkout.
  - Cannot select an address outside the active outlet's `delivery_radius_km`.
  - Self-service cancellation is restricted to `PLACED` and `RIDER_ASSIGNED` states (prior to kitchen prep).
- **Edge Cases**:
  - Payment failure: UI offers instant "Switch to Cash (COD)" recovery button.
  - Item unavailable during re-order: App alerts customer, omits sold-out items, and loads remaining items.

### 2.2 Vendor Staff (`VENDOR_ADMIN`)
- **Interface**: React 18 SPA (`apps/vendor_portal` at `/vendor`).
- **Core Capabilities**:
  - Receive real-time orders with continuous in-memory Web Audio bell alarm.
  - Acknowledge orders with custom preparation duration (`15m`–`45m`) or 1-tap default prep time.
  - Reject orders with structured reason codes (`OUT_OF_STOCK`, `KITCHEN_OVERLOAD`, `STORE_CLOSING_SOON`, `OTHER`).
  - Advance orders from `PREPARING` to `READY_FOR_PICKUP` and confirm courier handover (`DISPATCHED`).
  - Toggle item and variant stock availability in real time.
  - Configure daily 7-day operating hours and trigger emergency "Rush Hour Pause".
  - Inspect itemized sales receipts, commission deductions, and net payable balances.
- **Inputs**: Prep duration, rejection reason, stock toggle state, operating schedules, rush pause toggle.
- **Outputs**: Order status transitions, updated catalog stock states, modified operating hours.
- **Invariants & Constraints**:
  - Data queries strictly scoped by tenant isolation: `WHERE vendor_id = user.vendorId` (unless granted `ALL_OUTLETS_MASTER`).
  - Web Audio alarm chime persists until all unaccepted orders in Lane 1 are processed.
- **Edge Cases**:
  - Rush hour pause active: Blocks incoming customer checkout while keeping active in-progress orders intact.

### 2.3 Delivery Rider (`RIDER`)
- **Interface**: Flutter Rider Mobile App (iOS & Android).
- **Core Capabilities**:
  - Register with mobile phone, name, and vehicle type (`motorcycle`, `bicycle`).
  - Toggle shift duty state (`Online` / `Offline`).
  - Receive proximity broadcast modal with 45-second animated countdown and haptic alert.
  - Claim broadcasted order via atomic Redis mutex lock.
  - Complete 3-step sequential fulfillment: Pick Up ➔ Deliver to Doorstep ➔ Handover & COD verification.
  - Launch native turn-by-turn navigation (Google Maps / Apple Maps).
  - Execute 5-minute unresponsive customer SOP with digital countdown timer.
  - Track daily earnings, completed trips, and physical cash-in-hand balance.
  - Record cash deposits handed over at central logistics hubs.
- **Inputs**: Phone OTP, duty toggle, broadcast claim tap, pickup confirmation, COD collected checkbox, cash deposit details.
- **Outputs**: Order status transitions (`RIDER_ASSIGNED`, `DISPATCHED`, `DELIVERED`), real-time GPS coordinates, issue reports.
- **Invariants & Constraints**:
  - **In-Flight Duty Lock**: Cannot switch to `Offline` while carrying an active delivery (`RIDER_ASSIGNED` or `DISPATCHED`).
  - **Cash Limit Invariant**: Blocked from receiving new COD orders when `cash_in_hand >= max_cash_limit` until cash is deposited.
  - Cannot mark order `DELIVERED` on COD orders without verifying the cash collection checkbox.
- **Edge Cases**:
  - Order cancelled remotely: Displays full-screen cancellation alert with reason and releases courier to dashboard.

### 2.4 Super Admin (`SUPER_ADMIN`)
- **Interface**: React 18 SPA (`apps/admin_portal` at `/admin`).
- **Core Capabilities**:
  - Central master catalog authority: create, modify, re-price, or toggle items across all outlets.
  - Monitor fleet in real time on interactive Leaflet OSM radar map.
  - Manually force-assign or reassign unassigned orders to any online courier.
  - Manually cancel orders with mandatory audit trail reason (minimum 5 characters).
  - Review and approve courier applicant registrations; adjust courier cash safety limits.
  - Create and configure merchant outlets, commission rates, delivery radiuses, and staff scopes.
  - Manage promotional hero banners and discount coupon codes.
  - Toggle order flow FSM mode (`RIDER_FIRST` vs `VENDOR_FIRST`) and delivery fee pricing mode (`FIXED_FLAT` vs `DISTANCE_TIERED`).
  - Generate RFC 4180 CSV financial settlement exports and trigger weekly payout cycles.
- **Inputs**: Catalog edits, override assignments, approval toggles, fee parameters, coupon configurations, settlement cycle triggers.
- **Outputs**: System settings updates, force assignments, financial CSV exports, approved vendor/rider profiles.
- **Invariants & Constraints**:
  - Unrestricted global access bypassing all multi-tenant filters.
  - Force-cancellation requires an explicit, audited reason of at least 5 characters.
