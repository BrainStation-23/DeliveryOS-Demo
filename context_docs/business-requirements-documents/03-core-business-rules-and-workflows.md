# 03 — Core Business Rules & Commercial Logic

Authoritative business logic, mathematical equations, PostGIS spatial queries, order state transitions, commission formulas, and regional configurations for DeliveryOS.

---

## 1. Catalog, Cart & Address Guard Rules

### 1.1 Single-Vendor Cart Isolation
- **Rule**: A customer cart must contain items exclusively from one physical vendor outlet.
- **Inputs**: Incoming `product_id`, active `cart.vendor_id`.
- **Validation**: If `product.vendor_id != cart.vendor_id`, trigger cart conflict resolution modal.
- **Resolution**: Customer must explicitly confirm "Clear Cart & Add New" or cancel the addition.

### 1.2 Item Pricing Arithmetic
- **Formula**:
  $$\text{Item Total} = (\text{Base Price} + \text{Variant Price Modifier} + \sum \text{Addon Prices}) \times \text{Quantity}$$
- **Inputs**: `base_price` (NUMERIC), `price_modifier` (NUMERIC, default 0), `addon.price` (NUMERIC), `quantity` (INT > 0).
- **Output**: Line item total amount.

### 1.3 Cart Address Geofence Guard
- **Rule**: Customer delivery coordinates must fall strictly within the active vendor outlet's delivery radius.
- **PostGIS Boundary Query**:
  ```sql
  SELECT ST_DWithin(
      (SELECT coordinates FROM customer_addresses WHERE id = :address_id),
      (SELECT coordinates FROM vendors WHERE id = :vendor_id),
      (SELECT delivery_radius_km * 1000 FROM vendors WHERE id = :vendor_id)
  ) AS is_within_coverage;
  ```
- **Inputs**: `customer_address.coordinates` (GEOGRAPHY Point), `vendor.coordinates` (GEOGRAPHY Point), `vendor.delivery_radius_km` (NUMERIC).
- **Output**: Boolean `is_within_coverage`.
- **Edge Case**: If `is_within_coverage = FALSE`, checkout is strictly blocked with prompt: *"Selected address is outside this outlet's delivery coverage area."*

### 1.4 Promotional Coupon Engine
- **Percentage Discount Formula**:
  $$\text{Discount} = \min\left(\text{Gross Subtotal} \times \frac{\text{discount\_value}}{100}, \text{max\_discount\_amount}\right)$$
- **Flat Discount Formula**:
  $$\text{Discount} = \min(\text{discount\_value}, \text{Gross Subtotal})$$
- **Validation Invariants**:
  1. `order.gross_subtotal >= coupon.min_order_amount`
  2. `CURRENT_TIMESTAMP BETWEEN coupon.valid_from AND coupon.valid_to`
  3. `coupon.current_uses < coupon.usage_limit`
  4. `coupon.is_active = TRUE`

### 1.5 Smart Re-Order Validation
- **Inputs**: `previous_order_id`, `customer_id`.
- **Validation Pipeline**:
  1. Verify `vendor.is_active = TRUE` and within current operating schedule.
  2. Verify `ST_DWithin` between customer delivery address and vendor location.
  3. Verify `product.is_in_stock = TRUE` and `variant.is_in_stock = TRUE` for every item.
  4. Recalculate item subtotals using current active prices.
- **Output**: Populated cart with active items; alert dialog listing any unavailable dishes omitted.

### 1.6 Deterministic Order Numbering
- **Format**: `ORD-YYYYMMDD-XXXX` (e.g. `ORD-20261001-0042`).
- **Generation**: Atomic Redis counter `INCR order:seq:YYYYMMDD` with 48-hour key expiration.
- **Collision Fallback**: Database unique constraint violation triggers automated 3-attempt retry loop with random numeric jitter.

---

## 2. Order Lifecycle & Configurable Dispatch Sequences

The platform supports two dispatch execution sequences governed by `system_settings.order_flow_mode` ([ADR-002](context_docs/architecture-decision-records/ADR-002-dynamic-dual-order-flow-fsm.md)):

