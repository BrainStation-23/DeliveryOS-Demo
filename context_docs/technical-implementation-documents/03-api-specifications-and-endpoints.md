# 03 — API Specifications & Endpoints

RESTful API contracts, request/response DTO schemas, authentication guards, and error formats for the **DeliveryOS** backend (`/api/v1`).

---

## 1. Global API Standards & Envelopes

- **Base URL**: `https://api.domain.com/api/v1` (locally `http://localhost:8080/api/v1`)
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <jwt_access_token>`
- **Standard Response Envelopes**:
  - *Success (200/201)*:
    ```json
    { "success": true, "statusCode": 200, "message": "Operation successful", "data": {} }
    ```
  - *Error (4xx/5xx)*:
    ```json
    { "success": false, "statusCode": 400, "error": "BAD_REQUEST", "message": "Reason description", "timestamp": "ISO-8601" }
    ```

---

## 2. Granular API Endpoints Catalog

### 2.1 Authentication & User Session Module (`/auth`)
- **`POST /auth/otp/request`**
  - *Guard*: Public (Throttled: 5 req / min per IP).
  - *Body*: `{ "phone": "+8801700000000", "role": "CUSTOMER" }` (role: `CUSTOMER` | `RIDER` | `VENDOR_ADMIN`).
  - *Response*: `{ "retryAfterSeconds": 60 }`.
- **`POST /auth/otp/verify`**
  - *Guard*: Public (Throttled: 30 req / min per IP; 5-attempt brute-force lockout).
  - *Body*: `{ "phone": "+8801700000000", "otp": "123456" }`.
  - *Response*: `{ "accessToken": "jwt...", "refreshToken": "jwt...", "user": { "id": "...", "phone": "...", "role": "..." } }`.
- **`POST /auth/refresh`**
  - *Guard*: Public (Throttled: 30 req / min).
  - *Body*: `{ "refreshToken": "jwt..." }`.
  - *Response*: `{ "accessToken": "jwt...", "refreshToken": "jwt..." }` (single-use rotating jti with Redis revocation store).
- **`POST /auth/logout`**
  - *Guard*: Public (Idempotent).
  - *Body*: `{ "refreshToken": "jwt..." }`.
  - *Response*: `{ "message": "Logged out successfully" }`.
- **`GET /auth/me`**
  - *Guard*: `JwtAuthGuard`.
  - *Response*: Hydrated user session with permissions, scopes, and profile data (device tokens omitted).
- **`POST /auth/device-token`**
  - *Guard*: `JwtAuthGuard`.
  - *Body*: `{ "fcmToken": "fcm-string", "devicePlatform": "ANDROID" | "IOS" | "WEB" }`.

### 2.2 Customer Discovery, Cart & Checkout (`/vendors`, `/orders`, `/coupons`, `/banners`)
- **`GET /banners/active`**
  - *Guard*: Public.
  - *Response*: Array of `{ "id": "...", "title": "...", "imageUrl": "...", "linkType": "OUTLET" | "CATEGORY", "targetId": "..." }`.
- **`GET /vendors/nearby`**
  - *Guard*: Public.
  - *Query*: `lat` (float), `lng` (float), `vertical` (optional: `FOOD` | `GROCERY` | `SUPER_SHOP` | `PHARMACY`), `limit` (optional int: 1–100, default 50).
  - *Action*: Executes PostGIS `ST_DWithin` returning outlets where user is within `delivery_radius_km`.
- **`GET /vendors/search`**
  - *Guard*: Public.
  - *Query*: `q` (string), `lat` (float), `lng` (float).
  - *Response*: Matched vendors and dishes available in range.
- **`GET /vendors/:id/catalog`**
  - *Guard*: Public.
  - *Response*: Outlet categories and active products with `isInStock = true`.
- **`POST /vendors/validate-address-coverage`**
  - *Guard*: `JwtAuthGuard` (any authenticated role; Throttled: 30 req / min). When `addressId` is supplied, ownership is enforced exactly like checkout — a caller may only probe their own saved addresses (403 otherwise).
  - *Body*: `{ "vendorId": "uuid", "latitude": 23.7808, "longitude": 90.4190 }` or `{ "vendorId": "uuid", "addressId": "uuid" }`.
  - *Response*: `{ "isWithinCoverage": true, "distanceKm": 2.4, "deliveryRadiusKm": 5.0, "estimatedDeliveryFee": 50.0, "isActive": true, "isBusy": false }`.
- **`POST /cart/validate-address-coverage`**
  - *Guard*: `JwtAuthGuard` (any authenticated role). Cart-controller alias of the vendor coverage check; identical address-ownership rule.
  - *Body / Response*: Identical to `POST /vendors/validate-address-coverage`.
- **`POST /coupons/validate`**
  - *Guard*: Public (Throttled: 30 req / min).
  - *Body*: `{ "code": "PILOT50", "cartSubtotal": 500.0, "vendorId": "uuid" }`.
  - *Response*: `{ "isValid": true, "code": "PILOT50", "discountAmount": 50.0, "minOrderAmount": 300.0, "discountType": "FLAT" }`.
- **`POST /orders/checkout`**
  - *Guard*: `JwtAuthGuard` (`CUSTOMER`).
  - *Body*:
    ```json
    {
      "vendorId": "uuid",
      "deliveryAddressId": "uuid",
      "deliveryMethod": "HOME_DELIVERY",
      "paymentMethod": "CASH_ON_DELIVERY",
      "couponCode": "PILOT50",
      "customerNotes": "Don't ring bell",
      "items": [{ "productId": "uuid", "quantity": 2, "variantId": "uuid", "addonIds": ["uuid"] }]
    }
    ```
  - *Response*: `{ "orderId": "uuid", "orderNumber": "ORD-20261001-0042", "totalAmount": 500.0, "status": "PLACED" }`.
- **`POST /orders/validate-reorder`**
  - *Guard*: `JwtAuthGuard` (`CUSTOMER`). Checks customer ownership of previous order to eliminate IDOR.
  - *Body*: `{ "previousOrderId": "uuid" }`.
  - *Response*: `{ "isStoreOperational": true, "hasStockChanges": false, "vendorId": "uuid", "vendorName": "Sweet Treats", "validItems": [{ "productId": "uuid", "name": "Cupcake", "currentBasePrice": 120.0, "quantity": 2, "variantId": null, "isAvailable": true }], "unavailableItems": [] }`.
- **`GET /orders/history`**
  - *Guard*: `JwtAuthGuard` (`CUSTOMER`).
  - *Query*: `page` (int, default 1), `limit` (int, default 10).
  - *Response*: Paginated envelope `{ "items": [...], "total": 12, "page": 1, "limit": 10, "totalPages": 2 }`.
- **`GET /orders/:id`**
  - *Guard*: `JwtAuthGuard` (owner).
  - *Response*: Full order detail envelope (status, items, payment, courier snapshot).
- **`GET /orders/:id/live-tracking`**
  - *Guard*: `JwtAuthGuard` (`CUSTOMER`).
  - *Response*: Current status, stepper step, courier coordinates (`lat`, `lng`, `bearing`), and ETA.
- **`POST /orders/:id/switch-cod`**
  - *Guard*: `JwtAuthGuard` (`CUSTOMER`).
  - *Action*: Converts pending/failed online gateway order to COD and releases to kitchen/dispatch.
- **`POST /orders/:id/cancel`**
  - *Guard*: `JwtAuthGuard` (`CUSTOMER`).
  - *Condition*: Allowed only in `PLACED` or `RIDER_ASSIGNED` states.

### 2.3 Vendor Store & Kitchen Console Module (`/vendor`)
- **`GET /vendor/me`**: Returns vendor staff profile, assigned outlet, and permission scope.
- **`GET /vendor/outlets`**: Lists accessible outlets for brand owner switcher (`ALL_OUTLETS_MASTER`).
- **`GET /vendor/orders/live?vendorId=...`**: Fetches active KDS orders grouped across 3 kanban lanes.
- **`PATCH /vendor/orders/:id/accept`**
  - *Body*: `{ "prepTimeMinutes": 25 }`.
  - *Action*: Transitions order directly to `PREPARING` per ADR-002, setting `accepted_at = NOW()`.
  - *Invariant*: In `RIDER_FIRST` mode a `PLACED` order returns `409` — the kitchen cannot begin preparation before a courier secures the order. The update is conditional on the observed status, so a concurrent cancellation wins instead of being overwritten.
- **`POST /vendor/orders/:id/reject`**
  - *Body*: `{ "reasonCode": "OUT_OF_STOCK" | "KITCHEN_OVERLOAD" | "STORE_CLOSING_SOON" | "OTHER", "reasonNotes": "..." }`.
  - *Action*: Transitions order to `CANCELLED`.
- **`PATCH /vendor/orders/:id/ready`**: Transitions order to `READY_FOR_PICKUP` (status-conditional update; concurrent cancellations win).
- **`PATCH /vendor/orders/:id/handover`**: Transitions order to `DISPATCHED` upon physical courier pickup. Delivery orders require an **assigned courier** first (`400` if `riderId` is null — dispatching a riderless delivery order would strand it); takeaway orders hand over to the customer without a courier.
- **`GET /vendor/catalog?vendorId=...`**: Returns full catalog retaining sold-out items with total/in-stock counts.
- **`PATCH /vendor/products/:id/stock`**: Body `{ "isInStock": boolean }`.
- **`PATCH /vendor/products/variants/:id/stock`**: Body `{ "isInStock": boolean }`.
- **`GET /vendor/settings?vendorId=...`**: Returns operating hours, default prep duration, and rush pause state.
- **`PATCH /vendor/settings`**: Body `{ "vendorId": "uuid", "isBusy": boolean, "defaultPrepTimeMinutes": 20 }`.
- **`PUT /vendor/operating-hours`**: Body `{ "operatingHours": [{ "dayOfWeek": 0, "openTime": "09:00", "closeTime": "22:00", "isClosed": false }] }`.
- **`GET /vendor/sales?vendorId=...&dateFrom=ISO&dateTo=ISO`**: Returns sales volume, completed orders, commission, and net payable over the optional date range (omit both for all-time). The TODAY view passes `dateFrom` = region-local midnight so a single business day is fetched instead of the full history.

### 2.4 Rider Fleet Operations Module (`/rider`)
- **`GET /rider/profile`**: Returns courier status, vehicle, cash in hand, and max safety limit, plus computed lifetime metrics `earningsBalance` (sum of trip-ledger earnings) and `completedTripsCount` (delivered orders) so rider-app dashboards never boot from fabricated defaults.
- **`GET /rider/active-trip`**: Returns active in-flight delivery trip envelope (`RIDER_ASSIGNED`, `ACCEPTED`, `PREPARING`, `READY_FOR_PICKUP`, or `DISPATCHED`) for courier mobile app rehydration on startup or reconnection, or `null` if idle.
- **`PATCH /rider/duty`**
  - *Body*: `{ "isOnline": boolean }`.
  - *Invariant*: Returns `400 Bad Request` if attempting to go offline with an active delivery (all five in-flight statuses).
- **`POST /rider/orders/:id/claim`**
  - *Action*: Acquires atomic Redis mutex `SET lock:order_claim:${id} ${riderId} NX EX 10`.
  - *Invariants*: Rejects offline/unapproved/suspended couriers, orders already claimed, unverified `ONLINE_GATEWAY` payments, and COD claims that would breach `maxCashLimit`. A **DB in-flight backstop** inside the transaction refuses the claim if the courier already holds any open trip (the Redis `rider:active_order` marker can be lost to eviction/crash); the busy key itself is set only after the DB transaction commits.
  - *Success*: Assigns courier, updates status (`RIDER_ASSIGNED`), alerts kitchen, and returns the order with server-computed `riderEarnings` (delivery fee × rider share).
- **`PATCH /rider/orders/:id/pickup`**: Confirms parcel pickup at store counter; transitions order to `DISPATCHED`. **Only the assigned courier** may confirm pickup (a null `riderId` is rejected, not adopted) and the update is conditional on the observed status — a concurrent cancellation wins instead of being resurrected.
- **`PATCH /rider/orders/:id/deliver`**
  - *Body*: `{ "codCashCollected": boolean, "amountCollected": 500.0 }`.
  - *Action*: Guarded `DISPATCHED → DELIVERED` claim (concurrent double-submit loses), caps `amountCollected` at the order total, credits `cashInHand` only on confirmed COD collection, and upserts the trip ledger.
  - *Response*: `{ "order": {...}, "tripLedger": { "deliveryEarnings", "codCollected", ... } }` — clients reconcile wallets from `tripLedger`, never locally computed payout.
- **`POST /rider/orders/:id/report-issue`**
  - *Body*: `{ "reason": "Customer unreachable at delivery address" }`.
  - *Action*: Status-conditional `DISPATCHED → READY_FOR_PICKUP` reset (a concurrent cancellation cannot be overwritten), unlocks courier, reports doorstep failure, and alerts Dispatch HQ.
- **`GET /rider/trips`**: Returns completed delivery trips, payout earnings, and collected cash.
- **`POST /rider/cash/deposit`**: Body `{ "amount": 2500.0, "notes": "Banani Hub" }`.
- **`GET /rider/cash/deposits`**: Returns history of submitted cash deposits.

### 2.5 Super Admin Master Governance Module (`/admin`)
- **`POST /admin/uploads`** (legacy alias — now delegates to the media library)
  - *Guard*: `JwtAuthGuard` + `RolesGuard` (`SUPER_ADMIN`).
  - *Body*: `multipart/form-data` with `file` (JPEG/PNG/WebP/GIF, max 5 MB).
  - *Response*: the registered `media_assets` entity (ADR-016), including its public `url`.
- **`GET /admin/media`**: Central media library listing — paginated `{ items, total, page, limit, totalPages }`, newest first, with optional `search` (case-insensitive contains over `originalName` and `filename`); each item carries `id`, `url`, `filename`, `originalName`, `mimeType`, `sizeBytes`, `width`/`height` (client-measured post-crop), `uploadedBy { id, fullName }`, `createdAt`.
- **`POST /admin/media`**: Upload to the central library — `multipart/form-data` with `file` (JPEG/PNG/WebP/GIF, max 5 MB) plus optional `width`/`height` ints (final pixel dimensions after client-side crop/resize) and optional `name` (display name, ≤255 chars; defaults to the uploaded file name). Returns the registered entity.
- **`DELETE /admin/media/:id`**: Deletes the asset row first, then unlinks the stored file (idempotent file removal; 404 for unknown ids).
- **`GET /admin/overview`**: Platform KPIs (gross revenue, active orders, online fleet, pending applicants).
- **`GET /admin/fleet`**: Real-time fleet radar feed with GPS coordinates, online states, and cash safety margins.
- **`GET /admin/orders`**
  - *Query*: `status` (optional), `search` (optional, matches order number/customer name/phone), `dateFrom`/`dateTo` (optional ISO-8601 inclusive bounds on `placedAt`), `page` (int, default 1), `limit` (int, default 10).
  - *Response*: Paginated orders `{ "items": [...], "total": 120, "page": 1, "limit": 10, "totalPages": 12 }`.
- **`GET /admin/orders/:id`**: Full detail view for one order — parties (outlet/customer/courier with phones), status + payment, money breakdown (`subtotal`, `couponDiscount`, `deliveryFee`, `taxAmount`, `totalAmount`), lifecycle timestamps (`placedAt`, `acceptedAt`, `pickedUpAt`, `deliveredAt`, `cancelledAt`, `rejectionReason`), line items, and delivery address. 404 for unknown ids.
- **`POST /admin/orders/:id/force-assign`**: Body `{ "riderId": "uuid" }` (bypasses automated dispatch).
- **`POST /admin/orders/:id/cancel`**: Body `{ "reason": "Min 5 char audit reason" }` (reverses ledger and voids holds).
- **`GET /admin/riders`**: Fleet list (`approvalStatus=ALL | PENDING | APPROVED`, `isOnline=true|false`).
- **`PATCH /admin/riders/:id/approval`**: Body `{ "isApproved": boolean }`.
- **`PATCH /admin/riders/:id/cash-limit`**: Body `{ "maxCashLimit": 8000.0 }`.
- **`GET /admin/vendors`** / **`POST /admin/vendors`** / **`PATCH /admin/vendors/:id`**: Complete vendor CRUD — a `brandId` is required on create and can be switched on update but never detached (ADR-017).
- **`GET /admin/vendors/:id/catalog`**: Full catalog governance view for one outlet — active categories → products with variations (absolute `price`, `sortOrder`) and add-on groups. 404 for unknown outlets.
- **`GET /admin/outlets/:id`**: Aggregated Outlet Page payload — brand strip, outlet info, operating hours, staff assignments, and the category → product → variation catalog in one call (no N+1).
- **`POST /admin/products`** / **`PATCH /admin/products/:id`**: Wholesale product save (ADR-017) — body `{ vendorId?, categoryId, name, description?, imageUrl?, isInStock?, sortOrder?, variations: [{ id?, name, price, isInStock }] }`. One ACID transaction: ≥1 variation enforced (400), omitted variation ids deleted (safe — snapshots are JSONB), order renumbered 1..n, `basePrice` synced to the first variation. Replaces the former override/disable endpoints.
- **`PUT /admin/vendors/:id/operating-hours`**: Body `{ hours: [7 × { dayOfWeek, openTime "HH:mm", closeTime, isClosed }] }` — upserts the weekly schedule.
- **`POST /admin/vendors/:id/categories`** / **`PATCH /admin/categories/:id`**: Outlet-scoped category create; rename/sort/deactivate.
- **`PATCH /admin/vendor-staff/:id`**: Body `{ isActive?, scope?, brandId?, vendorId? }` — assignment active/inactive toggle (inactive staff lose vendor-portal access immediately via session-cache purge) and scope switch (owner rebinds to the brand, manager to an outlet).
- **`PATCH /admin/users/:id`**: Body `{ fullName?, phone? }` — staff account edits with duplicate-phone 409 and session-cache purge.
- **`POST /admin/vendors/:id/staff`**: Body `{ "userId": "uuid", "scope": "PARTICULAR_OUTLET" | "ALL_OUTLETS_MASTER", "brandId?" }` — assigns outlet staff scope (idempotent upsert; ALL_OUTLETS_MASTER defaults to the outlet's brand).
- **`GET /admin/brands?search=`** / **`POST /admin/brands`** / **`PATCH /admin/brands/:id`** / **`DELETE /admin/brands/:id`**: Brand CRUD — list carries outlet/staff counts with optional case-insensitive name search (take 50); duplicate names 409; deletion 409-blocked while outlets or staff reference the brand.
- **`GET /admin/users/search?phone=`**: User lookup by phone fragment (min 3 chars, contains-match, take 10) — feeds the staff assignment picker.
- **`POST /admin/users`**: Body `{ "phone", "fullName" }` — provisions a VENDOR_ADMIN owner/staff account (no password; the owner later signs in with this phone via OTP). Duplicate phone 409.
- **`GET /admin/vendor-staff`**: Every staff assignment with user, outlet, brand, and scope.
- **`DELETE /admin/vendor-staff/:id`**: Removes an assignment; demotes the account to CUSTOMER when it was the last tie and purges the session cache for immediate revocation. 404 for unknown ids.
- **`GET /admin/catalog/categories`** / **`POST /admin/catalog/categories`**: Master central category list + creation.
- **`PUT /admin/catalog/products/:id/override`**: Centrally overrides product name/description/basePrice/category/stock across stores.
- **`PATCH /admin/catalog/products/:id/disable`**: Body `{ "isInStock": boolean }` — central stock toggle.
- **`GET /admin/banners`** / **`POST /admin/banners`** / **`PATCH /admin/banners/:id`** / **`DELETE /admin/banners/:id`**: Banner CRUD.
- **`GET /admin/coupons`** / **`POST /admin/coupons`** / **`PATCH /admin/coupons/:id`** / **`DELETE /admin/coupons/:id`**: Coupon CRUD.
- **`GET /admin/settings`**: Returns current FSM mode and delivery fee pricing mode.
- **`GET /admin/settings/order-flow`**: Returns the active fulfillment flow config (`mode`, `riderSearchTimeoutSeconds`).
- **`PATCH /admin/settings/order-flow`**: Body `{ "mode": "RIDER_FIRST" | "VENDOR_FIRST", "riderSearchTimeoutSeconds?" }`.
- **`PATCH /admin/settings/delivery-fee`**: Body `{ "mode": "FIXED_FLAT" | "DISTANCE_TIERED", "flatFee": 50.0, "baseFee": 40.0, "baseKm": 2.0, "perKmRate": 15.0 }`.
- **`GET /admin/finance/settlement-export?format=csv`**: Downloads RFC 4180 CSV settlement file.
- **`POST /admin/finance/settle-cycle`**: Triggers batch settlement cycle for pending orders.
- **`GET /admin/finance/settlement-batches`**: Lists historical settlement batches.
- **`GET /admin/finance/cash-deposits`**: Lists courier cash deposits awaiting verification.
- **`PATCH /admin/finance/cash-deposits/:id/verify`**: Body `{ "action": "APPROVE" | "REJECT", "notes": "..." }`.

### 2.6 Payments Module (`/payments`)
- **`POST /payments/initiate`**
  - *Guard*: `JwtAuthGuard` (`CUSTOMER`).
  - *Body*: `{ "orderId": "uuid", "gateway": "SSLCOMMERZ" | "SANDBOX", "redirectUrl": "..." }`.
  - *Response*: `{ "redirectUrl": "https://sandbox.sslcommerz.com/...", "transactionId": "..." }`.
- **`POST /payments/webhook/:gateway`**: Public HMAC verified webhook endpoint. Idempotently marks payment `PAID` via atomic update.
- **`GET /payments/status/:transactionId`**: Owner-only (`403` otherwise); returns a redacted view (status `PENDING|PAID|FAILED|REFUNDED`, amount, order snapshot) — `sessionKey` and raw `gatewayResponse` never leave the server.
- **`GET /payments/callback/:gateway`** & **`POST /payments/callback/:gateway`**: Browser redirect return URL and gateway POST-back handler after payment attempt. Accepts status and transaction identifier from either GET query parameters or POST form body.

### 2.7 Saved Addresses & Utilities (`/customers`, `/health`, `/geo`)
- **`GET /customers/addresses`** / **`POST /customers/addresses`** / **`PUT /customers/addresses/:id`** / **`DELETE /customers/addresses/:id`**: Customer delivery address book CRUD.
- **`PATCH /customers/addresses/:id/default`**: Sets default delivery address.
- **`GET /customers/profile`** / **`PATCH /customers/profile`**: Customer profile management.
- **`GET /health`**: Health check probe returning PostgreSQL and Redis connection status.
- **`GET /geo/reverse-geocode`**: Reverse geocoding (`lat`, `lng`) returning `{ displayName, addressLine, city }`, cached in Redis for 24 hours.
- **`GET /geo/geocode`**: Forward geocoding query string (`q`) returning array of `{ displayName, addressLine, latitude, longitude, city, postcode, country }` with regional Bangladesh biasing and 24-hour Redis caching.
