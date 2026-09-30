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
  - *Guard*: Public (Throttled: 30 req / min).
  - *Body*: `{ "vendorId": "uuid", "latitude": 23.7808, "longitude": 90.4190 }` or `{ "vendorId": "uuid", "addressId": "uuid" }`.
  - *Response*: `{ "isWithinCoverage": true, "distanceKm": 2.4, "deliveryRadiusKm": 5.0, "estimatedDeliveryFee": 50.0, "isActive": true, "isBusy": false }`.
- **`POST /cart/validate-address-coverage`**
  - *Guard*: Public (Throttled: 30 req / min). Cart-controller alias of the vendor coverage check.
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
- **`POST /vendor/orders/:id/reject`**
  - *Body*: `{ "reasonCode": "OUT_OF_STOCK" | "KITCHEN_OVERLOAD" | "STORE_CLOSING_SOON" | "OTHER", "reasonNotes": "..." }`.
  - *Action*: Transitions order to `CANCELLED`.
- **`PATCH /vendor/orders/:id/ready`**: Transitions order to `READY_FOR_PICKUP`.
- **`PATCH /vendor/orders/:id/handover`**: Transitions order to `DISPATCHED` upon physical courier pickup.
- **`GET /vendor/catalog?vendorId=...`**: Returns full catalog retaining sold-out items with total/in-stock counts.
- **`PATCH /vendor/products/:id/stock`**: Body `{ "isInStock": boolean }`.
- **`PATCH /vendor/products/variants/:id/stock`**: Body `{ "isInStock": boolean }`.
- **`GET /vendor/settings?vendorId=...`**: Returns operating hours, default prep duration, and rush pause state.
- **`PATCH /vendor/settings`**: Body `{ "vendorId": "uuid", "isBusy": boolean, "defaultPrepTimeMinutes": 20 }`.
- **`PUT /vendor/operating-hours`**: Body `{ "operatingHours": [{ "dayOfWeek": 0, "openTime": "09:00", "closeTime": "22:00", "isClosed": false }] }`.
- **`GET /vendor/sales?vendorId=...&dateFilter=TODAY`**: Returns sales volume, completed orders, commission, and net payable.

### 2.4 Rider Fleet Operations Module (`/rider`)
- **`GET /rider/profile`**: Returns courier status, vehicle, cash in hand, and max safety limit.
- **`GET /rider/active-trip`**: Returns active in-flight delivery trip envelope (`RIDER_ASSIGNED`, `ACCEPTED`, `PREPARING`, `READY_FOR_PICKUP`, or `DISPATCHED`) for courier mobile app rehydration on startup or reconnection, or `null` if idle.
- **`PATCH /rider/duty`**
  - *Body*: `{ "isOnline": boolean }`.
  - *Invariant*: Returns `400 Bad Request` if attempting to go offline with an active delivery.
- **`POST /rider/orders/:id/claim`**
  - *Action*: Acquires atomic Redis mutex `SET lock:order_claim:${id} ${riderId} NX EX 10`.
  - *Invariants*: Rejects offline/unapproved/suspended couriers, orders already claimed, unverified `ONLINE_GATEWAY` payments, and COD claims that would breach `maxCashLimit`. The `rider:active_order` busy key is set only after the DB transaction commits.
  - *Success*: Assigns courier, updates status (`RIDER_ASSIGNED`), alerts kitchen, and returns the order with server-computed `riderEarnings` (delivery fee × rider share).
- **`PATCH /rider/orders/:id/pickup`**: Confirms parcel pickup at store counter; transitions order to `DISPATCHED`.
- **`PATCH /rider/orders/:id/deliver`**
  - *Body*: `{ "codCashCollected": boolean, "amountCollected": 500.0 }`.
  - *Action*: Guarded `DISPATCHED → DELIVERED` claim (concurrent double-submit loses), caps `amountCollected` at the order total, credits `cashInHand` only on confirmed COD collection, and upserts the trip ledger.
  - *Response*: `{ "order": {...}, "tripLedger": { "deliveryEarnings", "codCollected", ... } }` — clients reconcile wallets from `tripLedger`, never locally computed payout.
- **`POST /rider/orders/:id/report-issue`**
  - *Body*: `{ "reason": "Customer unreachable at delivery address" }`.
  - *Action*: Unlocks courier, reports doorstep failure, and alerts Dispatch HQ.
- **`GET /rider/trips`**: Returns completed delivery trips, payout earnings, and collected cash.
- **`POST /rider/cash/deposit`**: Body `{ "amount": 2500.0, "notes": "Banani Hub" }`.
- **`GET /rider/cash/deposits`**: Returns history of submitted cash deposits.

### 2.5 Super Admin Master Governance Module (`/admin`)
- **`POST /admin/uploads`**
  - *Guard*: `JwtAuthGuard` + `RolesGuard` (`SUPER_ADMIN`).
  - *Body*: `multipart/form-data` with `file` (JPEG/PNG/WebP/GIF, max 5 MB).
  - *Response*: `{ "url": "/uploads/promo-banner.webp", "filename": "...", "size": 104857 }`.
- **`GET /admin/overview`**: Platform KPIs (gross revenue, active orders, online fleet, pending applicants).
- **`GET /admin/fleet`**: Real-time fleet radar feed with GPS coordinates, online states, and cash safety margins.
- **`GET /admin/orders`**
  - *Query*: `status` (optional), `page` (int, default 1), `limit` (int, default 10).
  - *Response*: Paginated orders `{ "items": [...], "total": 120, "page": 1, "limit": 10, "totalPages": 12 }`.
- **`POST /admin/orders/:id/force-assign`**: Body `{ "riderId": "uuid" }` (bypasses automated dispatch).
- **`POST /admin/orders/:id/cancel`**: Body `{ "reason": "Min 5 char audit reason" }` (reverses ledger and voids holds).
- **`GET /admin/riders`**: Fleet list (`approvalStatus=ALL | PENDING | APPROVED`, `isOnline=true|false`).
- **`PATCH /admin/riders/:id/approval`**: Body `{ "isApproved": boolean }`.
- **`PATCH /admin/riders/:id/cash-limit`**: Body `{ "maxCashLimit": 8000.0 }`.
- **`GET /admin/vendors`** / **`POST /admin/vendors`** / **`PATCH /admin/vendors/:id`**: Complete vendor CRUD.
- **`POST /admin/vendors/:id/staff`**: Body `{ "userId": "uuid", "scope": "PARTICULAR_OUTLET" | "ALL_OUTLETS_MASTER", "brandId?" }` — assigns outlet staff scope.
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
- **`GET /payments/callback/:gateway`**: Browser redirect return URL after payment attempt with query parameters `status` and `transactionId`.

### 2.7 Saved Addresses & Utilities (`/customers`, `/health`, `/geo`)
- **`GET /customers/addresses`** / **`POST /customers/addresses`** / **`PUT /customers/addresses/:id`** / **`DELETE /customers/addresses/:id`**: Customer delivery address book CRUD.
- **`PATCH /customers/addresses/:id/default`**: Sets default delivery address.
- **`GET /customers/profile`** / **`PATCH /customers/profile`**: Customer profile management.
- **`GET /health`**: Health check probe returning PostgreSQL and Redis connection status.
- **`GET /geo/reverse-geocode`**: Reverse geocoding (`lat`, `lng`) returning `{ displayName, addressLine, city }`, cached in Redis for 24 hours.
- **`GET /geo/geocode`**: Forward geocoding query string (`q`) returning array of `{ displayName, addressLine, latitude, longitude, city, postcode, country }` with regional Bangladesh biasing and 24-hour Redis caching.
