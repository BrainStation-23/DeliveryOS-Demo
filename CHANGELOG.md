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
- **Server-Computed Rider Economics in Dispatch & Claim**: `dispatch:broadcast` now carries `riderEarnings` and haversine `distanceKm`; `POST /rider/orders/:id/claim` returns server-computed `riderEarnings`; `GET /rider/trips` includes real per-trip `distanceKm`; the rider app reconciles post-delivery earnings/COD from the `tripLedger` in the deliver response (never gross `deliveryFee` or client-side math).

#### Fixed
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