### 2.1 Mode 1: `RIDER_FIRST` (Zero Food Waste — Recommended Default)
1. **Order Placed**: Customer completes checkout (`PLACED`). If online payment, waits for `PAID` webhook.
2. **Proximity Broadcast**: System broadcasts order to available couriers within 3–5 km.
3. **Courier Secured**: First courier claims order via atomic Redis mutex lock (`RIDER_ASSIGNED`).
4. **Kitchen Alert**: Vendor portal sounds persistent Web Audio chime.
5. **Kitchen Acceptance**: Staff reviews items, selects prep timer, and taps Accept (`PREPARING`).
6. **Handover**: Staff packs food (`READY_FOR_PICKUP`); arriving courier confirms pickup (`DISPATCHED`).
7. **Delivery**: Courier navigates to customer, collects COD (if cash), and marks order (`DELIVERED`).

### 2.2 Mode 2: `VENDOR_FIRST` (Traditional Retail / Packaged Goods)
1. **Order Placed**: Customer completes checkout (`PLACED`).
2. **Kitchen Acceptance**: Vendor reviews order, selects prep timer, and taps Accept (`PREPARING`).
3. **Packaging Complete**: Vendor packs items and marks order (`READY_FOR_PICKUP`).
4. **Proximity Broadcast**: System broadcasts order to available couriers within radius.
5. **Pickup & Delivery**: Courier claims order, collects parcel (`DISPATCHED`), and delivers (`DELIVERED`).

### 2.3 Universal State Transition Matrix

| Current State | Target State | Permitted Roles | Invariants & Trigger Conditions |
| :--- | :--- | :--- | :--- |
| `PLACED` | `RIDER_ASSIGNED` | `RIDER`, `SUPER_ADMIN` | In `RIDER_FIRST` mode: Courier claims order via Redis mutex. |
| `PLACED` | `PREPARING` | `VENDOR_ADMIN`, `SUPER_ADMIN` | In `VENDOR_FIRST` mode: Vendor accepts order with prep duration. |
| `PLACED` | `CANCELLED` | `CUSTOMER`, `VENDOR_ADMIN`, `SUPER_ADMIN` | Pre-preparation cancellation. Releases payment authorizations. |
| `RIDER_ASSIGNED` | `PREPARING` | `VENDOR_ADMIN`, `SUPER_ADMIN` | Vendor acknowledges guaranteed-courier order and starts cooking. |
| `RIDER_ASSIGNED` | `CANCELLED` | `CUSTOMER`, `SUPER_ADMIN` | Customer cancels before cooking starts. Courier lock is released. |
| `PREPARING` | `READY_FOR_PICKUP` | `VENDOR_ADMIN`, `SUPER_ADMIN` | Items packed and waiting on store pickup counter. |
| `READY_FOR_PICKUP` | `DISPATCHED` | `RIDER`, `SUPER_ADMIN` | Courier physically confirms parcel collection at merchant counter. |
| `DISPATCHED` | `DELIVERED` | `RIDER`, `SUPER_ADMIN` | Courier confirms doorstep delivery and verifies COD cash checkbox. |
| *Any Pre-Dispatched* | `CANCELLED` | `SUPER_ADMIN` | Administrative override cancellation with mandatory min-5-char audit reason. |

---

## 3. Vendor Permission Hierarchy & Scope Rules

| Permission Tier | Role Identifier | Operational Scope | Authorized Actions |
| :--- | :--- | :--- | :--- |
| **Particular Outlet** | `PARTICULAR_OUTLET` | Single assigned outlet (`vendor_id`) | - View and manage KDS board for assigned outlet only.<br/>- Toggle item/variant stockout status for that outlet.<br/>- Modify operating hours and toggle rush hour pause.<br/>- Inspect store-specific sales ledger.<br/>*Strictly blocked from accessing other outlets.* |
| **All Outlets Master** | `ALL_OUTLETS_MASTER` | All outlets under brand (`brand_id`) | - Consolidated sales performance across all brand branches.<br/>- Header `OutletSwitcher` dropdown to toggle single or aggregated view.<br/>- Brand-wide menu pricing and item updates.<br/>- Consolidated brand settlement reports. |

---

## 4. Delivery Fee Calculation Engine

Governed by `system_settings.delivery_fee_mode`:

