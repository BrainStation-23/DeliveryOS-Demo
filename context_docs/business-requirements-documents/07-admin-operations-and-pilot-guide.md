# 07 — Super Admin Operations & 10-Vendor Pilot Guide

Operational specifications, master console controls, dispatch overrides, financial settlements, and pilot launch playbooks for the **Super Admin Master Console** (React 18 SPA at `/admin`).

---

## 1. Master Console Modules & Route Architecture

```
/admin
├── / & /dashboard    # Operational Overview, Real-time KPIs & Order Feed
├── /dispatch         # Leaflet Live Fleet Radar & Applicant Couriers Queue
├── /orders           # Order Lifecycle Monitor, ?orderNumber Deep Linking & Overrides
├── /promotions       # Hero Carousel Banners & Discount Coupon Engine
├── /vendors          # Outlet Onboarding, Commission Rates & Staff Scopes
└── /settings         # Order Flow FSM, Delivery Fee Economics & CSV Settlements
```

---

## 2. Administrative Controls & Workflows

### 2.1 Live Fleet Radar & Dispatch Command (`/dispatch`)
- **Interactive Mapping Engine**: Leaflet OpenStreetMap radar tracking active couriers and unassigned orders (`LiveFleetMap`).
- **Color-Coded Courier Pins**:
  - Emerald (`#10b981`): Online & idle, ready for dispatch.
  - Sky (`#0284c7`): In-flight active delivery.
  - Amber (`#ea580c`): Approaching COD cash collection limit ($\ge 80\%$).
  - Slate (`#64748b`): Offline.
- **Unassigned Orders Radar**: Bouncing amber target markers displaying order number, store name, and gross subtotal.
- **SPA Deep Linking**: Map popup button `"Open Order →"` navigates to `/orders?orderNumber=...` via React Router without triggering page reloads or dropping WebSocket connections.

### 2.2 Courier Fleet Governance & Applicant Queue (`/dispatch`)
- **Applicant Queue**: Dedicated tab displaying newly registered couriers in `PENDING_APPROVAL` status.
- **1-Click Approval / Suspension**: Instant toggle activating courier accounts (`PATCH /admin/riders/:id/approval`) or suspending problematic couriers.
- **Cash Limit Adjustment Modal**: Allows operations staff to modify courier's `max_cash_limit` (e.g. from ৳5,000 to ৳10,000) based on tenure and trust.

### 2.3 Live Order Monitor & Administrative Overrides (`/orders`)
- **Deep Linking**: Navigating to `/orders?orderNumber=ORD-XXXX` automatically filters table, shows active filter banner, and opens order details modal.
- **Force-Assign Courier Modal**:
  - Displays customer notes and itemized line items list.
  - Displays list of online couriers with active trip status and current cash-in-hand balance.
  - Action: Invokes `POST /admin/orders/:id/force-assign` to bypass automated proximity broadcast.
- **Force-Cancel Order Modal**:
  - Surfaces reversal alert: releases courier, voids payment holds, and triggers ledger reversal.
  - Mandatory audit reason textarea (minimum 5 characters).
  - Action: Invokes `POST /admin/orders/:id/cancel` and broadcasts cancellation via WebSockets.

### 2.4 Promotional Campaigns & Coupons (`/promotions`)
- **Hero Carousel Banner Management**: Tab to schedule, activate, prioritize, and delete homepage promotion banners with image previews.
- **Discount Coupon Engine**:
  - Alphanumeric promo codes with flat or percentage discount modes.
  - Configurable minimum order spend, maximum discount ceiling, and total usage limits.
  - 1-click active/inactive toggle and deletion.

### 2.5 Restaurant & Outlet Management (`/vendors`)
- **Outlet Onboarding**: Review self-registered vendor applications or directly create new outlets and staff logins (`POST /admin/vendors`).
- **Permission Assignment**: Assign `PARTICULAR_OUTLET` (single-branch staff) or `ALL_OUTLETS_MASTER` (multi-outlet brand owner).
- **Store Configuration**: Commission rate (e.g. 15%), delivery radius (km), operational hours, and default prep time.

### 2.6 System Settings & Financial Settlements (`/settings`)
- **Order Flow FSM Selector**: 1-click toggle between `RIDER_FIRST` (Zero Food Waste Mode) and `VENDOR_FIRST` (Traditional Retail Mode).
- **Delivery Fee Pricing Engine**: Toggle between `FIXED_FLAT` (uniform flat rate) and `DISTANCE_TIERED` (base fee + per-km fee).
- **RFC 4180 CSV Settlement Export**: Download formatted `vendor-settlements-YYYY-MM-DD.csv` for enterprise accounting systems (ERP / QuickBooks) ([ADR-009](../architecture-decision-records/ADR-009-deterministic-financial-accounting-ledger.md)).
- **Settlement Batch Trigger**: Modal to execute settlement cycles via `POST /admin/finance/settlement-cycle`.

---

## 3. 10-Vendor Pilot Launch Playbook (1-Month Run)

### Week 0: Pre-Launch Configuration
- [ ] Define pilot delivery zone (3–5 km radius geofence).
- [ ] Onboard 10 pilot merchants (7 restaurants/cafes, 3 grocery/super shops).
- [ ] Assign store staff permissions (`PARTICULAR_OUTLET` vs `ALL_OUTLETS_MASTER`).
- [ ] Digitize full menus, prices, variants, add-ons, and photos.
- [ ] Deploy 2–3 welcome promotional banners and a pilot coupon code (`PILOT50`).
- [ ] Ensure store tablet hardware and audio output are active at counters.
- [ ] Onboard and approve 5–8 active riders.
- [ ] Set delivery fee mode to `FIXED_FLAT` (50.00 BDT / 12.00 SAR).

### Week 1: Soft Launch & Controlled Testing
- [ ] Restrict ordering to lunch and dinner peak windows (e.g. 12:00 PM – 9:00 PM).
- [ ] Run end-to-end test orders across all 10 vendors to test synthesized bell chime and COD collection.
- [ ] Validate that the Cart Address Geofence Guard strictly rejects out-of-boundary delivery pins.

### Week 2: Public Launch
- [ ] Open ordering to the public within pilot geofence.
- [ ] Deploy partner QR standees at pilot store counters.
- [ ] Monitor acceptance times, prep durations, and courier broadcast claiming.

### Week 3: SLA & Operations Tuning
- [ ] Audit delivery completion times (target: $< 35$ minutes).
- [ ] Adjust default prep times for slower kitchens; rectify recurring stockouts.

### Week 4: Pilot Audit & Expansion Sign-Off
- [ ] Export 30-day financial settlement CSVs; reconcile commissions and net payables.
- [ ] Review customer feedback, vendor retention, and courier earnings.
- [ ] Approve Phase 2 expansion to 50+ merchants and secondary delivery zones.
