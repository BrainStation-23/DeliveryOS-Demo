# DeliveryOS — Changelog & Engineering Roadmap

Release history follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + [Semantic Versioning](https://semver.org/).
Capability detail: [`FEATURES.md`](FEATURES.md) • Architectural rationale: [ADR Index](context_docs/architecture-decision-records/README.md) • Per-change detail: git history.

---

## 🗺️ Engineering Roadmap Status

**Lifecycle**: Foundation ➔ Core Backend ➔ Realtime & Dispatch ➔ Web Portals & Mobile Apps ➔ E2E Testing ➔ Production Hardening (Waves 0–4) ➔ Pilot Launch.

| Milestone | Delivered | Status |
| :--- | :--- | :---: |
| **Phases 1–3 — Foundation, Core Backend, Realtime & Dispatch** | Monorepo + Docker stack (PostGIS 16 `:5433`, Redis 7.2 `:6380`), 22-model Prisma schema with spatial GIST indexes, phone-OTP auth, ACID checkout, Socket.IO `/events` gateway, dual-flow FSM dispatch with Redis claim mutex | ✅ |
| **Phases 4–6 — Admin Portal, Vendor KDS, Customer & Rider Apps** | React consoles: Leaflet fleet radar, 3-lane KDS with Web Audio chime, stock toggles. Flutter apps: geofenced discovery & cart, 6-stage tracking, 45s dispatch alerts, 3-step fulfillment, COD deposits | ✅ |
| **Phase 7 — E2E & Financial Integrity** | Multi-role lifecycle suites; double-entry ledgers balance to the penny | ✅ |
| **Hardening Tracks 1–7** | Centralized FSM guard, GPS telemetry + tiered escalation, payments & settlements, cancellation/refund rollbacks, store-hours & COD integrity, centralized design system, spec-driven living docs | ✅ |
| **Production Waves 0–4 (v1.4.6 → v1.7.0)** | CI `verify` gate + strict TypeScript, fail-fast security & hardened deploy, real integrations (SMS, SSLCommerz, FCM, token rotation), money-path unit tests + Sentry, scaling & data safety | ✅ |

**Active Horizons**
- [ ] Execute the 1-month live pilot (10 vendors, 5–8 couriers, 3–5 km zone); monitor zero-food-waste SLA and weekly payouts.
- [ ] Provision the production VPS, bind domains, enable Let's Encrypt auto-renewal (runbook: [`deploy/README.md`](deploy/README.md)).
- [ ] KSA region localization (`REGION_MODE=KSA`) — deferred post-launch; Bangladesh is the launch market.

---

## 📜 Release History

### [Unreleased]

#### Added
- **Hardened Test & Verification System (Anti-Bypass Gate)**:
  - **New backend unit specs (86 tests)**: `auth.service.spec.ts` (OTP rate limit, brute-force lockout, static-OTP mock gating, signup role whitelisting, account-status blocks, refresh-token rotation/revocation, logout idempotency), `jwt-auth.guard.spec.ts` (refresh-as-access rejection, inactive users, cache seeding/corruption fallback), `roles.guard.spec.ts` (SUPER_ADMIN bypass, deny 403), `haversine.spec.ts`, `currency.util.spec.ts` (floating-point half-cent traps).
  - **Strengthened money-path specs**: dispatch routing for `handleOrderPlaced`/`handleOrderReady` (unpaid ONLINE_GATEWAY withholding, TAKEAWAY kitchen-only bypass, RIDER_FIRST broadcast with server-computed rider earnings vs VENDOR_FIRST chime), two-tier dispatch escalation idempotency, nearby-rider filtering, `initiatePayment` validation guards, `getPaymentStatus` ownership enforcement, expired-payment claim-then-reconcile sweep (coupon rollback, ledger cleanup, lost-claim skip), coupon percentage caps/flat-cap-at-subtotal/rounding, and delivery-fee DB-failure fallbacks.
  - **Portal unit test suites (Vitest)**: admin (22 tests: formatters, API error extraction, class merge, auth store login/logout persistence) and vendor (24 tests: formatters, error extraction, class merge, outlet-store resolution rules) — portals previously had zero hermetic unit tests; wired into `verify:web`.
  - **Test-integrity guard** (`scripts/check-test-integrity.mjs`, `npm run verify:tests`, first step of `npm run verify`): fails CI on missing/trivial required specs, skip/only/todo markers in Jest/Vitest/Dart files, tautological assertions, or per-area test-count floor regressions.
  - **Per-file coverage floors** in `services/backend_api/jest.config.mjs` (global raised 40→85% statements; money-path modules 85–100%) and ESLint `no-restricted-syntax` ban on `.skip`/`.only`/`.todo`/`xit` markers in TS specs.
  - **Testing standards codified**: `AGENT_RULES.md` §3.9 (naming, placement, mandatory coverage, forbidden bypasses), ADR-014 expanded, `AGENTS.md` invariants matrix gains the **Test Integrity** row.

#### Changed
- **Flutter test files renamed to behavior-based conventions**: `task_5_2_test.dart` → `discovery_catalog_test.dart`, `task_5_3_test.dart` → `cart_checkout_test.dart`, `task_5_4_test.dart` → `order_tracking_test.dart`, `app_test.dart` → `localization_auth_home_test.dart`, `phase_1_payment_cart_test.dart` → `payment_cart_preservation_test.dart` (customer); `task_6_1_test.dart` → `auth_duty_dashboard_test.dart`, `task_6_2_test.dart` → `trip_lifecycle_test.dart`, `task_6_3_test.dart` → `earnings_safety_test.dart` (rider); work-package group labels ("Task 5.x") replaced with behavior descriptions; rider `widget_test.dart` smoke suite strengthened with an overflow-safety assertion.
- **Server-Computed Rider Economics in Dispatch & Claim**: `dispatch:broadcast` now carries `riderEarnings` and haversine `distanceKm`; `POST /rider/orders/:id/claim` returns server-computed `riderEarnings`; `GET /rider/trips` includes real per-trip `distanceKm`; the rider app reconciles post-delivery earnings/COD from the `tripLedger` in the deliver response (never gross `deliveryFee` or client-side math).

#### Fixed
- **Integration suites now self-load the repo `.env`**: the 8 standalone suites that construct `PrismaClient` at module scope (`payment:test`, `db:test`, `vendor:test`, `address:test`, `settlement:test`, `cancel:test`, `track1:test`, `track3:test`) failed locally with `Environment variable not found: DATABASE_URL` unless env vars were manually exported; they now resolve `../../.env`/`.env` in the same order as `AppModule`'s ConfigModule (CI was unaffected — it sets env vars explicitly).
- **Integration suites exit 0 after passing**: the 11 app-bootstrapping suites crashed with a floating `Connection is closed` rejection from the socket.io redis-adapter during `app.close()` teardown, turning green suites into red runs; a scoped `unhandledRejection`/`uncaughtException` guard now covers only the shutdown window so assertion failures still fail loudly.
- **Phase 4: Living Documentation Sync, CI Gates & Release Hygiene**:
  - **CI Blocking Merge Gate (`3B-P1`)**: Updated `.github/workflows/ci.yml` `integration` job setting `continue-on-error: false`, making live-stack multi-role integration suites a strict merge blocker.
  - **Technical Implementation Document Alignment (`DOC-01, TID-03`)**: Synchronized `03-api-specifications-and-endpoints.md` with actual server responses for `POST /auth/otp/request` (`retryAfterSeconds`), `POST /vendors/validate-address-coverage` (`estimatedDeliveryFee`, `deliveryRadiusKm`), `POST /coupons/validate` (public throttle), `POST /orders/validate-reorder` (`isStoreOperational`, `validItems`, `unavailableItems`), added `GET /rider/active-trip`, and documented Geolocation endpoints (`GET /geo/reverse-geocode`, `GET /geo/geocode`).
  - **Feature Catalog & Verification Matrix Alignment (`FEATURES.md`)**: Aligned courier pickup and delivery actions with `PATCH /rider/orders/:id/pickup` and `PATCH /rider/orders/:id/deliver`; updated unit test pyramid commands to `npm run test:unit` (71 tests across 11 suites) and `npm run vendor-rider:test`.
  - **Payment Architecture Documentation Sync (`ADR-011`)**: Clarified deprecation of standalone direct bKash adapter in favor of the multi-channel `SslCommerzGateway` aggregator handling bKash, Nagad, cards, and internet banking with SHA-256 IPN verification.
  - **Master Remediation Plan DoD Verification**: Verified all 8 Definition of Done requirements across money path, security, mobile stability, dispatch operations, and data contracts.
- **Phase 3: Cross-Platform Data Contracts, Deserialization & UI Alignment (P2)**:
  - **Universal Tolerant Numeric Parsers (`S1, B4, B5`)**: Created `numeric_parser.dart` in both `apps/customer_app` and `apps/rider_app` exporting `parseDouble` and `parseInt`, preventing runtime `TypeError` crashes on Prisma `Decimal` string serialization, raw numbers, empty strings, and null values.
  - **Customer Order History Field Name Alignment (`DAT-01, S7`)**: In `order_history_model.dart`, mapped `OrderItemSummary.name` from `productNameSnapshot`, parsed quantity/price tolerantly, unpacked variant name from JSON map snapshot, and updated `PastOrder` and `ReorderValidationResult` to match backend payload contracts.
  - **Product Variant Price Modifier Contract Alignment (`S7`)**: In `store_catalog_model.dart`, mapped `price` via `json['priceModifier'] ?? json['price_modifier'] ?? json['price']`.
  - **Addon Group Field Alignment (`S7`)**: In `store_catalog_model.dart`, mapped `name` from `title ?? name`, `minSelections` from `minSelection ?? minSelections`, and `maxSelections` from `maxSelection ?? maxSelections`.
  - **Promotional Banner Deep-Link Property Alignment (`S7`)**: In `banner_model.dart`, mapped `actionType` from `linkType ?? actionType`, `actionValue` from `targetId ?? actionValue`, and routed both `'OUTLET'` and `'VENDOR'` banner actions to `OutletDetailScreen`.
  - **Store Phone & Dynamic Checkout Delivery Fee (`DAT-02, S6`)**: In `tracking_provider.dart`, mapped `contactPhone` with phone fallback and parsed coordinates/amounts tolerantly; updated `CartState` to store dynamic `estimatedDeliveryFee` and `couponMinSpend`; updated `cart_provider.dart` to adopt `estimatedDeliveryFee` from coverage validation and validate coupon minimum spends dynamically; updated `coupon.service.ts` to return `minOrderAmount`.
  - **Courier Trip Model Deserializer Alignment (`DAT-03`)**: In `trip_models.dart` and `trip_provider.dart`, aligned `TripStoreMeta` with `addressText` and `contactPhone`, mapped customer phone from `customerPhoneSnapshot`, tolerantly parsed all decimal and count attributes, and dynamically derived `TripStep` from order status.
  - **Admin Vendor Edit Delivery Radius Overwrite Prevention (`3C-P1`)**: In `admin.service.ts`, added `deliveryRadiusKm`, `latitude`, and `longitude` to the mapped `getAllVendors` return object, preventing vendor edits in Admin Portal from defaulting and overwriting custom delivery radii to 5 km.
  - **Customer Address Book Dynamic Geocoding (`3E-P1`)**: In `address_book_screen.dart`, added a "Pick Location on Map" action opening `MapLocationPickerScreen` and wired dynamic forward geocoding via `LocationNotifier.forwardGeocode` and backend `GET /geo/geocode` (backed by OpenStreetMap and 24-hour Redis caching), replacing static coordinate dictionaries and ensuring saved addresses reflect genuine delivery locations rather than device GPS coordinates.
  - **Checkout `setState` After Dispose Guard (`3E-P2`)**: In `cart_screen.dart`, positioned `if (!mounted) return;` before `setState(() => _isSubmitting = false);`, preventing unhandled framework exceptions when navigating away during checkout.
  - **Tracking Screen Online Gateway Refund Banner Display (`3E-P1, S7`)**: In `order_tracking_screen.dart`, updated refund condition to check `trackingState.paymentMethod == 'ONLINE_GATEWAY' || trackingState.paymentMethod == 'ONLINE'`.
  - **Vendor Portal Dynamic Platform Fee Label (`3D-P3`)**: In `VendorOrdersPage.tsx` and `SalesLedgerKPIs.tsx`, replaced static 15% header with dynamic `Platform Fee` displaying per-order effective commission rates.
- **Phase 2: Operational Dispatch, State Machine & Realtime Integrity (P1)**:
  - **Dead-End `DISPATCHED` Order Recovery on Delivery Issue (`OPS-02, 3A-P1`)**: Permitted `DISPATCHED → READY_FOR_PICKUP` in `order-state.machine.ts`; `reportDeliveryIssue` reverts order status to `READY_FOR_PICKUP`, sets `riderId: null`, logs rejection audit details, releases Redis active trip lock, broadcasts realtime socket events to customer/vendor and `admin_hq`, and re-triggers `orderFlowService.handleOrderReady` to alert `riders_pool`.
  - **Courier In-Flight Active Trip Rehydration (`OPS-04, 3F-P1`)**: Added `GET /rider/active-trip` in backend retrieving in-flight orders (`RIDER_ASSIGNED`, `ACCEPTED`, `PREPARING`, `READY_FOR_PICKUP`, `DISPATCHED`); implemented `rehydrateActiveTrip()` in `trip_provider.dart` with defensive parsing and `ref.mounted` lifecycle guards, restoring active orders upon app startup or crash restart.
  - **FSM Alignment for Courier Pickup in `RIDER_FIRST` Mode (`B8`)**: Updated `order-state.machine.ts` to allow `RIDER_ASSIGNED → [PREPARING, READY_FOR_PICKUP, DISPATCHED, CANCELLED]`; updated `PickupStepCard` and `confirmPickup` to display clear kitchen preparation status and gate pickup confirmations while kitchen status is actively `PREPARING`.
  - **Courier Telemetry DTO Whitelisting (`B9`)**: Added optional `latitude`, `longitude`, and `speed` fields to `ToggleDutyDto` in `toggle-duty.dto.ts`; updated `toggleDuty` to persist courier GPS coordinates in PostgreSQL and Redis geospatial index `riders:locations` during 30s background beacons.
  - **Realtime Admin Force-Assign Courier Notification (`OPS-03`)**: Injected `NotificationsService` into `AdminService`; `forceAssignRider` now emits realtime socket event `order:assigned` to target courier rooms and dispatches high-priority FCM push notification.
  - **Takeaway Dispatch Exclusion Filter (`3A-P1`)**: Updated `handleOrderPlaced`, `handleOrderReady`, and `evaluateDispatchEscalations` to verify `deliveryAddressSnapshot.deliveryMethod === 'TAKEAWAY'`; takeaway orders notify kitchen immediately, bypass courier dispatch, and are excluded from unassigned dispatch escalations.
  - **Admin Fleet Radar Per-Rider Throttling (`OPS-05`)**: Replaced global scalar throttle timestamp in `AdminDispatchPage.tsx` with a per-courier timestamp map (`lastLocationPatchMapRef`), preventing fast movement by one courier from discarding position updates of all other fleet couriers.
  - **Admin Live Orders Backend Search Query Wiring (`OPS-06, 3C-P2`)**: Added optional `search` query parameter to `GetLiveOrdersQueryDto`; updated `admin.service.ts` to query `orderNumber`, customer phone, and customer name across all paginated rows; updated TanStack query keys and debounced search input in `AdminOrdersPage.tsx`.
  - **Vendor KDS Realtime `order:new` Event Normalization (`S4, 3D-P1`)**: Updated `kdsApi.ts` `normalizeKDSOrder` to handle both `id` and `orderId` payload shapes; ensured backend `notifyNewOrder` delivers dual `id` and `orderId` attributes.
  - **Customer Tracking Socket Room Leak & Reconnect Lifecycle (`S4, 3E-P1`)**: Registered persistent socket listeners in `SocketService` to re-bind handlers and re-join active order rooms upon reconnect; migrated `trackingProvider` to `autoDispose.family` with explicit listener unbinding and `ref.mounted` guards.
  - **Courier Socket Reconnect Listener Re-Binding (`S4, 3F-P1`)**: Added persistent listener registry and automatic order room re-join upon reconnect in `apps/rider_app/lib/core/network/socket_service.dart`.
- **Phase 1: Critical Money Path & Security Hardening (P0)**:
  - **Double Refund Elimination & State Claims (`B1, B2`)**: Refactored `performCancellation` to claim order cancellation in PostgreSQL transaction first (restricted to legal statuses `[PLACED, RIDER_ASSIGNED, ACCEPTED, PREPARING, READY_FOR_PICKUP]`) before calling gateway refund; updated `refundForOrder` to persist `status: PaymentStatus.REFUNDED` and return idempotently on repeated invocations without firing duplicate gateway refunds.
  - **Payment Initiation Mutex & Webhook Determinism (`B3`)**: Serialized `initiatePayment` using Redis mutex `lock:payment:order:${orderId}` (10s TTL) with session reuse within 15 minutes; made `handleWebhook` lookup match unique `transactionId` strictly first before falling back to ordered `orderId` queries.
  - **Customer Reorder IDOR Closure (`SEC-01`)**: Added customer ownership check in `validateReorder` (`previousOrder.customerId !== customerId`), rejecting cross-tenant enumeration of cart items and pricing.
  - **Order Scoping & Tracking BOLA Authorization (`SEC-02`)**: Enforced multi-tenant RBAC scoping in `getOrderById` and `getLiveTracking` across customers, assigned couriers, vendor staff, and super admins; scrubbed internal commission ledgers from customer reads.
  - **Vendor Staff Live Orders Scope Leakage Guard (`SEC-03`)**: Implemented safe fail-close in `getLiveOrders` returning `[]` when non-super-admin staff have zero resolved outlet assignments.
  - **Staff Assignment Idempotency & Redis Session Cache Eviction (`SEC-04`)**: Added idempotent check-and-update in `assignVendorStaff` preventing `P2002` unique constraint crashes and immediately evicting `auth:user:${user.id}` in Redis.
  - **Customer App Payment Status Polling Authentication (`OPS-01, B7`)**: Converted `PaymentWebViewScreen` to `ConsumerStatefulWidget` using authenticated `dioClientProvider` with bearer token, resolving infinite 401 polling loops.
  - **Cart Checkout Payment Method Preservation (`B6`)**: Preserved `state.paymentMethod.apiKey` before calling `clearCart()` in `cart_provider.dart`, restoring launch of the online gateway webview.
  - **Environment Boot & Reverse Proxy Trust Hardening (`B10, B11, B12`)**: Required explicit `NODE_ENV`, added `.env.example` secrets to production blocklist (`deliveryos-refresh-secret-key-32chars-dev`), disallowed identical access/refresh secrets, and configured `app.set('trust proxy', 1)` in `main.ts` for reverse proxy IP extraction.
- **Financial Race Conditions (claim-then-reconcile pattern)**: payment-expiry sweep cancels only via guarded `updateMany` (`PLACED`+`PENDING`, coupon decrement never below zero); settlement cycle claims ledgers `PENDING → PROCESSING` before batching (concurrent cycles abort); cash-deposit approval claims `PENDING_APPROVAL` and refuses to drive `cashInHand` negative; order cancellation is Redis-mutex serialized with a guarded non-terminal claim (no double gateway refunds); `switchToCOD` flips conditionally (`ONLINE_GATEWAY`+unpaid only); `acceptOrder` and `deliverOrder` use guarded status claims (double-submit cannot double-credit `cashInHand`); `amountCollected` is capped at the order total with `codCashCollected` as the single source of truth for `paymentStatus`.
- **Stranded-Charge Reconciliation**: a gateway confirmation landing after `switchToCOD` failed the session (or after cancellation) is now recorded and auto-refunded via `refundForOrder` with customer notification — previously a real charge could be silently dropped as "already processed".
- **Webhook Amount Verification**: gateway-reported amounts must match the initiated `payment.amount` (±0.01) or the transaction is rejected for manual review, never marked PAID.
- **Payment Status Endpoint Authorization**: `GET /payments/status/:transactionId` is owner-only and redacted (`sessionKey` and raw `gatewayResponse` no longer leak to any authenticated user).
- **Self-Service Privilege-Escalation Closure**: OTP signup accepts only `CUSTOMER`/`RIDER`; `VENDOR_ADMIN`/`SUPER_ADMIN` roles can no longer be self-selected, with a whitelist clamp at user creation. OTP generation now uses `crypto.randomInt`.
- **Admin API Input Validation**: all admin mutations (cash limits, force-assign, banner/coupon/vendor/staff/category/product/fee-mode/approval governance) now use class-validator DTOs with whitelist + forbidNonWhitelisted; image uploads enforce 5 MB multer limits + mimetype allowlist + magic-byte sniffing; invalid `status` query params no longer 500; internal (non-HTTP) error messages are no longer leaked to clients.
- **Courier Realtime Cancellation Sync**: Emit `order:cancelled` to both `user_{riderUserId}` and `rider_{riderIdToRelease}` rooms upon order cancellation, preventing couriers from driving to vendors for cancelled deliveries.
- **Prepaid vs COD Courier Dispatch**: Include `paymentMethod` and `isCod` in dispatch broadcast payloads; ensure `rider_app` reflects payment type accurately and `deliverOrder` only accumulates `rider.cashInHand` on `CASH_ON_DELIVERY` orders.
- **Late Webhook & Switched-to-COD Order Guard**: Invalidate pending payment sessions on switch to COD; reject late webhook confirmation for cancelled orders or orders switched to COD to prevent phantom dispatch broadcasts.
- **Courier Order Claim Financial Safety**: Enforce courier admin approval, active user status, maximum cash-in-hand limit checks during COD claims, and reject claims of unverified `ONLINE_GATEWAY` orders; shift Redis busy-state mutation to post-database-transaction commit.
- **Delivery Fee In-Memory Cache Invalidation**: Invalidate delivery fee and economics cache immediately when admin modifies pricing mode or rates via `updateDeliveryFeeMode()`.
- **Rider App Telemetry Lifecycle**: background location service now actually stops on duty-off/logout (registered `stop` handler cancels the 15s GPS timer and stops the foreground service); logout tears down beaconing; `POST_NOTIFICATIONS` permission declared for Android 13+; FCM gains a background handler, foreground dispatch surfacing, and tap routing to the dashboard; dev-only `forceApproveForDev` is `kDebugMode`-gated at the method.
- **Customer App Session Resilience**: refresh token is persisted at OTP verification (the 401 rotation path was dead code); lifecycle observer re-initializes the socket after backgrounding; `sendOtp` no longer fakes success on network errors; Google Maps release renders via manifest placeholder wired from `GOOGLE_MAPS_API_KEY` dart-define (minSdk pinned 23).
- **Vendor KDS Failure Surfacing & Optimism**: accept/reject/ready/handover are optimistic with snapshot rollback, `onError` banners + audible context on the board, and wrappers that never reject (no more silent unhandled failures on the kitchen tablet); vendor orders page adopts `QueryErrorBanner`.
- **Production Deploy Integrity**: prod compose forwards `SENTRY_DSN` (Sentry was guaranteed-off) and fail-fasts on sandbox `SSLCOMMERZ_BASE_URL`; nginx prod template adds 24h WebSocket proxy timeouts (60s idle drops); nginx reloads every 6h so renewed certificates load without manual SSH; certbot image pinned; local compose binds app ports to loopback; example JWT secrets are rejected by config validation; `SMS_SSLW_*` required when `SMS_PROVIDER=ssl_wireless`.

#### Changed
- **Documentation truth-sync audit**: full repo scan corrected FEATURES / QUICK_REFERENCE / AGENT_RULES / README / TIDs against code (backend module map, socket events, payment gateways, spatial storage model, test-suite names); ~40 broken or non-portable links repaired; accidental `--version/` husky artifact removed; root `package-lock.json` version aligned (1.7.2).
- **Documentation truth-sync round 2**: integration-suite commands corrected everywhere (`auth:test` style — FEATURES §8 now includes FCM/address/health rows), TID-03 regenerated missing routes (`GET /orders/:id`, `POST /cart/validate-address-coverage`, admin catalog governance, staff assignment, order-flow GET) and synced claim/deliver/payment-status contracts, TID-04 rooms/payloads/tiers corrected against the gateway (`user_` vs `rider_` rooms, `agingSeconds`, 90s/180s tiers, ack + connection events, engine.io-default heartbeat), QUICK_REFERENCE Redis key map completed (5 missing keys), env contract purged of dead vars (BD_/KSA_ presets, `SSLCOMMERZ_IS_LIVE`, `PAYMENT_GATEWAY`, `FIREBASE_PROJECT_ID` trio) and corrected to real reads, admin dev port corrected (Vite 5173 / Docker 3000), FEATURES storage-namespace names and rider/customer endpoint paths fixed, counts corrected (33 admin routes, 14 modules), ADR-009 commission sample aligned to percentage math, `deploy/README.md` duplicate heading removed.

### [1.7.2] - 2026-09-29

#### Added
- Canonical camelCase `DeliveryFeeConfig` (`mode`, `flatFee`, `baseFee`, `baseKm`, `perKmRate`) unified across NestJS, Prisma seeds, and the Admin Console, with `normalizeDeliveryFeeConfig` legacy-key support and a dedicated Jest suite (24/24 passing).

### [1.7.1] - 2026-09-29

#### Added
- Cross-platform reusable primitives: backend `roundMoney`; portal shared formatters + `useRushPause` / `useSocketQueryInvalidation` hooks + extracted order/assign/cancel modals; Flutter `QuantityStepper`, `TripDestinationCard`, decomposed cart and login screens.

#### Fixed
- Delivery-fee snake/camelCase mismatch (NaN fees); payment-expiry sweep now restores coupons, ledgers, and broadcasts; rider OTP debug-mode guard; customer profile reactive state.

### [1.7.0] - 2026-09-28

#### Added
- Mobile release engineering: `key.properties` release signing, ProGuard, branded launcher/splash icons, `scripts/build-android.sh` dart-define AABs ([ADR-015](context_docs/architecture-decision-records/ADR-015-horizontal-scaling-readiness.md)).
- Horizontal-scaling readiness: Socket.IO Redis adapter, leader-locked background sweeps, Redis-cached JWT guard lookups ([ADR-015](context_docs/architecture-decision-records/ADR-015-horizontal-scaling-readiness.md)).
- Data safety: env-gated offsite backups, confirmation-gated restore, systemd timer units.

#### Changed
- KSA region deferred (Bangladesh launches first); dev Postgres/Redis bound to 127.0.0.1; last credential-bearing Redis fallback removed.

### [1.6.0] - 2026-09-28

#### Added
- Money-path Jest unit tests inside the CI gate: FSM transitions, region-time operating hours, coupon eligibility, webhook idempotency ([ADR-014](context_docs/architecture-decision-records/ADR-014-unit-tests-and-error-monitoring.md)).
- Env-gated Sentry across all five artifacts; `{items,total,page,limit,totalPages}` pagination; admin error UX (`onError` alerts, error banners, Modal kit); `POST /admin/uploads` media storage.

#### Changed
- Operating-hours checks use region wall clock (`Asia/Dhaka`/`Asia/Riyadh` via `REGION_MODE`); atomic coupon claims (`UPDATE … WHERE currentUses < usageLimit`); radar GPS patching (5s throttle); route-level code splitting; `cached_network_image` in Flutter.

### [1.5.0] - 2026-09-28

#### Added
- Auth lifecycle: rotating refresh tokens with Redis jti revocation, logout, OTP lockout (5 fails, 2-min TTL) ([ADR-013](context_docs/architecture-decision-records/ADR-013-real-world-integration-stack.md)).
- Real integrations: SSL Wireless SMS; SSLCommerz Session/Validation/Refund APIs with fail-closed webhook verification and refund persistence; FCM multicast push; rider background GPS service.

#### Changed
- Flutter tokens in `flutter_secure_storage` with plaintext migration; portal 401 single-flight refresh-and-replay; payment WebView flow via `PAYMENT_GATEWAY` dart-define; all build config via `--dart-define` (no localhost in releases).

### [1.4.7] - 2026-09-28

#### Changed
- Fail-fast env contract: Joi requires `JWT_SECRET`/`JWT_REFRESH_SECRET` (≥32 chars), `DATABASE_URL`, `REDIS_URL`; mock SMS, static OTP, and sandbox gateway forbidden in production ([ADR-012](context_docs/architecture-decision-records/ADR-012-production-security-hardening-and-fail-fast-config.md)).
- Webhook fail-closed (bypass signatures removed); `order:join` room authorization; Helmet + CORS whitelist + throttling; Swagger gated to non-production; winston JSON logs with `x-request-id`; graceful shutdown.
- Production deploy boots end-to-end: envsubst TLS template + certbot renewal, `${VAR:?}` secrets, memory limits, non-root containers, `prisma migrate deploy` on start.

### [1.4.6] - 2026-09-26

#### Changed
- Engineering quality gate: root `npm run verify` + GitHub Actions CI, strict-mode TypeScript with ESLint `no-explicit-any: error`, Husky pre-commit, `/grill-me` plan-review command.
- Documentation truth sync (test-stack claims, claim-lock TTL, Riverpod version, seed credentials).

#### Fixed
- Master-scope operating-hours upsert using an unresolved `vendorId` (`vendor-staff.service.ts`).

### [1.4.5] - 2026-09-26
- Unified roadmap + changelog into this document; embedded the 3-phase workflow in README; removed `SPEC_DRIVEN_WORKFLOW.md` and `WORK_BREAKDOWN.md` (−40 KB doc overhead).

### [1.4.4] - 2026-09-26
- Established the spec-driven documentation system: 3-phase protocol, `FEATURES.md` capability catalog, `QUICK_REFERENCE.md` context router; streamlined BRD/TID suites.

### [1.4.3] - 2026-09-26
- Centralized design-system governance: Flutter tokens (`AppColors`/`AppTypography`/`AppSpacing`/`AppRadius`) + Tailwind semantic palettes; eliminated raw inline styling across all apps ([ADR-010](context_docs/architecture-decision-records/ADR-010-ai-driven-engineering-governance-and-no-auto-commits.md)).

### [1.4.2] - 2026-09-26
- Reusable web primitives (`PageHeader`, `StatCard`, `EmptyState`, `StockToggleSwitch`); admin modal/table/radar layout fixes; KDS tablet ergonomics (≥44px targets, snap-track).

### [1.4.1] - 2026-09-26
- Mobile responsive hardening (320px–430px clamps, RenderFlex overflow fixes); backend test-script time-zone resilience.

### [1.4.0] - 2026-09-25
- Admin governance: courier applicant queue, cash-limit adjustments, Leaflet OSM fleet radar, `?orderNumber=` deep linking, force-assign/force-cancel modals, RFC 4180 CSV settlement export + payout batches.

### [1.3.0] - 2026-09-25
- Vendor KDS: 3-lane Kanban, prep countdown timers, rejection reason codes, Web Audio chime loop ([ADR-007](context_docs/architecture-decision-records/ADR-007-web-audio-api-synthesized-kds-chime.md)), rush-hour pause, merchant catalog + stock toggles, sales ledger.

### [1.2.0] - 2026-09-24
- Rider app: background GPS telemetry, 45s dispatch alert with haptics, atomic claim mutex ([ADR-004](context_docs/architecture-decision-records/ADR-004-atomic-dispatch-claim-mutex.md)), 3-step fulfillment, doorstep 5-min SOP, remote cancellation handling, earnings + cash deposits.

### [1.1.0] - 2026-09-24
- Customer app: instant search with direct add + cart-conflict dialog, store closed/rush banners, switch-to-COD recovery, 6-stage tracking, re-order validation, address book.

### [1.0.0] - 2026-09-24
- Platform foundation: monorepo (NestJS backend, 2 Flutter apps, 2 React portals), Docker stack, PostGIS spatial engine ([ADR-003](context_docs/architecture-decision-records/ADR-003-postgis-spatial-engine-and-redis-geohash.md)), dual-flow FSM ([ADR-002](context_docs/architecture-decision-records/ADR-002-dynamic-dual-order-flow-fsm.md)), double-entry ledger ([ADR-009](context_docs/architecture-decision-records/ADR-009-deterministic-financial-accounting-ledger.md)), idempotent payment webhooks ([ADR-011](context_docs/architecture-decision-records/ADR-011-multi-gateway-online-payment-and-webhook-idempotency.md)), AI engineering governance ([ADR-010](context_docs/architecture-decision-records/ADR-010-ai-driven-engineering-governance-and-no-auto-commits.md)).