### 4.1 Mode A: `FIXED_FLAT` (Pilot Default)
$$\text{Delivery Fee} = \text{flatFee} \quad (\text{Default: } 50.00\text{ BDT} \text{ or } 12.00\text{ SAR})$$

### 4.2 Mode B: `DISTANCE_TIERED`
$$\text{Delivery Fee} = \begin{cases} 
\text{baseFee}, & \text{if } \text{distanceKm} \le \text{baseKm} \\
\text{baseFee} + ((\text{distanceKm} - \text{baseKm}) \times \text{perKmRate}), & \text{if } \text{distanceKm} > \text{baseKm}
\end{cases}$$

*(Canonical JSON Schema: `{ "mode": "FIXED_FLAT" | "DISTANCE_TIERED", "flatFee": number, "baseFee": number, "baseKm": number, "perKmRate": number }`)*

---

## 5. Double-Entry Financial Equations & Commission Ledger

Executed atomically inside a database transaction upon order completion (`DELIVERED`):

| Line Item | Mathematical Formula | Sample Transaction (BDT) |
| :--- | :--- | :--- |
| **Gross Subtotal** | $\sum (\text{item\_price} \times \text{quantity}) + \text{add-ons}$ | ৳ 500.00 |
| **Coupon Discount** | Value validated by coupon engine | - ৳ 50.00 |
| **Net Subtotal** | $\text{Gross Subtotal} - \text{Coupon Discount}$ | ৳ 450.00 |
| **Delivery Fee** | Computed via active delivery fee mode | ৳ 50.00 |
| **Tax / VAT** | $\text{Net Subtotal} \times (\text{tax\_rate} / 100)$ | ৳ 0.00 |
| **Total Customer Paid** | $\text{Net Subtotal} + \text{Delivery Fee} + \text{Tax}$ | **৳ 500.00** |
| **Platform Commission** | $\text{Net Subtotal} \times (\text{commission\_rate} / 100)$ | ৳ 67.50 (15%) |
| **Net Vendor Payable** | $\text{Net Subtotal} - \text{Platform Commission}$ | **৳ 382.50** |
| **Rider Delivery Earnings** | Configured flat/distance trip payout | **৳ 40.00** |
| **Platform Net Margin** | $\text{Platform Commission} + (\text{Delivery Fee} - \text{Rider Earnings})$ | **৳ 77.50** |

---

## 6. Cash on Delivery (COD) & Cash Limit Invariants

1. **Rider Cash Collection**:
   - For COD orders, courier collects `Total Customer Paid` in physical currency.
   - Courier balance updates:
     $$\text{cash\_in\_hand} \leftarrow \text{cash\_in\_hand} + \text{Total Customer Paid}$$
     $$\text{earnings\_balance} \leftarrow \text{earnings\_balance} + \text{rider\_delivery\_earnings}$$
2. **Safety Limit Invariant**:
   - If $\text{cash\_in\_hand} \ge \text{max\_cash\_limit}$ (e.g., 5,000 BDT / 500 SAR), dispatch engine excludes courier from new COD broadcasts until physical cash is deposited.
3. **Hub Cash Deposit Reconciliation**:
   - Courier records physical cash handover at hub (`POST /riders/deposit-cash`).
   - Hub manager or Admin verifies deposit (`PATCH /admin/finance/cash-deposits/:id/verify`), reducing `cash_in_hand` and restoring dispatch eligibility.

---

## 7. Multi-Region Parameters & Currency Matrix

| Configuration Parameter | Bangladesh (`BD`) | Saudi Arabia (`KSA`) |
| :--- | :--- | :--- |
| **Currency Code / Symbol** | `BDT` / `৳` | `SAR` / `﷼` |
| **Supported Locales** | English (`en`), Bengali (`bn`) | Arabic Right-to-Left (`ar`), English (`en`) |
| **Phone Number Format** | `+880` (10-digit national number) | `+966` (9-digit national number) |
| **Default Flat Delivery Fee** | 50.00 BDT | 12.00 SAR |
| **Default Base Distance / Per-KM** | 2.0 km / 10.00 BDT | 3.0 km / 2.50 SAR |
| **Default Rider COD Limit** | 5,000.00 BDT | 500.00 SAR |
