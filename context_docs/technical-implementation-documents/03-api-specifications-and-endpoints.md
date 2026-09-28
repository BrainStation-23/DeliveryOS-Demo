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
- **`POST /auth/phone-login`**
  - *Guard*: Public (Throttled: 3 req / 15 min).
  - *Body*: `{ "phone": "+8801700000000", "role": "CUSTOMER" }` (role: `CUSTOMER` | `RIDER` | `VENDOR_ADMIN`).
  - *Response*: `{ "referenceId": "otp-uuid" }`.
- **`POST /auth/verify-otp`**
  - *Guard*: Public.
  - *Body*: `{ "phone": "+8801700000000", "otp": "123456" }`.
  - *Response*: `{ "accessToken": "jwt...", "refreshToken": "jwt...", "user": { "id": "...", "phone": "...", "role": "..." } }`.
- **`GET /auth/me`**
  - *Guard*: `JwtAuthGuard`.
  - *Response*: Hydrated user session with permissions, scopes, and profile data.
- **`POST /auth/device-token`**
  - *Guard*: `JwtAuthGuard`.
  - *Body*: `{ "fcmToken": "fcm-string", "devicePlatform": "ANDROID" | "IOS" | "WEB" }`.

### 2.2 Customer Discovery, Cart & Checkout (`/vendors`, `/orders`, `/coupons`, `/banners`)
- **`GET /banners/active`**
  - *Guard*: Public.
  - *Response*: Array of `{ "id": "...", "title": "...", "imageUrl": "...", "linkType": "OUTLET" | "CATEGORY", "targetId": "..." }`.
- **`GET /vendors/nearby`**
  - *Guard*: Public.
  - *Query*: `lat` (float), `lng` (float), `vertical` (optional: `FOOD` | `GROCERY` | `SUPER_SHOP` | `PHARMACY`).
  - *Action*: Executes PostGIS `ST_DWithin` returning outlets where user is within `delivery_radius_km`.
- **`GET /vendors/search`**
  - *Guard*: Public.
  - *Query*: `q` (string), `lat` (float), `lng` (float).
  - *Response*: Matched vendors and dishes available in range.
- **`GET /vendors/:id/catalog`**
  - *Guard*: Public.
  - *Response*: Outlet categories and active products with `isInStock = true`.
- **`POST /vendors/validate-address-coverage`**
  - *Guard*: `JwtAuthGuard` (`CUSTOMER`).
  - *Body*: `{ "vendorId": "uuid", "addressId": "uuid" }`.
  - *Response*: `{ "isWithinCoverage": true, "distanceKm": 2.4, "deliveryFee": 50.0 }`.
- **`POST /coupons/validate`**
  - *Guard*: `JwtAuthGuard` (`CUSTOMER`).
  - *Body*: `{ "code": "PILOT50", "cartSubtotal": 500.0, "vendorId": "uuid" }`.
  - *Response*: `{ "isValid": true, "discountAmount": 50.0, "discountType": "FLAT" }`.
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
  - *Guard*: `JwtAuthGuard` (`CUSTOMER`).
  - *Body*: `{ "previousOrderId": "uuid" }`.
  - *Response*: `{ "isStoreOpen": true, "unavailableItemIds": [], "updatedItems": [...] }`.
- **`GET /orders/history`**
  - *Guard*: `JwtAuthGuard` (`CUSTOMER`).
  - *Response*: Chronological list of user's past order receipts.
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

### 2.4 Rider Fleet Operations Module (`/riders`, `/orders`)
- **`GET /riders/profile`**: Returns courier status, vehicle, cash in hand, and max safety limit.
- **`PATCH /riders/duty`**
  - *Body*: `{ "isOnline": boolean, "latitude": 23.7808, "longitude": 90.4190 }`.
  - *Invariant*: Returns `400 Bad Request` if attempting to go offline with an active delivery.
- **`POST /riders/orders/:id/claim`**
  - *Action*: Acquires atomic Redis mutex `SET lock:order_claim:${id} ${riderId} NX EX 10`.
  - *Success*: Assigns courier, updates status (`RIDER_ASSIGNED`), and alerts kitchen.
