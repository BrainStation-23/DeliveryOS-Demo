# Business Requirements Documents (BRD) Suite
### DeliveryOS — Hyperlocal On-Demand Multi-Vendor Platform

Authoritative business specifications, commercial rules, user journeys, operational playbooks, and stakeholder role matrices for the DeliveryOS platform.

---

## 1. Document Index

- **[00-master-product-overview.md](./00-master-product-overview.md)** — **Master Product Overview & Capability Catalog**: Plain-English platform guide, 4-app breakdown, end-to-end lifecycle, and commercial model.
- **[01-executive-summary-and-vision.md](./01-executive-summary-and-vision.md)** — **Executive Summary & Platform Scope**: High-level platform mission, multi-vertical strategy, phased roadmap, and pilot SLA criteria.
- **[02-stakeholder-roles-and-personas.md](./02-stakeholder-roles-and-personas.md)** — **Stakeholder Roles & Access Specifications**: Role matrix (`CUSTOMER`, `VENDOR_ADMIN`, `RIDER`, `SUPER_ADMIN`, `SUPPORT`), capabilities, inputs, outputs, invariants, and edge cases.
- **[03-core-business-rules-and-workflows.md](./03-core-business-rules-and-workflows.md)** — **Core Business Rules & Commercial Logic**: Single-vendor cart, PostGIS address geofence guard, coupon engine, deterministic order numbering, dual dispatch sequences (`RIDER_FIRST` vs `VENDOR_FIRST`), double-entry ledger equations, COD invariants, and regional parameters.
- **[04-customer-experience-and-journey.md](./04-customer-experience-and-journey.md)** — **Customer Mobile App Journey Specification**: 9-screen lifecycle from OTP auth and location picker to menu navigation, guarded cart, checkout, live tracking, failure recovery (Switch-to-COD), and 1-tap re-order.
- **[05-merchant-and-vendor-operations.md](./05-merchant-and-vendor-operations.md)** — **Merchant & Vendor Portal Specification**: 2-tier permissions (`PARTICULAR_OUTLET` vs `ALL_OUTLETS_MASTER`), 3-lane KDS, in-memory Web Audio chime, 1-click stockout toggles, rush pause, and sales ledger.
- **[06-rider-fleet-and-dispatch-handbook.md](./06-rider-fleet-and-dispatch-handbook.md)** — **Rider Fleet & Dispatch Handbook**: Courier onboarding gate, shift duty switch with in-flight duty lock, proximity broadcast claiming, 3-step fulfillment, 5-minute unresponsive customer SOP, and cash limits.
- **[07-admin-operations-and-pilot-guide.md](./07-admin-operations-and-pilot-guide.md)** — **Super Admin Operations & 10-Vendor Pilot Guide**: 6-module console architecture, Leaflet fleet radar, manual dispatch overrides, force-cancellation, promotions, RFC 4180 CSV export, and 4-week pilot playbook.

---

## 2. Granular Catalog of Business Capabilities

### 2.1 Customer Experience & Ordering Capabilities
- **Authentication**: Phone OTP login (`+880` / `+966`) with guest browsing allowed until checkout.
- **Location & Geofencing**: Interactive map pin picker; automated reverse geocoding; address book CRUD (`Home`, `Work`, `Other`).
- **Store Discovery**: Live merchant feed filtered by user location, vertical category pills, and operational badges (`OPEN`, `CLOSED`, `BUSY`).
- **Search & Direct Add**: Debounced search querying store names and dishes; direct `ADD +` button opening item customizer without visiting store page.
- **Single-Vendor Cart**: Restricts cart to one store; prompts confirmation dialog before replacing cart with items from another store.
- **Item Customization**: Single-choice variants (sizes, weights) and multi-select add-ons with min/max selection bounds.
- **Cart Operational Guards**: Disables checkout and renders warning banners if store is closed (`is_active = false`) or paused (`is_busy = true`).
- **Address Geofence Guard**: PostGIS spatial validation (`ST_DWithin`) blocking checkout if delivery pin is outside outlet delivery radius.
- **Promotions & Discounts**: Dynamic home banner carousel; percentage and flat coupon engine with minimum spend validation.
- **Flexible Payments**: Cash on Delivery (COD) and Online Payment Gateways (bKash, Moyasar, Stripe).
- **Payment Failure Recovery**: Amber card offering 1-tap "Switch to Cash (COD)" if online payment fails, immediately unlocking order for kitchen.
- **Live Order Tracking**: Visual 6-stage fulfillment stepper and real-time moving courier icon on interactive map.
- **Native Direct Dialer**: 1-tap phone buttons (`tel:`) to call courier, merchant, or 24/7 support hotline.
- **Smart Re-Order**: 1-tap re-order from past receipts with automated re-verification of store hours, item inventory, and updated pricing.

