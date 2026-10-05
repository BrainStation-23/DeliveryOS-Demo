# 07 — Super Admin Operations & 10-Vendor Pilot Guide

Operational specifications, master console controls, dispatch overrides, financial settlements, and pilot launch playbooks for the **Super Admin Master Console** (React 18 SPA at `/admin`).

---

## 1. Master Console Modules & Route Architecture

Single source of truth: `apps/admin_portal/src/config/adminNavigation.ts`. Sidebar navigation, mobile drawer, page headers, document titles, and multi-language translations (`en`, `bn`, `ar`) are strictly bound to this contract.

```
/admin
├── / & /dashboard    # LayoutDashboard: Analytics & Overview (KPI Cards w/ Trends, Charts, Top Outlets & Couriers, Order Feed)
├── /orders           # ClipboardList: Order History (Status Glance Cards, Lifecycle Tabs, Date Filter, Search & Overrides)
├── /fleet            # Bike: Rider Fleet & Dispatch (Live Leaflet Radar, Unassigned Pool, Paginated Roster & Courier Details; /dispatch redirects here)
├── /vendors          # Building2: Brands & Outlets Governance + Staff Accounts Registry; /outlets/:id Outlet Page (aliases /outlets)
├── /customers        # Users: Customer Directory (Filters, Lifetime Value, Delivery Profiles & LTV Analytics)
├── /promotions       # Megaphone: Promotions & Banners (Hero Carousel Banners w/ Tap Deeplinks & Discount Coupon Engine)
├── /media            # Images: Media Library (Central Media Asset Management w/ Client-Side Crop & Aspect Presets)
├── /finance          # Landmark: Finance & Settlements (Unified Per-Order Ledger, Vendor Settlements & Courier Cash Deposits)
└── /settings         # Settings: System Settings (Order Flow FSM, Delivery Fee & Economics, Stale-Order TTL)
```

All table datasets across the console adhere to unified pagination standards:
- `<Table>` components render explicit entry counters (`Total {totalItems} entries`), accessible page buttons, and smooth transition states.
- Client and server-side datasets (Rider Roster, Brands Grid, Per-Order Ledger, Cash Deposits, Staff Accounts, Coupons) integrate clean page controls (`PAGE_SIZE = 10` or `15`) that automatically reset to page 1 upon query, filter, or date range adjustments.
- All monetary and timestamp renderings consume centralized formatting primitives (`formatCurrency`, `formatDateTime`).


---

## 2. Administrative Controls & Workflows

### 2.1 Live Fleet Radar & Dispatch Command (`/fleet`)
- **Interactive Mapping Engine**: Leaflet OpenStreetMap radar tracking active couriers and unassigned orders (`LiveFleetMap`).
- **Color-Coded Courier Pins**:
  - Emerald (`#10b981`): Online & idle, ready for dispatch.
  - Sky (`#0284c7`): In-flight active delivery.
  - Amber (`#ea580c`): Approaching COD cash collection limit ($\ge 80\%$).
  - Slate (`#64748b`): Offline.
- **Unassigned Orders Radar**: Bouncing amber target markers displaying order number, store name, and gross subtotal.
- **SPA Deep Linking**: Map popup button `"Open Order →"` navigates to `/orders?orderNumber=...` via React Router without triggering page reloads or dropping WebSocket connections.

### 2.2 Courier Fleet Governance & Applicant Queue (`/fleet`)
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
- **Outlet Onboarding & Geolocation**: Review self-registered vendor applications or directly onboard new outlets and staff logins (`POST /admin/vendors`). Outlet coordinates are set via interactive `LocationPickerModal` with draggable map pin, OpenStreetMap tiles, geocoding search, area presets, and HTML5 GPS detection, eliminating manual coordinate errors.
- **Brand & Outlet Deletion Invariants**: Brands with active outlets or staff cannot be deleted (Delete button is hidden). Outlets tagged with any staff, menu categories, catalog items, or historical orders cannot be deleted; the Delete Outlet action button remains strictly invisible on both the brand outlet roster and outlet detail header until all three prerequisites (staff, categories, items) reach zero.
- **Permission Assignment**: Assign `PARTICULAR_OUTLET` (single-branch staff) or `ALL_OUTLETS_MASTER` (multi-outlet brand owner).
- **Store Configuration**: Commission rate (e.g. 15%), delivery radius (km), operational hours, and default prep time.

### 2.6 System Settings & Financial Settlements (`/settings`)
- **Outlet Types Manager**: Admin-defined business types (Restaurant, Grocery, Pharmacy, …) assigned at outlet create/edit; switching a type off hides all its outlets from the customer app, deletes are blocked while outlets are assigned (ADR-019).
- **Per-Outlet Flow Mode**: Each outlet's dispatch sequence (`RIDER_FIRST` Zero Food Waste / `VENDOR_FIRST` Traditional Retail) is set on the outlet form; global settings retain only the dispatch timing knobs.
- **Delivery Fee Pricing Engine**: Toggle between `FIXED_FLAT` (uniform flat rate) and `DISTANCE_TIERED` (base fee + per-km fee).
- **RFC 4180 CSV Settlement Export**: Download formatted `vendor-settlements-YYYY-MM-DD.csv` for enterprise accounting systems (ERP / QuickBooks) ([ADR-009](../architecture-decision-records/ADR-009-deterministic-financial-accounting-ledger.md)).
- **Settlement Batch Trigger**: Modal to execute settlement cycles via `POST /admin/finance/settlement-cycle`.

---

## 3. 10-Vendor Pilot Launch Playbook (1-Month Run)

### Week 0: Pre-Launch Configuration
- [ ] Define pilot delivery zone (3–5 km radius geofence).
- [ ] Onboard 10 pilot merchants (7 restaurants/cafes, 3 grocery/super shops).
- [ ] Assign store staff permissions (`PARTICULAR_OUTLET` vs `ALL_OUTLETS_MASTER`).
- [ ] Digitize full menus, prices, variants, and photos.
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
