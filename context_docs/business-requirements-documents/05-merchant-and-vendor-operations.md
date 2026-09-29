# 05 — Merchant & Vendor Portal Specification

Operational guidelines, permission hierarchies, KDS mechanics, stock management, and financial reporting for the **Vendor Store Portal** (React 18 SPA at `/vendor`).

---

## 1. Onboarding & Account Lifecycle

### 1.1 Onboarding Pathways
1. **Self-Registration Pathway (`/vendor/register`)**:
   - Merchant submits business name, vertical (`FOOD`, `GROCERY`, `SUPER_SHOP`, `PHARMACY`), contact phone, and store coordinates.
   - Initial state: `PENDING_APPROVAL`.
   - Requires Super Admin review before store appears in customer discovery.
2. **Direct Super Admin Creation (`/admin/vendors`)**:
   - Platform administrator creates store record, configures commission, coordinates, and creates staff login directly.
   - Store goes live immediately upon activation.

---

## 2. Two-Tier Vendor Permission Scopes

Governed by `vendor_staff.scope` ([ADR-005](../architecture-decision-records/ADR-005-micro-frontends-and-subpath-routing.md)):

### 2.1 Particular Outlet Permission (`PARTICULAR_OUTLET`)
- **Scope**: Strictly bound to a single physical outlet ID (`vendor_id`).
- **Capabilities**:
  - Live 3-lane KDS board for assigned outlet only.
  - Stock availability toggle for items and variants at that location.
  - Operating hours and emergency pause for that outlet.
  - Daily sales receipts and ledger for that location.
- **UI Lock**: Top navbar renders a locked store pill (`Store` + `Lock` icons) indicating isolated branch access.

### 2.2 All Outlets Master Permission (`ALL_OUTLETS_MASTER`)
- **Scope**: Brand owner account across all merchant chain locations (`brand_id`).
- **Capabilities**:
  - Top header `OutletSwitcher` dropdown to toggle between individual branches or aggregate across all branches (`ALL`).
  - View consolidated sales volume, commission deductions, and net payout statements across the entire brand.
  - Push brand-wide menu pricing and item updates.

---

## 3. Route & Module Architecture

```
/vendor
├── / & /kds           # 3-Lane Kitchen Display System (KDS)
├── /catalog           # Merchant Menu Catalog, Sold-Out Retention & Stock Toggles
├── /orders            # Itemized Sales Ledger, Today vs All Time, Payout Statements
└── /settings          # Operating Hours, Default Prep Duration & Rush Pause
```

---

## 4. Module 1: Live Kitchen Order Console (`/kds`)

### 4.1 Web Audio API Synthesized Bell Chime (ADR-007)
- **Audio Engine**: In-memory synthesis via Web Audio API, eliminating external `.mp3` dependencies and 404 network failures.
- **Frequencies**: Dual-tone harmonic bells (D5 587.33 Hz sine wave + A5 880.00 Hz triangle wave).
- **Alarm Loop**: Chime repeats every 3 seconds upon incoming orders via WebSocket `order:new`.
- **Guaranteed Silence Invariant**: Audio loop stops **strictly when all unaccepted orders in Lane 1 have been accepted or rejected**.
- **Browser Interaction Unlock**: Automatically resumes suspended audio context upon first user tap anywhere on the page.

### 4.2 3-Lane Kanban Workflow

#### Lane 1: New Orders (`PLACED` or `RIDER_ASSIGNED`)
- **Displays**: Pulsing rose badge, order number, elapsed arrival timer, dishes, quantities, add-ons, cooking notes, and courier badge.
- **Actions**:
  - *One-Tap Accept*: Automatically applies store's default prep duration (e.g. 20 min) and advances order directly to `PREPARING` ([ADR-002](../architecture-decision-records/ADR-002-dynamic-dual-order-flow-fsm.md)).
  - *Custom Prep Time*: Selector pills for `[15, 20, 25, 35, 45]` minutes.
  - *Structured Reject*: Opens modal requiring reason code (`OUT_OF_STOCK`, `KITCHEN_OVERLOAD`, `STORE_CLOSING_SOON`, `OTHER`) with optional notes. Transitions order to `CANCELLED`.

#### Lane 2: In Preparation (`PREPARING`)
- **Displays**: Digital countdown timer (`CountdownTimer`) computing remaining time from `acceptedAt + prepTimeMinutes`.
- **SLA Breach Visuals**: Shifts from amber to flashing pulse-red when timer reaches 00:00 (overdue).
- **Action**: Tapping `"Ready for Pickup"` marks packaging complete and advances order to `READY_FOR_PICKUP`.

#### Lane 3: Ready for Pickup (`READY_FOR_PICKUP`)
- **Displays**: Assigned courier name, phone dialer shortcut, and arrival status.
- **Action**: Tapping `"Hand to Rider"` confirms physical package handover and moves order to `DISPATCHED`.

### 4.3 1-Click Rush Hour Pause
- **Controls**: Navbar toggle with flame icon: `"Rush Pause"` ➔ `"Rush Paused (Resume)"`.
- **System Impact**: Updates `vendor.is_busy = true`, blocking customer checkouts while keeping in-progress orders active.
- **Banner**: Amber banner across top of portal with instant `"Resume Orders Now"` button.

---

## 5. Module 2: Merchant Catalog & Stockout Management (`/catalog`)

### 5.1 Dedicated Merchant Catalog View (`GET /vendor/catalog`)
- **Retention Invariant**: Unlike customer storefronts that omit sold-out dishes, this merchant endpoint displays all items regardless of stock status.
- **KPI Summary**: Real-time counter of Total Dishes, In-Stock Dishes, and Sold-Out Dishes.

### 5.2 1-Click Stock Toggles
- **Dish-Level Toggle**: Toggles item availability calling `PATCH /vendor/products/:id/stock` (`isInStock: boolean`).
- **Variant-Level Toggle**: Toggles specific variant availability calling `PATCH /vendor/products/variants/:id/stock`.
- **Optimistic UI**: TanStack Query updates UI instantly with red border and "Sold Out" badge.

---

## 6. Module 3: Store Operations & Operating Schedule (`/settings`)

- **Default Preparation Duration**: Dropdown selector (`15`, `20`, `25`, `30`, `45` min) used for 1-tap KDS order acceptance.
- **Weekly 7-Day Schedule**: Form configuring opening and closing times for Sunday through Saturday, with individual closed-day checkboxes (`PUT /vendor/operating-hours`).
- **Emergency Timed Pause**: Preset pause durations (`30 minutes`, `1 hour`, `Rest of Day`).

---

## 7. Module 4: Sales Ledger & Financial Statements (`/orders`)

- **Timeframe Filters**: Segmented control switching between `Today` (default) and `All Time`.
- **Dynamic KPI Summary**: Recalculates Completed Orders, Gross Volume, Commission Deducted (15%), and Net Vendor Payable based on active filter.
- **Itemized Order Details Modal**:
  - Customer contact snapshot and delivery address.
  - Special cooking instructions note.
  - Itemized breakdown of quantities, variants, add-ons, unit prices, and line item subtotals.
  - Financial breakdown: Gross amount, platform commission, net payable, payment method, and settlement status (`SETTLED` vs `PENDING`).
