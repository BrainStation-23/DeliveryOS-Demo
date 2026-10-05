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

#### Changed
- **Fresh Production Launch Posture Alignment**:
  - Removed all legacy compatibility shims, dead aliases, and fallback pathways across backend, portals, mobile apps, and scripts for a clean-slate fresh production launch.
  - Purged deprecated `vertical` query parameter from `GetNearbyVendorsDto` in favor of dynamic `typeSlug` (`OutletType`).
  - Purged legacy `type` snapshot key on `OrderAddressSnapshot` across backend checkout, dispatch, and vendor staff modules in favor of canonical `deliveryMethod`.
  - Removed SharedPreferences token migration logic in Customer and Rider Flutter mobile apps; tokens persist directly to Keystore/Keychain via `FlutterSecureStorage`.
  - Renamed integration test commands in `package.json` (`track1:test` -> `business-integrity:test`, `track3:test` -> `vendor-kds-resilience:test`) and purged all legacy command aliases.
  - Synchronized full living documentation suite (`QUICK_REFERENCE.md`, `TID-01` through `TID-07`, `BRD-00` through `BRD-07`, `README.md`, `deploy/RELEASE.md`) with authoritative codebase state.

### [1.8.0] - 2026-10-05 — Production Readiness Audit & Enterprise Hardening

#### Added
- **Realtime WebSocket Matrix Verifier (`scripts/verify-realtime-matrix.mjs`)**: Automated CI audit verifying 100% bi-directional contract parity across all 11 Server-to-Client events and 3 Client-to-Server ingress events with zero dead/orphaned events.
- **Unified Test Harness (`services/backend_api/scripts/harness.ts`)**: Standardized `login()`, `requestJson()`, `withApp()` lifecycle manager, and fixture constants (`TEST_PHONES`, `TEST_OTP`) across integration suites.
- **Modular Admin Portal Components (`DetailMetricCard`, `CollapsibleSection`)**: Reusable UI primitives replacing duplicated markup across `RiderDetailsDrawer` and `CustomerDetailsDrawer`.
- **Production Release & Deployment Runbook (`deploy/RELEASE.md`)**: Comprehensive production release checklist, zero-downtime rolling restart commands, migration policy, and emergency rollback procedures.
- **Architectural Decision Records (`ADR-020` to `ADR-022`)**:
  - `ADR-020`: Refresh Token Rotation, Reuse Detection & Mobile Revocation Posture.
  - `ADR-021`: Nginx Edge Dynamic DNS Resolution & Reverse Proxy Invariants.
  - `ADR-022`: Financial Ledger Foreign Key Immutability and Soft-Deletion Policy.
- **Central Media Library (`ADR-016`)**: Governed asset registry (`media_assets`), browser-side crop/resize editor (`react-image-crop`), and shared search/picker modal.
- **Date-Ranged Analytics Dashboard & Unified Financial Ledger (`ADR-018`)**: Overview KPI cards with trend deltas, timeseries charts, top performers, per-order ledger joining commission and courier earnings, and RFC 4180 CSV export.
- **Admin-Managed Outlet Types (`ADR-019`)**: Dynamic business classifications (`outlet_types`) with central visibility soft-toggle and mobile discovery integration.
- **Absolute Variation Pricing & Brand Governance (`ADR-017`)**: Ordered product variations where the primary variation establishes base price, and mandatory brand hierarchy.

#### Fixed & Hardened
- **Security & Authorization**:
  - Hardened refresh token rotation with single-flight mutex and token family reuse revocation in Redis (`blacklist:refresh:<jti>`).
  - Mobile session expiration interceptor navigating directly to phone login on unrecoverable 401 refresh responses.
  - Enforced strict class-validator DTO validation across all admin and vendor mutations; masked merchant commission rates from public discovery.
  - Escaped courier/store string injection in `LiveFleetMap` DOM popups.
- **Financial & Dispatch Correctness**:
  - Enforced single-execution concurrency semantics on cash deposit verification and delivery completion.
  - Protected COD collections: marked `PAID` only when collected cash is greater than zero.
  - Clamped coupon discounts to non-negative net order totals with nullish coalescing on maximum discount caps.
  - Isolated post-commit dispatch broker errors from HTTP checkout responses; enforced address coverage geofencing.
  - Verified SSLCommerz webhooks via server-to-server Order Validation with fail-closed tamper guards and per-order refund mutexes.
- **Realtime & Drift Elimination**:
  - Synchronized `order:payment:verified` in Customer App tracking screen.
  - Handled `order:delivery_failed` in Admin Fleet and Orders screens with alert banner.
  - Broadcasted `dispatch:broadcast` to `admin_hq` room for live admin radar reflection.
  - Dynamic Docker DNS resolution (`resolver 127.0.0.11 valid=10s ipv6=off;`) in Nginx proxy templates to eliminate 502 Bad Gateway errors on container recreation.
- **Mobile & Frontend Reliability**:
  - Replaced legacy Tailwind class names with Tailwind v3 standards across both portals; fixed React Rules of Hooks violations.
  - Handled Web Audio chime cleanup on component unmount and logout in Vendor KDS.
  - Throttled mobile GPS location emission interval to prevent network flooding; removed synthetic coordinate fallbacks.
  - Reordered customer cart items with current catalog prices rather than historical order prices.
  - Virtualized list rendering on customer order history and rider earnings screens for smooth 60fps scrolling.
- **Test Integrity & Anti-Bypass Guard**:
  - Test-integrity guard script (`scripts/check-test-integrity.mjs`) enforcing zero skip/only markers, tautological assertions, and strict per-tier count floors.
  - 100% test passing floor across all tiers (329 backend unit, 204 portal unit, 142 mobile tests, 19 live integration suites).

### [1.7.2] - 2026-09-29

#### Added
- Canonical camelCase `DeliveryFeeConfig` (`mode`, `flatFee`, `baseFee`, `baseKm`, `perKmRate`) unified across NestJS, Prisma seeds, and the Admin Console, with dedicated Jest test suite (24/24 passing).

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
- Env-gated Sentry across all five artifacts; `{items,total,page,limit,totalPages}` pagination; admin error UX (`onError` alerts, error banners, Modal kit); media storage.

#### Changed
- Operating-hours checks use region wall clock (`Asia/Dhaka`/`Asia/Riyadh` via `REGION_MODE`); atomic coupon claims (`UPDATE … WHERE currentUses < usageLimit`); radar GPS patching (5s throttle); route-level code splitting; `cached_network_image` in Flutter.

### [1.5.0] - 2026-09-28

#### Added
- Auth lifecycle: rotating refresh tokens with Redis jti revocation, logout, OTP lockout (5 fails, 2-min TTL) ([ADR-013](context_docs/architecture-decision-records/ADR-013-real-world-integration-stack.md)).
- Real integrations: SSL Wireless SMS; SSLCommerz Session/Validation/Refund APIs with fail-closed webhook verification and refund persistence; FCM multicast push; rider background GPS service.

#### Changed
- Flutter tokens in `flutter_secure_storage` (Android Keystore / iOS Keychain); portal 401 single-flight refresh-and-replay; payment WebView flow via `PAYMENT_GATEWAY` dart-define; all build config via `--dart-define` (no localhost in releases).

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
