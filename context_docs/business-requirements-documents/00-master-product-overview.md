# 00 — Master Product Overview & Capability Catalog

High-density product specification detailing core business capabilities, stakeholder applications, operational workflows, and commercial mechanics across the DeliveryOS platform.

---

## 1. Platform Topology & Applications

DeliveryOS connects merchants, customers, and delivery couriers through 4 unified applications backed by a centralized real-time API:

1. **Customer Mobile Application** (Flutter iOS & Android):
   - Discovery, cart customization, geofenced checkout, live order tracking, phone dialer handoff, and smart re-order.
2. **Rider Mobile Application** (Flutter iOS & Android):
   - Shift duty switch, broadcast alert claiming, 3-step fulfillment workflow, native GPS navigation handoff, and Cash-on-Delivery (COD) reconciliation.
3. **Store & Kitchen Web Portal** (React 18 SPA — `/vendor`):
   - 3-lane Kitchen Display System (KDS), in-memory synthesized Web Audio chime, item/variant stock toggles, operating hours, and sales ledger.
4. **Super Admin Master Console** (React 18 SPA — `/admin`):
   - Global platform governance, live courier fleet radar, manual dispatch override, master catalog authority, promo banner/coupon engine, and RFC 4180 CSV settlements.

---

## 2. Core Business Invariants & Capabilities

### 2.1 Food Waste Prevention Flow (`RIDER_FIRST`)
- **Rule**: Couriers are matched and assigned **before** kitchen preparation begins.
- **Trigger**: Customer checkout completes (and online payment verifies, if applicable).
- **Execution**: System broadcasts order to available riders within 3–5 km. Once a courier claims the order, the store KDS sounds the arrival chime for kitchen acceptance.
- **Benefit**: Eliminates food waste and financial loss caused by unassigned cooked meals.

### 2.2 Geofenced Address Guard
- **Rule**: Customers cannot place orders to delivery coordinates located outside an outlet's configured delivery radius.
- **Validation**: PostGIS spatial boundary evaluation:
  ```sql
  ST_DWithin(customer_address.coordinates, vendor.coordinates, vendor.delivery_radius_km * 1000) = TRUE
  ```
- **Edge Case**: If the delivery pin is shifted outside the delivery zone during cart review, checkout is blocked with an explicit out-of-boundary alert.

### 2.3 Single-Vendor Cart Boundary
- **Rule**: Cart contents must originate from exactly one vendor outlet.
- **Conflict Handling**: Adding an item from a different store prompts a confirmation dialog to clear the existing cart before adding the new item.

### 2.4 Multi-Vertical Catalog Flexibility
- **Restaurants & Cafes**: Dish items with single-choice variants (e.g., sizes).
- **Groceries & Super Shops**: Packaged products and bulk produce sold by weight unit (`kg`, `500g`, `grams`, `piece`).
- **Pharmacies & Essentials**: Standard unit OTC healthcare items.

### 2.5 Dual-Tier Vendor Hierarchy
- **Particular Outlet Permission**: Scoped strictly to a single physical outlet ID for branch managers (isolated KDS, local stock toggles, store-specific sales).
- **All Outlets Master Permission**: Scoped to brand owner accounts across all chain locations (branch switching, consolidated brand reports, brand-wide menu management).

### 2.6 Configurable Delivery Economics
- **Fixed Flat Fee**: Constant fee per delivery (default pilot: 50.00 BDT / 12.00 SAR).
- **Distance-Tiered Fee**: Base fee up to base distance + incremental rate per additional kilometer:
  $$\text{Fee} = \text{base\_fee} + \max(0, \text{distance\_km} - \text{base\_km}) \times \text{per\_km\_rate}$$

### 2.7 Native Device Handoffs
- **Voice Communication**: Direct OS phone dialer (`tel:`) shortcuts connecting customers, merchants, and riders without intermediary telephony costs.
- **Turn-by-Turn Navigation**: Direct handoff to native Google Maps (`google.navigation:`) or Apple Maps (`maps.apple.com`).

### 2.8 Dual-Region Localization
- **Bangladesh (`BD`)**: BDT (`৳`), English / Bengali, `+880` phone prefix.
- **Saudi Arabia (`KSA`)**: SAR (`﷼`), Arabic RTL / English, `+966` phone prefix.

---

## 3. Stakeholder Feature Breakdown

### 3.1 Customer Experience
- **Authentication**: Phone OTP verification with guest browsing enabled until checkout.
- **Discovery**: Real-time nearby merchant feed filtered by geofence, vertical tags, and active operational status (`OPEN`, `CLOSED`, `BUSY`).
- **Instant Search**: Search results allow direct `ADD +` into cart with item customizer modal.
- **Discounts**: Dynamic promo banners and coupon engine (percentage or flat discount with minimum spend limits).
- **Payment Choice**: Cash on Delivery (COD) or Online Payment Gateway (SSLCommerz / Sandbox).
- **Failure Fallback**: Instant "Switch to Cash (COD)" option if an online payment attempt fails or remains unverified.
- **Live Tracking**: Visual 6-stage order stepper and live courier motorcycle icon on interactive map.
- **Smart Re-Order**: 1-tap re-order from history with automated verification of current store hours, item availability, and updated prices.