- **`POST /orders/:id/pickup`**: Confirms parcel pickup at store; transitions order to `DISPATCHED`.
- **`POST /orders/:id/deliver`**
  - *Body*: `{ "codCashCollected": boolean, "amountCollected": 500.0 }`.
  - *Action*: Validates COD cash receipt, transitions order to `DELIVERED`, and updates ledgers.
- **`POST /orders/:id/issue`**
  - *Body*: `{ "reason": "Customer unreachable at doorstep after 5 min wait" }`.
  - *Action*: Unlocks courier, reports doorstep failure, and alerts Dispatch HQ.
- **`GET /riders/trips?timeframe=TODAY`**: Returns completed deliveries, payout earnings, and collected cash.
- **`POST /riders/deposit-cash`**: Body `{ "amount": 2500.0, "referenceNo": "DEP-104", "note": "Banani Hub" }`.

### 2.5 Super Admin Master Governance Module (`/admin`)
- **`GET /admin/overview`**: Platform KPIs (gross revenue, active orders, online fleet, pending applicants).
- **`GET /admin/orders`**: Paginated orders monitor filterable by status, outlet, date range, or `orderNumber`.
- **`POST /admin/orders/:id/force-assign`**: Body `{ "riderId": "uuid" }` (bypasses automated dispatch).
- **`POST /admin/orders/:id/cancel`**: Body `{ "reason": "Min 5 char audit reason" }` (reverses ledger and voids holds).
- **`GET /admin/riders`**: Fleet list and radar feed (`approvalStatus=ALL | PENDING | APPROVED`).
- **`PATCH /admin/riders/:id/approval`**: Body `{ "isApproved": boolean }`.
- **`PATCH /admin/riders/:id/cash-limit`**: Body `{ "maxCashLimit": 8000.0 }`.
- **`GET /admin/vendors`** / **`POST /admin/vendors`** / **`PATCH /admin/vendors/:id`**: Complete vendor CRUD.
- **`GET /admin/banners`** / **`POST /admin/banners`** / **`PATCH /admin/banners/:id`** / **`DELETE /admin/banners/:id`**: Banner CRUD.
- **`GET /admin/coupons`** / **`POST /admin/coupons`** / **`PATCH /admin/coupons/:id`** / **`DELETE /admin/coupons/:id`**: Coupon CRUD.
- **`GET /admin/settings`**: Returns current FSM mode and delivery fee pricing mode.
- **`PATCH /admin/settings/order-flow`**: Body `{ "mode": "RIDER_FIRST" | "VENDOR_FIRST" }`.
- **`PATCH /admin/settings/delivery-fee`**: Body `{ "mode": "FIXED_FLAT" | "DISTANCE_TIERED", "flatRate": 50.0, ... }`.
- **`GET /admin/finance/settlement-export?format=csv`**: Downloads RFC 4180 CSV settlement file.
- **`POST /admin/finance/settlement-cycle`**: Triggers batch settlement cycle for pending orders.
- **`PATCH /admin/finance/cash-deposits/:id/verify`**: Body `{ "status": "APPROVED" | "REJECTED" }`.

### 2.6 Payments Module (`/payments`)
- **`POST /payments/initiate`**: Body `{ "orderId": "uuid", "gateway": "BKASH" | "MOYASAR" | "STRIPE" }`. Returns redirect URL.
- **`POST /payments/webhook/:gateway`**: Public HMAC verified webhook endpoint. Idempotently marks payment `PAID`.
- **`GET /payments/status/:transactionId`**: Checks status of transaction session.

### 2.7 Saved Addresses & Utilities (`/addresses`, `/health`, `/geo`)
- **`GET /addresses`** / **`POST /addresses`** / **`PUT /addresses/:id`** / **`DELETE /addresses/:id`**: Full address book CRUD.
- **`PATCH /addresses/:id/default`**: Sets default address.
- **`GET /health`**: Health check probe returning PostgreSQL and Redis connection status.
- **`GET /geo/reverse-geocode?lat=...&lng=...`**: Reverse geocoding cached in Redis for 24 hours.
