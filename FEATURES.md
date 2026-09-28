# DeliveryOS — Master System Features & Granular Capability Catalog

Welcome to the authoritative **Master Feature Catalog** for **DeliveryOS**.  
This document provides a line-level, granular breakdown of every operational feature, business rule, and technical capability implemented across the platform's 5 sub-projects.

---

## 📑 Feature Navigation Matrix

| Domain / Sub-Project | Primary Technology Stack | Primary Persona / Actor | Feature Index Link |
| :--- | :--- | :--- | :--- |
| **System-Wide & Shared** | PostGIS, Redis, Nginx, Docker | All Stakeholders | [§ 1. Core Platform & Shared Capabilities](#1-core-platform--system-wide-capabilities) |
| **Customer Mobile App** | Flutter 3.19+ (Riverpod 3.3.2) | End Consumers | [§ 2. Customer Mobile Experience](#2-customer-mobile-experience-appscustomer_app) |
| **Rider Fleet Mobile App** | Flutter 3.19+ (Riverpod 3.3.2) | Courier Fleet | [§ 3. Rider Courier Experience](#3-rider-courier-experience-appsrider_app) |
| **Vendor KDS Web Portal** | React 18, Vite, Web Audio API | Kitchen Staff & Store Managers | [§ 4. Vendor Store & Kitchen Portal](#4-vendor-store--kitchen-kds-portal-appsvendor_portal) |
| **Super Admin Master Console** | React 18, Vite, Leaflet OSM | Platform Operations & Dispatchers | [§ 5. Super Admin Operations Console](#5-super-admin-operations-console-appsadmin_portal) |
| **Backend Core & Realtime** | NestJS 10, Prisma, Socket.IO | Automated Services & Gateways | [§ 6. Backend API & Engine Services](#6-backend-api--engine-services-servicesbackend_api) |
| **Data & Spatial Storage** | PostgreSQL 16, PostGIS 3.4, Redis 7.2 | Database Layer | [§ 7. Data Persistence & Spatial Engine](#7-data-persistence--spatial-storage-engine) |
| **Automated Test Suites** | TypeScript (strict), tsx integration scripts, ESLint, Flutter Test | Engineering & QA | [§ 8. Automated Test & Static Analysis Suite](#8-automated-test--static-analysis-suite) |
| **Traceability Matrix** | All Sub-projects | Architects & Developers | [§ 9. Cross-Reference Index](#9-cross-reference-index-traceability-matrix) |

---

## 1. Core Platform & System-Wide Capabilities

### 1.1. Multi-Vertical Commercial Support
- **Supported Retail Verticals**:
  - `FOOD`: Restaurants, fast food, bakeries, cloud kitchens, and cafes.
  - `GROCERY`: Supermarkets, organic produce, convenience stores, and daily essentials.
  - `PHARMACY`: Licensed chemist stores, prescription drops, OTC remedies, personal care.
  - `SUPER_SHOP`: Large multi-category retail departments with mixed item baskets.
- **Vertical-Specific Metadata**: Dynamic badge rendering, catalog unit distinctions (`piece`, `kg`, `500g`, `pack`), and customizable preparation duration.

### 1.2. Multi-Region Currencies & Financial Decimal Precision
- **Supported Currencies**:
  - Bangladeshi Taka (`BDT` / `৳`): Primary target for pilot operations.
  - Saudi Riyal (`SAR` / `ر.س`): Secondary MENA target with full RTL formatting.
- **Deterministic Financial Rounding**: All monetary computations round strictly to 2 decimal places (`Math.round(x * 100) / 100`) and map to `DECIMAL(10, 2)` in PostgreSQL ([ADR-009](context_docs/architecture-decision-records/ADR-009-deterministic-financial-accounting-ledger.md)).

### 1.3. Multilingual Localization & RTL Engine
- **Supported Languages**: English (`en`), Arabic (`ar` with bidirectional Right-to-Left RTL flipping), and Bengali (`bn`).
- **Dynamic Localization Providers**: In-code localized lookup tables in mobile apps (`language_provider.dart`) and web portals (`i18n/` dictionaries) with instant runtime language switching.

### 1.4. Ingress & Subpath Reverse Proxy Topology
- **Unified Port 8080 Routing**: Nginx terminates public edge traffic and dispatches by subpath ([ADR-005](context_docs/architecture-decision-records/ADR-005-micro-frontends-and-subpath-routing.md)):
  - `/` ➔ Super Admin Portal (Port 3000)
  - `/vendor/` ➔ Vendor KDS Portal (Port 3001)
  - `/api/v1/` ➔ NestJS REST API (Port 4000)
  - `/events` ➔ Socket.IO Real-time Gateway (Port 4000)
- **Session Namespace Isolation**: Separate browser storage namespaces (`deliveryos_admin_auth` vs `deliveryos_vendor_auth`) preventing session overwrites across multiple tabs.

### 1.5. Centralized Design System Governance & Token Architecture
- **Mobile Design Tokens (Flutter)**:
  - `AppColors`: Palette tokens (`primary`, `secondary`, `surface`, `background`, `textPrimary`, `textSecondary`, `border`, `error`, `success`, `warning`).
  - `AppTypography`: Semantic typography hierarchy (`displayLarge`, `headingLarge`, `headingMedium`, `headingSmall`, `bodyLarge`, `bodyMedium`, `bodySmall`, `labelLarge`, `caption`).
  - `AppSpacing` & `AppRadius`: Standard 4px-grid spacing tokens (`xs: 4`, `sm: 8`, `md: 16`, `lg: 24`, `xl: 32`) and corner radii (`sm: 6`, `md: 12`, `lg: 16`, `full: 9999`).
  - **Zero Inline Styling Invariant**: Zero raw `Color(0x...)`, `Colors.*`, or ad-hoc `TextStyle(...)` permitted in presentation files ([ADR-010](context_docs/architecture-decision-records/ADR-010-ai-driven-engineering-governance-and-no-auto-commits.md)).
- **Web Design Tokens (React + TailwindCSS)**:
  - Semantic theme palettes in `tailwind.config.js` (`primary`, `brand`, `surface`, `status`).
  - Reusable component primitives (`Button`, `Badge`, `Modal`, `PageHeader`, `StatCard`, `EmptyState`, `StockToggleSwitch`).
  - Elimination of hardcoded arbitrary hex classes (`text-[#...]`) and inline `style={{ ... }}` attributes.

### 1.6. Spec-Driven Engineering & Quality Governance
- **3-Phase Engineering Protocol**: Plan & Grounding ➔ Implementation ➔ Verification & Living Docs Sync ([`README.md#spec-driven-development-workflow-3-phase-protocol`](README.md#-spec-driven-development-workflow-3-phase-protocol)).
- **Strict Typing Invariant**: `"strict": true` across backend and web portals with zero raw `any` types.
- **Production Realism**: Zero mock shortcuts, zero placeholder fallbacks, zero deleted failing tests.
- **Clean Code Standard**: Zero trivial comments on obvious logic per `AGENT_RULES.md § 3.6`.

---

## 2. Customer Mobile Experience (`apps/customer_app`)

### 2.1. Onboarding & Authentication
- **Phone Number Authentication**: Login via international phone format (`+880` / `+966`) (`PhoneInputScreen`).
- **6-Digit OTP Verification**: Verification screen with automatic focus progression, countdown resend timer, and development fast-fill (`OtpVerificationScreen`).
- **Profile Management**: Viewing profile details, editing display name, avatar, and active contact numbers (`ProfileScreen`).

### 2.2. Location, Delivery Address Book & Geofencing
- **Interactive Map Pinning**: Draggable Google Maps pin picker for precise drop-off coordinates (`MapLocationPickerScreen`).
- **Address Book Management (CRUD)**:
  - Add, edit, label (`Home`, `Work`, `Other`), and delete saved addresses (`AddressBookScreen`).
  - Coordinate extraction from device GPS with delivery notes (flat number, gate access code).
  - One-tap default address selection (`PATCH /addresses/:id/default`).
- **Geofenced Coverage Check**: Client and server address validation using PostGIS `ST_DWithin` ensuring customer is within merchant service radius (`POST /vendors/validate-address-coverage`).

### 2.3. Home Discovery & Promotions
- **Dynamic Hero Banners**: Auto-scrolling banner carousel displaying active platform promotions, linked to vendors or promo codes (`BannerCarousel`).
- **Category Filter Grid**: Quick vertical category selector (`All`, `FOOD`, `GROCERY`, `PHARMACY`) filtering nearby outlets in real-time (`HomeScreen`).
- **Hyperlocal Vendor Feed**: Distance-sorted merchant cards showing delivery fee, ETA in minutes, rating, open status badge, and rush-hour pause indicators.

### 2.4. Smart Search & Direct Add-to-Cart
- **Debounced Instant Search**: Queries product titles and merchant names simultaneously via `GET /vendors/search?q=...` (`SearchScreen`).
- **Direct `ADD +` from Search**: Instant item customizer bottom sheet (`ItemCustomizerSheet`) directly from the search feed without navigating to the store page.
- **Single-Vendor Cart Conflict Resolution**: Dialog warning when adding items from a different store: *"Replace Cart Items? Your cart already contains items from [Store A]. Clear cart and add from [Store B]?"* with `"Clear & Add"` action.
- **Direct SnackBar Navigation**: Confirmation popup featuring a `"VIEW CART"` action shortcut for immediate checkout.

### 2.5. Merchant Storefront & Product Customization
- **Collapsing Sticky Header & Category Navigation**: `SliverPersistentHeader` pins menu category tabs under the collapsing store banner for quick section jumping (`OutletDetailScreen`).
- **Mutually Exclusive Variants**: Radio button selection for single-choice variants (e.g. Size: Small / Medium / Large).
- **Optional Add-ons & Toppings**: Multi-select toppings and condiments with real-time price delta recalculation.
- **Special Cooking Instructions**: Textarea capturing custom preparation notes passed immutably to the kitchen.

### 2.6. Cart Validation & Guarded Checkout
- **Store Status Protection**:
  - High-contrast **Red Closed Banner** if store is outside operating hours (`isVendorActive === false`).
  - High-contrast **Amber Rush Banner** if merchant has paused incoming orders (`isVendorBusy === true`).
  - Primary checkout CTA is automatically disabled with dynamic text: `"Store Currently Closed"` or `"Store Paused (Rush Hour)"`.
- **Address Range Guard**: Prevents placing orders if customer coordinates exceed merchant geofence.
- **Promo Coupon Engine**: Input field validating promo codes (`POST /coupons/validate`) with minimum order value and flat/percentage discount calculation.
- **Multi-Payment Selector**: Toggle between `CASH_ON_DELIVERY` (COD) and `ONLINE_GATEWAY` (bKash, SSLCommerz, Sandbox).

### 2.7. Live Order Tracking & Failure Recovery
- **6-Stage Fulfillment Stepper**: Visual timeline displaying stages: `Placed` ➔ `Assigned` ➔ `Preparing` ➔ `Ready` ➔ `Delivering` ➔ `Delivered` (`OrderStepperWidget`).
- **Clamped Text Scaling on Small Screens**: Stepper labels utilize font-size scaling protection preventing horizontal blowout on 320px screens.
- **Live Courier Radar Map**: Real-time motorcycle marker updating smoothly via WebSocket telemetry (`rider:location:stream`) on Google Maps (`TrackingMapView`).
- **Switch-to-COD Recovery Card**:
  - Displays when an online payment gateway transaction is pending or failed.
  - Provides a one-tap `"Switch to Cash (COD)"` button (`POST /orders/:id/switch-cod`) immediately releasing the order for kitchen preparation and courier dispatch.
- **24/7 Support Hotline Launcher**: AppBar action and Profile tile dialing customer care (`+8801700000000`) via native OS phone handoff (`phone_call_launcher.dart`).
- **Direct Store & Courier Call Shortcuts**: One-tap phone call buttons inside the courier and merchant tracking cards.
- **Self-Service Order Cancellation**: Customer can cancel their order during `PLACED` and `RIDER_ASSIGNED` stages with automatic coupon quota restoration and refund accounting (`POST /orders/:id/cancel`).

### 2.8. Order History & Smart Re-Order
- **Completed Receipts Feed**: Itemized past order cards with status badges, date, items summary, and total amount (`OrderHistoryScreen`).
- **Smart Re-Order Validation**:
  - Sends `POST /orders/validate-reorder` verifying current store operational status and product stock.
  - Automatically identifies discontinued or out-of-stock items, alerts customer with modal dialog, and repopulates cart with remaining items at updated prices.

---

## 3. Rider Courier Experience (`apps/rider_app`)

### 3.1. Authentication & Onboarding Gate
- **Phone Login & Verification**: Courier phone authentication with OTP verification (`PhoneLoginScreen`).
- **Administrative Approval Gate**: Couriers in `PENDING_APPROVAL` status are locked on an informational screen explaining document review until verified by Super Admin (`PendingApprovalScreen`).

### 3.2. Shift Management & Telemetry
- **One-Tap Duty Toggle**: Switch shift status between `ONLINE` and `OFFLINE` (`RiderDashboardScreen`).
- **In-Flight Duty Lock**: Blocks switching offline with `400 Bad Request` while carrying an active delivery (`RIDER_ASSIGNED` or `DISPATCHED`).
- **Background GPS Foreground Service**:
  - Android `FOREGROUND_SERVICE_LOCATION` and iOS background location updates.
  - Streams location every 10 meters via WebSocket (`rider:location:update`) for zero-latency customer tracking and HTTP fallback (`PATCH /riders/duty`).

### 3.3. Broadcast Alert & Dispatch Claim
- **45-Second Dispatch Alert**: Full-screen modal popping up on incoming order broadcast (`IncomingTripModal`).
- **Audio Chime & Repeating Haptic Pulse**: Dual sensory alerts playing `SystemSound.alert` and `HapticFeedback.heavyImpact()` pulsing every 3 seconds until claimed or dismissed.
- **Dynamic Countdown Progress Bar**: Animated linear bar changing from green to urgent red in the final 10 seconds.
- **Atomic One-Tap Claim**: Calls `POST /riders/orders/:id/claim` backed by Redis `SET NX EX 10` mutex lock ensuring zero double-assignment ([ADR-004](context_docs/architecture-decision-records/ADR-004-atomic-dispatch-claim-mutex.md)).

### 3.4. 3-Step Sequential Fulfillment Workflow
- **Step 1: Pick Up Food** (`_buildStep1PickUp` in `ActiveTripScreen`):
  - Store address, one-tap navigation handoff to Google Maps/Apple Maps, direct store phone dialer.
  - Prominent visual package label (`LOOK FOR PACKAGE BAG - Order #...`).
  - Primary Action: `"ORDER PICKED UP ➔ START DELIVERY"` (`POST /orders/:id/pickup`).
- **Step 2: Deliver to Customer** (`_buildStep2Deliver`):
  - Doorstep navigation shortcut, customer address, special gate/floor instructions.
  - Direct customer phone dialer.
  - Primary Action: `"ARRIVED AT DOORSTEP ➔ HANDOVER"`.
- **Step 3: Complete Handover & Cash Verification** (`_buildStep3Handover`):
  - Prepaid orders: Green confirmation banner indicating zero cash collection.
  - COD orders: Amber banner with collected amount and mandatory confirmation checkbox: *"I have collected ৳[Amount] in cash from customer"*.
  - Primary Action: `"COMPLETE DELIVERY"` (`POST /orders/:id/deliver`).

### 3.5. Doorstep Delivery Failure SOP (5-Minute Countdown)
- **Unresponsive Customer SOP Modal**: Accessible from Step 2 and Step 3 via `"Customer Unreachable at Doorstep?"` button (`_showUnreachableBottomSheet`).
- **Standard Operating Procedure (SOP)**:
  1. Call customer twice.
  2. Ring doorbell / knock at door.
  3. Wait full 5 minutes before reporting failure.
- **Digital 5-Minute Countdown Timer**: 300-second countdown displaying remaining minutes and seconds. Tapping "Call Customer" starts the timer automatically.
- **Failure Escalation**: Button `"Report Unresponsive & Release Order"` invokes `POST /orders/:id/issue`, releases the order to Dispatch HQ, and returns courier to dashboard.

### 3.6. Real-Time Remote Cancellation Handling
- **Remote Cancellation Listener**: Captures `order:cancelled` socket event if customer, merchant, or admin cancels the delivery in flight.
- **Cancellation Splash Layout**: Renders cancellation reason prominently with `"Return to Dashboard"` button and automatically clears active trip state.

### 3.7. Shift Earnings & COD Cash Settlement
- **Timeframe Earnings Toggle**: Switch between `Today` and `This Week` summary (`RiderEarningsScreen`).
- **KPI Summary**: Completed trips count, total delivery pay, and average earnings per trip.
- **COD Cash in Hand & Safety Limit**:
  - Displays collected cash balance against configured safety limit (e.g. ৳5,000).
  - Progress meter shifts green ➔ amber (80%) ➔ red (100%).
- **Hub Cash Deposit Flow**: Courier records physical cash handover to central hub (`POST /riders/deposit-cash`) for admin verification.
- **Deposit Tracking Feed**: Couriers track status of submitted deposits (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`) via `GET /rider/cash/deposits`.

---

## 4. Vendor Store & Kitchen Portal (`apps/vendor_portal`)

### 4.1. Authentication & Multi-Branch Architecture
- **Merchant Staff Login**: Email/password authentication scoped to specific outlet or brand owner (`LoginPage`).
- **Outlet Scope Switcher (`OutletSwitcher`)**:
  - `PARTICULAR_OUTLET`: Single-store staff account strictly locked to their physical branch.
  - `ALL_OUTLETS_MASTER`: Multi-branch brand owner account with dropdown selector to switch between individual branches or aggregate across all outlets.
  - Text truncation and responsive constraints eliminating header overflows.

### 4.2. 3-Lane Kitchen Display System (KDS)
- **Lane 1: New Orders (`PLACED` / `RIDER_ASSIGNED`)**:
  - Pulsing rose ping badge with elapsed time counter.
  - One-tap acceptance with default prep time (e.g. 20 min).
  - Custom prep time selector pills (`15`, `20`, `25`, `35`, `45` minutes).
  - Structured rejection modal with reason codes (`OUT_OF_STOCK`, `KITCHEN_OVERLOAD`, `STORE_CLOSING_SOON`, `OTHER`) and custom notes.
- **Lane 2: In Preparation (`PREPARING`)**:
  - Digital countdown timer (`CountdownTimer`) computing remaining minutes from `acceptedAt + prepTimeMinutes`.
  - Timer turns amber at 5 minutes and flashes red when overdue.
  - Action button: `"Ready for Pickup"` (`POST /vendor/orders/:id/ready`).
- **Lane 3: Ready for Pickup (`READY_FOR_PICKUP`)**:
  - Displays assigned courier name, phone number, and arrival status.
  - Action button: `"Hand to Rider"` confirming physical package handover (`POST /vendor/orders/:id/handover`).

### 4.3. Web Audio API Synthesized Chime Loop
- **Zero-Dependency Audio Synthesis**: Eliminates external `.mp3` files; synthesizes a pleasant dual-tone bell chime in-memory using Web Audio API oscillators (D5 587 Hz + A5 880 Hz) ([ADR-007](context_docs/architecture-decision-records/ADR-007-web-audio-api-synthesized-kds-chime.md)).
- **Persistent Alarm Loop**: Chime repeats every 3 seconds when new orders arrive via WebSocket `order:new`.
- **Guaranteed Silence Invariant**: Audio loop automatically stops **only when all unaccepted orders in Lane 1 are accepted or rejected**.
- **User Gesture Unlock**: Unlocks browser audio context on the first user interaction anywhere on the board.

### 4.4. 1-Click Rush Hour Pause & Operational Controls
- **Header Rush Hour Pause Toggle**: Immediate 1-click toggle in the top navigation bar (`VendorLayout`).
- **Global Amber Pause Banner**: Full-width alert notifying staff that incoming customer orders are paused, featuring a 1-click `"Resume Orders Now"` button.
- **Timings & Operations Screen (`VendorSettingsPage`)**:
  - Standard preparation duration selector (`15`, `20`, `25`, `30`, `45` min).
  - 7-day weekly opening and closing hours schedule with closed-day toggles and overnight shift support.
  - Timed emergency pause (`30 minutes`, `1 hour`, `Rest of Day`).

### 4.5. Merchant Catalog & Stockout Management
- **Dedicated Merchant Endpoint (`GET /vendor/catalog`)**:
  - Unlike consumer APIs that filter out sold-out items, this endpoint retains all catalog products and variants.
  - Displays total in-stock vs out-of-stock count metrics (`VendorCatalogPage`).
- **Instant 1-Click Stock Toggles**:
  - Dish-level stock switch (`PATCH /vendor/products/:id/stock`).
  - Variant-level stock switch (`PATCH /vendor/products/variants/:id/stock`).
  - Changes invalidate customer search and storefront menus immediately.

### 4.6. Itemized Sales Ledger & Financial Statements
- **Date Range Filters**: Segmented switch between `Today` and `All Time` (`VendorOrdersPage`).
- **Dynamic KPI Cards**: Completed Orders, Gross Sales Volume, Platform Commission Deducted (15%), Net Vendor Payable.
- **Order Details Modal**:
  - Customer contact snapshot and delivery address.
  - Special cooking instructions note.
  - Full dish breakdown with variants, toppings, quantities, and line item subtotals.
  - Financial breakdown: Gross, commission cut, net payable, and settlement status (`SETTLED` vs `PENDING`).

### 4.7. Responsive Touch Ergonomics & UI Components
- **Tablet & Mobile Ergonomics**: Horizontally scrollable snap-track for tablet displays (768px-1024px) plus mobile lane selector tabs.
- **Touch-Friendly Buttons**: Action buttons, timers, and prep-time pills optimized with `>= 44px` minimum hit areas.
- **Reusable Component Suite**: Shared `PageHeader`, `StatCard`, and accessible `StockToggleSwitch`.

---

## 5. Super Admin Operations Console (`apps/admin_portal`)

### 5.1. Live Fleet Radar & Dispatch Command
- **Leaflet OpenStreetMap Radar Engine**: Zero-API-cost mapping engine tracking couriers and unassigned orders (`LiveFleetMap`).
- **Color-Coded Courier Pins**:
  - Emerald `#10b981`: Online & idle, ready for dispatch.
  - Sky `#0284c7`: In-flight active delivery.
  - Amber `#ea580c`: Approaching COD cash safety limit.
  - Slate `#64748b`: Offline.
- **SPA Deep Linking Navigation**: Clicking `"Open Order →"` inside an order marker popup navigates directly to `/orders?orderNumber=...` via React Router without page reloads or dropping WebSocket connections.
- **Overlay Layering & Radial Jitter Fix**: Legend overlay elevated to `z-[500]`; radial jitter handles overlapping coordinates smoothly.

### 5.2. Live Order Lifecycle Monitor & Deep Linking
- **Order Number URL Query Deep Linking**: Navigating to `/orders?orderNumber=ORD-XXXX` automatically filters the table, highlights the order, and pre-opens the assignment or details modal (`AdminOrdersPage`).
- **Active Filter Banner**: Amber banner indicating active direct link filter with 1-click `"Clear Filter & View All"` button.
- **Itemized Order Details Modal**:
  - Store outlet and customer details.
  - Courier assignment status with 1-click assign shortcut.
  - Cooking and delivery notes.
  - Complete line items list with unit prices and subtotals.
  - Financial summary.

### 5.3. Administrative Overrides (Force-Assign & Force-Cancel)
- **Force-Assign Courier Modal**:
  - Line items summary with quantities and dish names.
  - Customer notes display.
  - Courier selection radio list displaying online status, active delivery state, and current cash balance.
  - Bypasses automated dispatch algorithm via `adminApi.forceAssignRider(orderId, riderId)`.
- **Force-Cancel Order Modal**:
  - Reversal warning alert: audit trail logging, courier release, and ledger reversal.
  - Itemized list of dishes to be cancelled.
  - Mandatory audit reason textarea (minimum 5 characters).
  - Reverses commission ledger, restores coupon quota, and broadcasts cancellation to all parties (`adminApi.cancelOrder(orderId, reason)`).

### 5.4. Courier Fleet Governance & Applicant Queue
- **Dedicated Applicant Couriers Queue**: Filter tab displaying all pending courier self-registrations (`AdminDispatchPage`).
- **Applicant Badge Metric Card**: Real-time counter of couriers awaiting verification.
- **1-Click Approval & Suspension**: Instant toggle approving applicant credentials (`adminApi.setRiderApproval(id, true)`) or suspending problematic couriers.
- **Cash Safety Limit Adjustment**: Modal allowing operations staff to adjust a courier's maximum COD limit (e.g. ৳3,000 to ৳10,000) based on trust and tenure.

### 5.5. COD Cash Deposit Verification
- **Deposit Audit Queue**: Review couriers' submitted hub deposits via `GET /admin/finance/cash-deposits`.
- **Atomic Verification Action**: `PATCH /admin/finance/cash-deposits/:id/verify` (`APPROVE` or `REJECT`).
  - Approving a deposit atomically decrements the courier's `cashInHand` in a database transaction.
  - Rejecting records operational notes explaining discrepancies.

### 5.6. Promotional Campaigns & Coupons
- **Hero Carousel Banner Management**: Tab to schedule, activate, prioritize, and delete homepage promotion banners with image previews (`AdminPromotionsPage`).
- **Discount Coupon Engine**:
  - Alphanumeric promo codes with flat or percentage discount modes.
  - Configurable minimum order spend, maximum discount ceiling, and total usage limits.
  - 1-click active/inactive toggle and deletion.

### 5.7. System Settings & Pipeline Governance
- **Order Flow FSM Selector**: 1-click toggle between:
  - `RIDER_FIRST` (Zero Food Waste Mode): Broadcasts to couriers first; kitchen prepares only after courier accepts.
  - `VENDOR_FIRST` (Traditional Retail Mode): Kitchen starts cooking immediately; couriers broadcast once food is marked "Ready".
- **Delivery Fee Pricing Engine**:
  - `FIXED_FLAT`: Platform-wide uniform delivery fee (e.g. 50 BDT).
  - `DISTANCE_TIERED`: Base fee for initial 1.5 km plus incremental per-kilometer fee.

### 5.8. Financial Settlements & Statements Export
- **JSON Statements Query**: Query vendor earnings, commission deductions, and pending payouts (`AdminSettingsPage`).
- **RFC 4180 CSV Export**: One-tap export downloading formatted `vendor-settlements-YYYY-MM-DD.csv` for enterprise accounting systems (ERP / QuickBooks) ([ADR-009](context_docs/architecture-decision-records/ADR-009-deterministic-financial-accounting-ledger.md)).
- **Settlement Batch Audit Trail**: Historical log of payout batches with batch references, transfer notes, and payout timestamps.
- **Settlement Cycle Engine**: Trigger payout cycles via `POST /admin/finance/settle-cycle` with **Net COD Cash Offset** (`deliveryEarnings - codCollected`).

### 5.9. Responsive Layout & Reusable Component Suite
- **Responsive Mobile Navigation**: Slide-over drawer navigation for mobile and tablet screens (`AdminLayout.tsx`).
- **Table Column Protection**: Tables wrapped in `overflow-x-auto` to prevent data clipping.
- **Non-Clipped Modals**: Scrolling internal modal body with fixed headers/actions preventing viewport cutoff.
- **Reusable Component Primitives**: `PageHeader`, `StatCard`, and `EmptyState`.

---

## 6. Backend API & Engine Services (`services/backend_api`)

### 6.1. Modular NestJS Architecture
- **Auth Module (`/auth`)**: JWT issuance, passport strategies, phone OTP verification, FCM device token registration.
- **Vendors Module (`/vendors`)**: Outlet CRUD, catalog management, opening hours, rush pause toggle, geofence radius check.
- **Orders Module (`/orders`)**: Checkout transaction boundary, dual-flow state progression, line item pricing, payment method switches, reorder validation, cancellation rollbacks.
- **Riders Module (`/riders`)**: Shift duty toggle, GPS coordinate persistence, in-flight delivery locks, cash deposit submission and tracking.
- **Dispatch Module (`/dispatch`)**: Geospatial proximity searches, atomic claim mutex locks, two-tier radius escalation.
- **Finance Module (`/finance`, `/admin/finance`)**: Commission ledger generation, payout aggregation, settlement batch creation, cash deposit verification, CSV export.
- **Promotions Module (`/promotions`, `/coupons`)**: Banner sorting and promo code discount application.

### 6.2. Dual Order Flow State Machine
- **Formal State Enum**: `PLACED` ➔ `RIDER_ASSIGNED` ➔ `PREPARING` ➔ `READY_FOR_PICKUP` ➔ `DISPATCHED` ➔ `DELIVERED` (with terminal `CANCELLED`) ([ADR-002](context_docs/architecture-decision-records/ADR-002-dynamic-dual-order-flow-fsm.md)).
- **Direct Vendor Acceptance Transition**: Calling accept transitions directly to `PREPARING` while setting `acceptedAt = NOW()` (deprecated `ACCEPTED` state eliminated).

### 6.3. Real-Time Socket.IO Protocol
- **Targeted Room Topology**:
  - `order_${orderId}`: Real-time order progress updates for customer, assigned rider, and store.
  - `vendor_${vendorId}`: Kitchen alert chimes and KDS board invalidations.
  - `brand_${brandId}`: Brand-wide multi-outlet event stream for brand owners.
  - `rider_${riderId}`: Targeted dispatch broadcast alerts.
  - `admin_hq`: Platform-wide radar updates and override notifications.
- **Core WebSocket Events**:
  - Emitted: `order:new`, `order:status:changed`, `order:cancelled`, `order:payment:verified`, `order:delivery_failed`, `dispatch:broadcast`, `dispatch:escalated`, `rider:location:stream`.
  - Received: `join:order`, `leave:order`, `rider:location:update`.

### 6.4. Multi-Gateway Payment & Webhook Idempotency
- **Supported Gateways**: bKash, SSLCommerz, Sandbox, Cash on Delivery (COD) ([ADR-011](context_docs/architecture-decision-records/ADR-011-multi-gateway-online-payment-and-webhook-idempotency.md)).
- **Pre-Payment Dispatch Suppression**: Online orders suppress courier broadcast and kitchen alerts until payment is cryptographically verified via IPN webhook.
- **HMAC-SHA256 Webhook Verification**: Idempotent IPN processing deduplicated via unique transaction IDs and database locking.

### 6.5. Order Cancellation & Financial Rollback Engine
- **Pre-Prep Boundary Guard**: Customer cancellation allowed only in `PLACED` and `RIDER_ASSIGNED` states; rejects with `400 Bad Request` once kitchen begins `PREPARING`.
- **Vendor Rejection Codes**: Structured reason codes (`OUT_OF_STOCK`, `KITCHEN_OVERLOAD`, `STORE_CLOSING_SOON`, `OTHER`).
- **Atomic Rollback Transaction**:
  - Deletes unbilled pending commission and trip ledgers.
  - Restores coupon usage quotas (`currentUses: { decrement: 1 }`).
  - Releases Redis courier in-flight locks (`rider:active_order:${riderId}`) and claim mutexes (`lock:order_claim:${orderId}`).
  - Marks payment status `REFUNDED` or `FAILED`.
  - Dispatches `order:cancelled` and `order:status:changed` (newStatus: `CANCELLED`) real-time events.

### 6.6. Net COD Cash Offset Settlement Engine
- **Offset Formula**: Deducts courier-collected COD cash from accumulated delivery pay (`Math.max(0, deliveryEarnings - codCollected)`).
- **Protection**: Prevents platform financial losses by ensuring couriers holding cash are not double-paid during settlement batches.

---

## 7. Data Persistence & Spatial Storage Engine

### 7.1. PostgreSQL 16 & PostGIS 3.4
- **Spatial Points**: Merchant locations (`vendors.location`) and customer drop-offs (`orders.delivery_location`) stored as PostGIS `geometry(Point, 4326)`.
- **Spatial Indexing**: Indexed via GIST (`GIST(location)`) for sub-millisecond range queries (`ST_DWithin`).
- **Immutable Financial Snapshots**: `order_items.addons_snapshot` stored as JSONB to preserve historical dish options even if catalog items change later ([ADR-008](context_docs/architecture-decision-records/ADR-008-immutable-jsonb-historical-snapshots.md)).
- **Relational Integrity**: 19 normalized entities with foreign key constraints, audit timestamps, and deterministic numeric columns (`DECIMAL(10, 2)`).

### 7.2. Redis 7.2 In-Memory Operations
- **Geospatial Courier Tracking**: Couriers stored in Redis GEO keys (`riders:locations`) updated via `GEOADD` every 10 meters.
- **Atomic Dispatch Mutex**: First-come-first-serve order claiming backed by `SET resource_lock token NX EX 10` ([ADR-004](context_docs/architecture-decision-records/ADR-004-atomic-dispatch-claim-mutex.md)).
- **Sub-100ms Query Invalidation**: High-speed cache invalidations signaling React Query and Riverpod clients.

---

## 8. Automated Test & Static Analysis Suite

The platform is guarded by a comprehensive suite of automated verification scripts:

| Suite Name | Execution Command | Scope & Capabilities Verified |
| :--- | :--- | :--- |
| **Track 1 Business Integrity** | `npm run track1:test` | Store hours/busy guards, COD deposits, net COD offset, in-flight duty lock, route deduplication |
| **Order Cancellation & Refunds** | `npm run cancel:test` | Customer cancel, pre-prep boundary guard, vendor reject codes, admin force-cancel, ledger rollbacks |
| **Online Payments & IPN** | `npm run payment:test` | Multi-gateway payment simulation, webhook signature verification, pre-payment broadcast suppression |
| **Financial Settlement Cycles** | `npm run settlement:test` | Batch settlements, net cash offset, double-entry balancing, CSV export validation |
| **Auth & RBAC Security** | `npm run auth:test` | Phone OTP, JWT issuance, tenant isolation, Super Admin override guards |
| **Vendor Discovery & Geofence** | `npm run vendor:test` | PostGIS `ST_DWithin` radius search, store category filters, distance sorting |
| **Order Checkout & Pricing** | `npm run order:test` | Single-vendor cart boundary, coupon calculations, flat vs distance fees |
| **Dispatch FSM & Mutex** | `npm run dispatch:test` | Redis `SET NX EX` mutex lock, race-condition elimination, dual-flow transitions |
| **Web Portal Admin Tests** | `npm run test:admin` | Dashboard KPIs, Leaflet OSM radar rendering, courier queue, order overrides |
| **Web Portal KDS Tests** | `npm run test:kds` | 3-lane Kanban progression, prep countdown timers, synthesized audio chime loop |
| **Customer App Flutter Tests** | `flutter test` | Riverpod providers, cart conflict modal, stepper layout, design system token tests |
| **Rider App Flutter Tests** | `flutter test` | Duty toggle lock, 3-step fulfillment flow, 5-min SOP modal, design system token tests |
| **Static Code Analysis** | `npm run typecheck` / `flutter analyze` | Zero TypeScript errors (`strict: true`), zero Flutter analyzer warnings |

---

## 9. Cross-Reference Index (Traceability Matrix)

| Feature Group | Code Implementation Location | Authoritative Context Doc | Governing ADR |
| :--- | :--- | :--- | :--- |
| **KDS Kanban Board & Chimes** | `apps/vendor_portal/src/pages/vendor/VendorDashboardPage.tsx` | `BRD-05` (Merchant Ops) | [ADR-007](context_docs/architecture-decision-records/ADR-007-web-audio-api-synthesized-kds-chime.md) |
| **Rush Hour Pause** | `apps/vendor_portal/src/layouts/VendorLayout.tsx` | `BRD-05` (Sec 4) | [ADR-002](context_docs/architecture-decision-records/ADR-002-dynamic-dual-order-flow-fsm.md) |
| **Merchant Catalog & Stock** | `apps/vendor_portal/src/pages/vendor/VendorCatalogPage.tsx` | `TID-03` (Sec 4.3) | [ADR-008](context_docs/architecture-decision-records/ADR-008-immutable-jsonb-historical-snapshots.md) |
| **Live Fleet Radar (OSM)** | `apps/admin_portal/src/components/dispatch/LiveFleetMap.tsx` | `BRD-07` (Sec 2.1) | [ADR-003](context_docs/architecture-decision-records/ADR-003-postgis-spatial-engine-and-redis-geohash.md) |
| **Deep Link Order Overrides** | `apps/admin_portal/src/pages/admin/AdminOrdersPage.tsx` | `BRD-07` (Sec 2.3) | [ADR-006](context_docs/architecture-decision-records/ADR-006-dual-store-frontend-paradigm-and-websocket-invalidation.md) |
| **Applicant Courier Queue** | `apps/admin_portal/src/pages/admin/AdminDispatchPage.tsx` | `BRD-06` (Sec 1) | [ADR-002](context_docs/architecture-decision-records/ADR-002-dynamic-dual-order-flow-fsm.md) |
| **Cash Deposit Verification** | `apps/admin_portal/src/pages/admin/AdminSettingsPage.tsx` | `BRD-06` (Sec 6) + `TID-03` (Sec 6.7) | [ADR-009](context_docs/architecture-decision-records/ADR-009-deterministic-financial-accounting-ledger.md) |
| **CSV Settlements Export** | `apps/admin_portal/src/pages/admin/AdminSettingsPage.tsx` | `BRD-07` (Sec 2.6) | [ADR-009](context_docs/architecture-decision-records/ADR-009-deterministic-financial-accounting-ledger.md) |
| **Search Add-to-Cart** | `apps/customer_app/lib/features/discovery/presentation/search_screen.dart` | `BRD-04` (Sec 3) | [ADR-008](context_docs/architecture-decision-records/ADR-008-immutable-jsonb-historical-snapshots.md) |
| **Store Closed/Busy Blocks** | `apps/customer_app/lib/features/cart/presentation/cart_screen.dart` | `BRD-04` (Sec 6) | [ADR-002](context_docs/architecture-decision-records/ADR-002-dynamic-dual-order-flow-fsm.md) |
| **Switch-to-COD Recovery** | `apps/customer_app/lib/features/tracking/presentation/order_tracking_screen.dart` | `BRD-04` (Sec 8) | [ADR-011](context_docs/architecture-decision-records/ADR-011-multi-gateway-online-payment-and-webhook-idempotency.md) |
| **Order Cancellation & Refund** | `apps/customer_app/lib/features/tracking/presentation/order_tracking_screen.dart` | `BRD-04` + `TID-03` (Sec 3.10) | [ADR-002](context_docs/architecture-decision-records/ADR-002-dynamic-dual-order-flow-fsm.md) |
| **3-Step Courier Fulfillment** | `apps/rider_app/lib/features/trips/presentation/active_trip_screen.dart` | `BRD-06` (Sec 3) | [ADR-004](context_docs/architecture-decision-records/ADR-004-atomic-dispatch-claim-mutex.md) |
| **Doorstep 5-Min SOP Modal** | `apps/rider_app/lib/features/trips/presentation/active_trip_screen.dart` | `BRD-06` (Sec 5.1) | [ADR-002](context_docs/architecture-decision-records/ADR-002-dynamic-dual-order-flow-fsm.md) |
| **Rider Duty In-Flight Lock** | `apps/rider_app/lib/features/dashboard/presentation/rider_dashboard_screen.dart` | `BRD-06` (Sec 2) | [ADR-002](context_docs/architecture-decision-records/ADR-002-dynamic-dual-order-flow-fsm.md) |
| **Rider Hub Cash Deposits** | `apps/rider_app/lib/features/earnings/presentation/rider_earnings_screen.dart` | `BRD-06` (Sec 6) | [ADR-009](context_docs/architecture-decision-records/ADR-009-deterministic-financial-accounting-ledger.md) |
| **Design System Tokens** | `apps/*/lib/core/constants/` + `apps/*/tailwind.config.js` | `AGENT_RULES.md` (§ 3.7) | [ADR-010](context_docs/architecture-decision-records/ADR-010-ai-driven-engineering-governance-and-no-auto-commits.md) |
