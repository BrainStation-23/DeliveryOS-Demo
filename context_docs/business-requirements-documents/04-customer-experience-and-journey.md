# 04 — Customer Mobile App Journey Specification

Functional specifications, screen states, user inputs, business guards, outputs, and edge cases for the **Customer Mobile App** (Flutter (Dart ^3.8), Riverpod 3).

---

## 1. Screen Flow Diagram

```
[Splash & Auth] ──► [Location & Address Book] ──► [Home & Discovery] ──► [Storefront & Menu]
                                                                                │
                                                                                ▼
[Smart Re-Order] ◄── [Live Map Tracking] ◄── [Payment & Switch-to-COD] ◄── [Guarded Cart & Checkout]
```

---

## 2. Granular Screen Specifications

### Screen 1: Splash & Authentication
- **Components**: Locale selector (`en`, `ar` RTL, `bn`), phone input field, OTP verification view.
- **Inputs**: Phone number with country prefix (`+880` / `+966`), 6-digit SMS OTP.
- **Business Rules**:
  - **Guest Browsing Invariant**: Customers may browse outlets, search dishes, and assemble a cart without logging in. Authentication is enforced only when tapping Checkout or saving an address.
  - Rate limiting: Max 3 OTP requests per 15 minutes per phone number.
- **Outputs**: Verified session token (JWT) stored in secure local storage; user profile hydrated.
- **Edge Cases**: Invalid OTP surfaces inline validation error; countdown timer controls OTP resend.

### Screen 2: Location Picker & Address Book CRUD (`AddressBookScreen`)
- **Components**: Draggable map pin picker on Google Maps, address search bar, address management list (`/addresses`).
- **Inputs**: Map coordinates, street address, building/floor/flat, address label (`Home`, `Work`, `Other`), delivery instructions (gate code, landmark).
- **Business Rules**:
  - Coordinates extracted directly from map marker or GPS geolocation (`lat`, `lng`).
  - Active location filters all outlet feeds to those serving within their delivery radius.
- **Outputs**: Persistent address record; active customer coordinate state updated in Riverpod `LocationNotifier`.
- **Edge Cases**: Geocoding failure falls back to manual street address entry.

### Screen 3: Home Feed, Categorized Discovery & Instant Search (`SearchScreen`)
- **Components**: Promotional banner carousel, vertical category filter pills (`All`, `FOOD`, `GROCERY`, `PHARMACY`), outlet cards, search bar.
- **Inputs**: Search query text `q`, vertical category selection.
- **Business Rules**:
  - Store card shows outlet name, vertical tag, ETA, delivery fee, distance (km), and operational badges (`OPEN`, `CLOSED`, `BUSY`).
  - Search queries both outlet names and item titles simultaneously (`GET /vendors/search?q=...`).
  - **Direct Add Action**: Item cards in search results feature an `ADD +` button launching the `ItemCustomizerSheet` directly without loading the store page.
  - **Single-Vendor Cart Conflict**: Adding an item from Store B while Store A items exist in cart triggers a confirmation modal: *"Clear Cart & Add New?"*.
- **Outputs**: Filtered merchant list; navigation to `OutletDetailScreen` or instant item addition.
- **Edge Cases**: Zero search results shows empty state with suggestions to clear filters.

### Screen 4: Storefront & Menu Navigation (`OutletDetailScreen`)
- **Components**: Outlet header banner, collapsing sticky category bar, dish listing cards.
- **Inputs**: Category tab taps, item selection.
- **Business Rules**:
  - Sticky category bar pinned below app bar for rapid scrolling across dish categories.
  - Out-of-stock items displayed with grayed-out "Sold Out" badge with disabled `ADD` button.
- **Outputs**: Tapping an available item opens the `ItemCustomizerSheet`.