### 3.2 Rider Fleet Operations
- **Onboarding**: Minimal profile entry with administrative verification gate (`is_approved = true`).
- **Duty State**: Online/offline shift toggle with **In-Flight Duty Lock** (couriers cannot go offline while carrying active orders).
- **Broadcast Modal**: 45-second animated countdown with haptic vibration, system alert chime, store name, distance, delivery area, and payout.
- **Sequential Fulfillment**:
  - *Step 1*: Claim broadcast and travel to store (`POST /orders/:id/pickup`).
  - *Step 2*: Navigate to customer doorstep coordinates.
  - *Step 3*: Verify physical delivery and check mandatory COD cash collection box (`POST /orders/:id/deliver`).
- **Doorstep SOP**: 5-minute digital countdown timer and two-call protocol for unresponsive customers before returning parcel to Dispatch HQ.
- **Wallet & Cash Limit**: Daily earnings ledger with real-time tracking of collected COD cash against configured safety limit (`max_cash_limit`).

### 3.3 Vendor Store Operations
- **KDS Board**: 3-lane kanban board (`New Orders` ➔ `In Preparation` ➔ `Ready for Pickup`).
- **Audio Chime**: In-memory Web Audio oscillator alert (D5 587 Hz + A5 880 Hz) repeating every 3 seconds until all incoming orders are acknowledged.
- **Preparation Controls**: 1-tap accept with default prep time (e.g., 20m) or custom selector pills (`15m`, `25m`, `35m`, `45m`).
- **Rejection Modal**: Mandatory rejection reason code (`OUT_OF_STOCK`, `KITCHEN_OVERLOAD`, `STORE_CLOSING_SOON`, `OTHER`).
- **Stockout Management**: Instant 1-click stock switches for items and variants, retaining sold-out items on merchant view for easy reactivation.
- **Emergency Controls**: Header-level "Rush Hour Pause" button blocking customer checkout during kitchen surges.

### 3.4 Super Admin Governance
- **Fleet Radar**: Interactive Leaflet OSM map tracking active riders and unassigned orders with color-coded operational states.
- **Dispatch Override**: Force-assign any unassigned order to an online courier; force-cancel orders with mandatory 5-character audit reason.
- **Applicant Queue**: Approve, reject, or adjust cash safety limits for registered couriers.
- **Master Catalog Authority**: Centrally modify, re-price, or toggle items across all merchant menus.
- **Promotions Management**: Schedule homepage banners and create discount coupons with usage quotas.
- **Financial Settlement**: RFC 4180 CSV export for vendor net payables and courier earnings; trigger batch settlement cycles.

---

## 4. End-to-End Operational Lifecycle (`RIDER_FIRST`)

```
[1. Customer Checkout] ──► Validates open status, items in stock & geofenced address.
          │
          ▼
[2. Proximity Dispatch] ──► Redis GEORADIUS finds online couriers within 3–5 km.
          │
          ▼
[3. Atomic Mutex Claim] ──► First courier claims order via Redis SET NX EX lock.
          │
          ▼
[4. KDS Arrival Alert]  ──► Kitchen chime sounds; merchant accepts with prep duration.
          │
          ▼
[5. Counter Handover]   ──► Kitchen prepares order; marks READY_FOR_PICKUP; rider picks up.
          │
          ▼
[6. Doorstep Handover]  ──► Rider navigates to customer, collects COD (if cash), marks DELIVERED.
          │
          ▼
[7. Ledger Accounting]  ──► Deterministic double-entry commission & rider earnings ledger updated.
```

---

## 5. Commercial Accounting Breakdown

Dispute-free settlement arithmetic executed per completed order:

$$\begin{aligned}
\text{Gross Subtotal} &= \sum (\text{item\_price} \times \text{qty}) \\
\text{Net Subtotal} &= \text{Gross Subtotal} - \text{Coupon Discount} \\
\text{Total Customer Paid} &= \text{Net Subtotal} + \text{Delivery Fee} + \text{Tax} \\
\text{Platform Commission} &= \text{Net Subtotal} \times \left(\frac{\text{commission\_rate}}{100}\right) \\
\text{Net Vendor Payable} &= \text{Net Subtotal} - \text{Platform Commission} \\
\text{Platform Net Margin} &= \text{Platform Commission} + (\text{Delivery Fee} - \text{Rider Earnings})
\end{aligned}$$

---

## 6. Pilot Execution Parameters (10 Vendors)

- **Pilot Radius**: Concentrated 3–5 km dense delivery zone.
- **Merchant Mix**: 7 restaurants/cafes + 3 grocery/super shops.
- **Courier Fleet**: 5–8 pre-approved active riders.
- **Pricing Mode**: `FIXED_FLAT` (50.00 BDT / 12.00 SAR).
- **Core SLA Targets**:
  - End-to-end delivery cycle: $< 35$ minutes.
  - Merchant acceptance response: $< 2$ minutes.
  - Courier broadcast claim: $< 90$ seconds.
  - Successful fulfillment rate: $> 95\%$.