### 2.2 Merchant & Kitchen Operations Capabilities
- **Flexible Onboarding**: Self-registration pathway (`/vendor/register`) with admin approval gate, or direct creation by Super Admin.
- **Two-Tier Permissions**:
  - `PARTICULAR_OUTLET`: Branch manager access isolated to a single outlet ID.
  - `ALL_OUTLETS_MASTER`: Brand owner access with header `OutletSwitcher` across all chain locations.
- **Kitchen Display System (KDS)**: 3-lane kanban board (`New Orders` ➔ `In Preparation` ➔ `Ready for Pickup`).
- **In-Memory Audio Chime**: Dual-tone bell chime (587 Hz + 880 Hz) repeating every 3 seconds until all incoming orders are acknowledged.
- **Order Acceptance Controls**: 1-tap accept using default prep duration, custom prep timer pills (`15m`–`45m`), or structured reject modal with reason codes.
- **SLA Countdown & Breach Alerts**: Monospace countdown timer shifting to flashing pulse-red when prep time expires.
- **Instant Stockout Management**: Dedicated merchant catalog retaining sold-out items with 1-click toggles for dishes and variants.
- **Store Operations Controls**: Weekly 7-day schedule configuration, default prep time setting, and 1-click emergency "Rush Hour Pause".
- **Financial Ledger**: Daily and all-time completed order counts, gross volume, platform commission, and net vendor payable statements.

### 2.3 Rider Fleet & Dispatch Capabilities
- **Frictionless Onboarding**: Phone OTP registration and vehicle type selection with administrative verification lock screen.
- **Shift Duty Switch**: High-contrast `Online` / `Offline` toggle with **In-Flight Duty Lock** preventing going offline while carrying active orders.
- **Background Telemetry**: Native Android foreground service and iOS background updates streaming coordinates every 10 meters.
- **Proximity Broadcast Alert**: 45-second animated countdown modal with heavy haptic impact and pulsating system alert sound.
- **Atomic Mutex Claim**: High-speed Redis `SET NX EX 10` lock securing trip assignment to the first responding courier.
- **3-Step Fulfillment Flow**:
  - *Step 1*: Claim broadcast, navigate to store, and confirm pickup (`POST /orders/:id/pickup`).
  - *Step 2*: Navigate to customer doorstep coordinates using native turn-by-turn navigation.
  - *Step 3*: Hand over parcel, check mandatory COD cash verification box, and complete delivery (`POST /orders/:id/deliver`).
- **Doorstep 5-Minute SOP**: 300-second digital countdown timer and two-call protocol for unresponsive customers before releasing parcel to Dispatch HQ.
- **COD Safety Limit**: Real-time progress meter tracking collected cash; automatic dispatch restriction when reaching `max_cash_limit`.
- **Hub Cash Deposit**: Courier records physical cash handover at logistics hub with deposit amount and reference number.

### 2.4 Super Admin Master Governance Capabilities
- **Live Fleet Radar**: Leaflet OpenStreetMap radar displaying active couriers and unassigned orders with color-coded status pins.
- **Deep Linking Navigation**: Map popups link directly to `/orders?orderNumber=...` without refreshing page or dropping WebSockets.
- **Applicant Queue**: Filter tab to inspect, approve, or suspend newly registered courier applicants.
- **Manual Dispatch Overrides**: Force-assign any unassigned order to an online courier; force-cancel orders with mandatory 5-character audit reason.
- **Master Catalog Authority**: Centrally modify, re-price, or toggle items across all merchant menus.
- **Promotions Management**: Schedule homepage hero banners and create discount coupon codes with spend thresholds and usage limits.
- **Configurable Engines**: Toggle order flow sequence (`RIDER_FIRST` vs `VENDOR_FIRST`) and delivery fee pricing mode (`FIXED_FLAT` vs `DISTANCE_TIERED`).
- **Financial Settlement Engine**: Generate RFC 4180 CSV exports for ERP accounting; trigger weekly batch payout cycles.

### 2.5 Core Commercial Invariants
- **Zero Food Waste Order Flow**: Rider is matched before food is cooked in `RIDER_FIRST` mode.
- **Strict PostGIS Boundary Enforcement**: Address must satisfy `ST_DWithin` radius query.
- **Deterministic Numbering**: `ORD-YYYYMMDD-XXXX` sequence backed by atomic Redis counter.
- **Double-Entry Accounting Integrity**: Atomically records gross volume, commission deduction, net vendor payable, and rider trip earnings inside PostgreSQL database transactions.