### Screen 5: Item Customizer Modal (`ItemCustomizerSheet`)
- **Components**: Variant selection radio buttons, add-on checkboxes, special notes textarea, quantity stepper, dynamic subtotal button.
- **Inputs**: Selected variant ID, selected add-on IDs, item quantity, special cooking instructions.
- **Business Rules**:
  - Single-choice variants (e.g. Regular, Large or 500g, 1kg) recalculate line total dynamically.
  - Add-on groups enforce `min_selection` and `max_selection` bounds.
- **Outputs**: Formatted cart item payload dispatched to Riverpod `CartNotifier`.

### Screen 6: Cart & Operational Guards (`CartScreen`)
- **Components**: Line items list, store operational banners, delivery address picker, coupon code input, payment method toggle, checkout CTA button.
- **Inputs**: Item quantity adjustments, applied coupon code, selected delivery address, payment method (`CASH_ON_DELIVERY` or `ONLINE_GATEWAY`).
- **Business Rules & Guards**:
  - **Closed Store Guard**: Red banner if `is_active = false`; primary button disabled (`"Store Currently Closed"`).
  - **Rush Hour Pause Guard**: Amber banner if `is_busy = true`; primary button disabled (`"Store Paused (Rush Hour)"`).
  - **Address Geofence Guard**: Backend verifies coordinates via PostGIS `ST_DWithin`. If outside delivery radius, checkout is blocked with high-contrast alert.
  - **Coupon Engine**: Validates code with minimum spend check; deducts line item discount.
- **Outputs**: Validated order placement request payload submitted to `POST /orders/checkout`.

### Screen 7: Order Placement & Payment Gateway
- **Components**: Checkout execution trigger, payment gateway webview session (SSLCommerz / Sandbox).
- **Inputs**: Gateway payment confirmation or COD selection.
- **Business Rules**:
  - For COD orders: Order is created immediately in `PLACED` status and enters dispatch pipeline.
  - For Online Gateway orders: Order remains in `PLACED` with `payment_status = PENDING`. Broadcast is held until cryptographic webhook verification confirms `PAID` ([ADR-011](../architecture-decision-records/ADR-011-multi-gateway-online-payment-and-webhook-idempotency.md)).
- **Outputs**: Order UUID and order number; navigation to `OrderTrackingScreen`.

### Screen 8: Live Order Tracking & Failure Recovery (`OrderTrackingScreen`)
- **Components**: 6-stage fulfillment stepper, interactive live map with courier motorcycle icon, direct call action buttons, 24/7 hotline launcher, Switch-to-COD failure card.
- **Inputs**: Stepper refresh, direct phone call tap (`tel:`), Switch-to-COD tap.
- **Business Rules**:
  - Stepper stages: `Placed` ➔ `Assigned` ➔ `Preparing` ➔ `Ready` ➔ `Delivering` ➔ `Delivered`.
  - Courier location streamed via WebSocket `rider:location:update` onto map marker.
  - **Switch-to-COD Recovery Card**: Appears when online payment fails or remains pending. One-tap action (`POST /orders/:id/switch-cod`) converts order to cash and releases it to kitchen and dispatch queue.
  - **Direct Dialer Shortcuts**: One-tap phone button opens device native dialer to call courier or merchant.
  - **Customer Hotline**: Dialing shortcut to platform support (`+8801700000000`).
  - **Self-Service Cancellation**: Allowed only in `PLACED` or `RIDER_ASSIGNED` states (`POST /orders/:id/cancel`).
- **Outputs**: State updates reflected in UI; direct telephone handoff.

### Screen 9: Smart Re-Order from Order History (`OrderHistoryScreen`)
- **Components**: Past orders receipt feed, 1-tap "Re-Order" button.
- **Inputs**: Order ID selection.
- **Business Rules**:
  - Backend validation pipeline checks: store open status, geofence radius, item in-stock status, and price changes.
  - If items are out of stock, displays alert dialog itemizing omitted items and loads available items into cart at current prices.
- **Outputs**: Cart populated with active items and navigation to `CartScreen`.
