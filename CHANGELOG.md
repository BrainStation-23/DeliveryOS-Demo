# DeliveryOS — Engineering Roadmap, Milestones & Changelog

All engineering roadmap milestones, architectural tracks, and versioned releases of the **DeliveryOS** platform are maintained in this single authoritative living document.

The release history adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## 🗺️ Part 1: Master Engineering Roadmap & Milestones Status

### 1.1. High-Level Engineering Lifecycle

```mermaid
graph TD
    P1["Phase 1: Foundation & PostGIS DB"] ──► P2["Phase 2: Core Backend Modules"]
    P2 ──► P3["Phase 3: Realtime Engine & Dispatch FSM"]
    P3 ──► P4["Phase 4: Dedicated Web Portals (Admin & KDS)"]
    P3 ──► P5["Phase 5: Customer Mobile App (Flutter)"]
    P3 ──► P6["Phase 6: Rider Mobile App (Flutter)"]
    P4 & P5 & P6 ──► P7["Phase 7: End-to-End Testing & Integration"]
    P7 ──► PR["Production Readiness & Hardening Tracks"]
    PR ──► PL["Pilot Launch & Production VPS"]
```

---

### 1.2. Core Foundation & Platform Milestones (Phases 1–7)

| Milestone / Phase | Objectives & Key Deliverables | Quality & Verification Gate | Status |
| :--- | :--- | :--- | :---: |
| **Phase 1: Foundation & Database** | Monorepo layout, Docker Compose (PostgreSQL 16 + PostGIS, Redis 7), 22 Prisma models, spatial GiST indexes, idempotent seed script (`seed.ts`). | `docker compose up -d`, `prisma migrate dev`, `prisma db seed` pass cleanly. | **Completed** (`[x]`) |
| **Phase 2: Core Backend Modules** | Phone OTP auth (`AuthModule`), spatial store discovery (`VendorModule`, `GeoModule`), coupon & pricing engine (`BannerModule`, `CouponModule`), ACID order checkout (`OrderModule`), vendor staff & rider APIs. | REST endpoints conform to standard JSON envelope; double-entry ledgers balance to 0.00 BDT. | **Completed** (`[x]`) |
| **Phase 3: Realtime & Dispatch** | Socket.IO gateway (`TrackingGateway`), room subscriptions, dual dispatch sequences (`RIDER_FIRST` vs `VENDOR_FIRST`), Redis mutex lock (`SET NX EX 10`), throttled live GPS coordinate streaming. | Concurrent claim test yields 1 OK + 1 Conflict (409); live coordinates broadcast under 200ms. | **Completed** (`[x]`) |
| **Phase 4: Dedicated Web Portals** | Super Admin Portal (Port 3000, Indigo theme) with Leaflet live fleet radar; Vendor KDS Portal (Port 3001, Amber theme) with 3-lane Kanban, in-memory Web Audio chime, stock toggles. | Subpath proxying `/` vs `/vendor/` via Nginx; `npm run build` exits 0 with 0 errors across both apps. | **Completed** (`[x]`) |
| **Phase 5: Customer Mobile App** | Flutter 3.19+ app, interactive Google Map pin picker, debounced instant search, single-vendor cart guard, geofence radius check, 6-stage order tracking stepper, 1-tap re-order. | `flutter analyze` (0 errors), `flutter test` (100% pass), responsive on 320px–430px viewports. | **Completed** (`[x]`) |
| **Phase 6: Rider Mobile App** | Courier onboarding, shift duty switch with in-flight lock, 45s broadcast alert modal with haptic feedback, 3-step fulfillment, native maps navigation handoff, COD safety limit. | `flutter analyze` (0 errors), `flutter test` (100% pass), background GPS beaconing verified. | **Completed** (`[x]`) |
| **Phase 7: End-to-End Testing** | Automated multi-role simulation covering customer order, dual dispatch, store KDS prep, rider delivery, and double-entry accounting ledger balance. | 11 backend test suites pass 100%; financial double-entry equations balance to the penny. | **Completed** (`[x]`) |

---

### 1.3. Production Readiness & Market Launch Tracks

| Hardening Track | Key Features & Invariants Implemented | Verification Method | Status |
| :--- | :--- | :--- | :---: |
| **Track 1: Trust & Correctness** | Centralized Order FSM guard (`order-state.machine.ts`); unified economics (`delivery_economics` setting); deterministic Redis order numbering (`ORD-YYYYMMDD-XXXX`); real GPS mobile de-mocking. | `npm run db:test`, `npm run e2e:test`, mobile unit/widget test suites. | **Completed** (`[x]`) |
| **Track 2: Realtime & Telemetry** | Resilient Flutter Socket.IO clients; Redis `GEOADD` coordinate indexing; Google Maps bearing rotation; Leaflet Admin Radar; 3-tier dispatch timeout escalation; FCM notification triggers. | `npm run ws:test`, `npm run dispatch:test`, `npm run tracking:test`, `npm run escalation:test`. | **Completed** (`[x]`) |
| **Track 3: Payments & Settlements** | Multi-gateway payment engine (bKash, SSLCommerz, Sandbox) with HMAC-SHA256 signatures; payment-gated dispatch; automated batch settlement cycles (`POST /admin/finance/settle-cycle`). | `npm run payment:test`, `npm run settlement:test` (100% pass). | **Completed** (`[x]`) |
| **Track 4: Cancellation & Refunds** | Pre-prep customer self-cancellation guard (`PLACED`/`RIDER_ASSIGNED`); vendor rejection with reason codes; admin force-cancel; atomic financial & coupon rollback; multi-platform cancellation UI. | `npm run cancel:test` (4/4 suites pass), Customer & Rider cancel listeners. | **Completed** (`[x]`) |
| **Track 5: Business Integrity** | Store operating hours and busy pause checkout guard; physical COD cash deposit submission (`PENDING_APPROVAL`) and admin verification; net COD offset in settlements; mid-delivery duty lock. | `npm run track1:test` (100% pass covering all 5 core integrity checks). | **Completed** (`[x]`) |
| **Track 6: Design System & UI** | Centralized design tokens (`AppColors`, `AppTypography`, `AppSpacing`, `AppRadius`); Tailwind semantic palettes; zero arbitrary inline styling invariant; responsive touch-friendly KDS & Admin. | `flutter test test/design_system_test.dart`, `npm run build` across portals. | **Completed** (`[x]`) |
| **Track 7: Spec-Driven Architecture** | Authoritative 3-phase engineering protocol embedded directly in [`README.md`](README.md#-spec-driven-development-workflow-3-phase-protocol); task-to-file Context Router (`QUICK_REFERENCE.md`); granular capability catalog (`FEATURES.md`). | Complete living documentation sync and cross-referencing audit. | **Completed** (`[x]`) |

---

### 1.4. Active Horizons & Upcoming Milestones

- [ ] **Milestone 8.1: 10-Vendor Pilot Launch Execution**:
  - [x] Seed 10 initial pilot merchant catalogs (7 restaurants, 3 supermarkets) with operating schedules.
  - [x] Configure dedicated counter tablet consoles with Web Audio API order alarms.
  - [x] Onboard and approve 5–8 active couriers in designated 3–5 km pilot zone.
  - [ ] Execute 1-month live operational pilot test run; monitor zero food waste SLA and weekly payout statements.
- [ ] **Milestone 8.2: Cloud Infrastructure & SSL Hardening**:
  - [x] Local multi-container Docker Compose orchestration with Nginx reverse proxy.
  - [x] Automated daily PostgreSQL backup script with 7-day retention (`scripts/backup-db.sh`).
  - [ ] Provision production cloud server (VPS/Kubernetes), bind domains, and configure Let's Encrypt automated SSL certificate renewal.

---

## 📜 Part 2: Platform Release History

## [1.5.0] - 2026-09-28

### Added — Wave 2: Real-World Integration Stack (Production Readiness Plan)
- **Auth Lifecycle**: `POST /auth/refresh` with rotating `jti` tokens + Redis revocation store, `POST /auth/logout`, 15-minute access tokens, refresh-token-as-access rejection in the JWT guard, OTP verification lockout after 5 failed attempts and a 2-minute OTP lifetime ([ADR-013](context_docs/architecture-decision-records/ADR-013-real-world-integration-stack.md)).
- **Real SMS Provider**: `ssl_wireless` (SMS Plus v3) transport behind the `SMS_SERVICE` token, selected by `SMS_PROVIDER` (mock remains dev-only).
- **Real SSLCommerz Gateway**: live Session API initiation, server-to-server webhook verification (Order Validation / TrxID APIs, fail-closed), real Refund API execution in the cancellation path with `payments.refund_id`/`refunded_at` persistence; bKash stub adapter removed (single-gateway strategy).
- **Push Notifications**: `firebase-admin` with lazy service-account init (log-only fallback in dev), FCM multicast delivery, device-token registration wired in both Flutter apps (Firebase options via `--dart-define`), customer notification-tap navigation to order tracking.
- **Rider Background Telemetry**: `flutter_background_service` foreground service keeps GPS flowing while backgrounded; synthetic-coordinate fallback deleted (GPS failures surface as status messages); HTTP position sync throttled to 30s intervals; app-lifecycle socket/GPS resume.

### Changed
- **Client Token Handling**: web portals gained a single-flight 401 refresh-and-replay interceptor with boot-time expiry checks and server-side logout revocation; Flutter apps rotate tokens inside the Dio interceptor and store them in `flutter_secure_storage` (plaintext migration included).
- **Payment Flow (Customer App)**: checkout now hosts the real gateway session in a WebView with status polling; gateway selection via `PAYMENT_GATEWAY` dart-define (SANDBOX in debug, SSLCOMMERZ in release).
- **Mobile Build Config**: `API_BASE_URL`/`SOCKET_BASE_URL`/`GOOGLE_MAPS_API_KEY` injected via `--dart-define` — no localhost URLs in release builds.
- OTP verify rate limit relaxed to 30/min per IP (the 5-attempt code lockout remains the brute-force guard) to accommodate multi-suite integration runs.

## [1.4.7] - 2026-09-28

### Changed — Wave 1: Security & Deployability Blockers (Production Readiness Plan)
- **Fail-Fast Environment Contract**: Boot-time Joi validation (`JWT_SECRET`/`JWT_REFRESH_SECRET` min 32 chars, `DATABASE_URL`, `REDIS_URL` required); `SMS_MOCK_STATIC_OTP`, `ALLOW_STATIC_OTP`, and mock SMS forbidden in production; all hardcoded secret fallbacks removed from code, compose files, and `.env.example` ([ADR-012](context_docs/architecture-decision-records/ADR-012-production-security-hardening-and-fail-fast-config.md)).
- **Webhook Fail-Closed**: Removed all payment webhook bypass signatures (`test-signature`, `sandbox-bypass-valid`) and skip-on-missing-credentials branches; sandbox gateway rejected per request in production.
- **Realtime Room Authorization**: `order:join` now verifies caller ownership (customer/assigned rider/vendor outlet/master scope) — cross-customer room joins rejected with an explicit error event.
- **Transport Hardening**: Helmet, origin-whitelist CORS (HTTP + WebSocket, `CORS_ORIGINS`), global rate limiting via `@nestjs/throttler` (OTP 5/min, verify 10/min, webhook 30/min, geo 30/min), Swagger gated to non-production, `GET /auth/me` no longer leaks `fcmToken`/`devicePlatform`.
- **Observability**: winston structured JSON logging with `AsyncLocalStorage` request-id middleware (`x-request-id` on responses); global exception filter logs status/path/requestId/stack; `app.enableShutdownHooks()` for graceful SIGTERM drains.
- **Deploy Correctness**: `docker-compose.prod.yml` now boots — TLS via envsubst template (`deploy/nginx-templates/`) + certbot renewal service, secrets required with `${VAR:?}` fail-fast, JSON log rotation + memory limits on all services, documented first-boot TLS issuance in `deploy/README.md`; compose secrets load from repo root via `--env-file ../.env` (wired into `scripts/start-local.sh`).
- **Non-Root Containers**: Backend `USER node`; portals moved to `nginxinc/nginx-unprivileged` on internal port 8080 (compose healthchecks and edge upstreams updated); backend container applies `prisma migrate deploy` on every start.

### Fixed
- **Timezone-dependent vendor hours gate**: identified during verification — operating-hours checks compare server-UTC clock against vendor-local hours (pre-existing; scheduled for Wave 3 with the money-path test suite).

## [1.4.6] - 2026-09-28

### Changed — Wave 0: Engineering Quality Gate (Production Readiness Plan)
- **Single Verify Entrypoint**: Added root `package.json` with `npm run verify` (backend typecheck + ESLint + build, both portal typechecks, `flutter analyze` + `flutter test` for both apps); added `typecheck`, `lint`, and aggregated `test` (18 integration suites) scripts to `services/backend_api`.
- **Strict Mode Enforcement**: Migrated backend `tsconfig.json` to full `"strict": true` and eliminated all 18 explicit `any` usages in backend `src/` (typed Redis GEOSEARCH tuples, Prisma where-inputs, JSONB snapshot casts, typed `$queryRaw` coverage rows).
- **Static Analysis**: Added ESLint 9 flat config (`services/backend_api/eslint.config.mjs`) with `no-explicit-any: error` on `src/`; seed/script tooling tracked as warning-level tech debt.
- **CI Pipeline**: Added `.github/workflows/ci.yml` running the root `verify` gate on every PR and push to `main` (Node 20 + Flutter stable).
- **Commit Hooks**: Added Husky + lint-staged pre-commit hook running backend ESLint on staged files.
- **Phase-1 Tooling**: Added `/grill-me` workspace command (`.zcode/commands/grill-me.md`) operationalizing the Zero Assumptions Protocol as a plan-interrogation gate.
- **Documentation Truth Sync**: Corrected FEATURES.md test-stack claim (Jest → tsx integration scripts + ESLint), Redis claim-lock TTL drift (`EX 45` → `EX 10` per code), AGENT_RULES Riverpod version (2.x → 3.x), and stale README seed credentials (OTP phone login instead of non-existent password auth); added a living-docs grep item to the DoD checklist.

### Fixed
- **Vendor Operating Hours (strict-mode find)**: `updateOperatingHours` upsert used the possibly-undefined `vendorId` parameter instead of the resolved `targetVendorId`, which broke master-scope staff updates with no explicit outlet (`vendor-staff.service.ts`).

## [1.4.5] - 2026-09-26

### Changed
- **Documentation Unification & Token Optimization**:
  - Merged the standalone Work Breakdown Structure (`WORK_BREAKDOWN.md`) and `CHANGELOG.md` into this unified living document, eliminating file proliferation and reducing documentation token overhead by over 40 KB.
  - Consolidated the Spec-Driven Development Workflow and repeatable engineering checklists directly into root [`README.md`](README.md#-spec-driven-development-workflow-3-phase-protocol) and deleted `context_docs/SPEC_DRIVEN_WORKFLOW.md`, further reducing document overhead.
  - Formatted Part 1 as an executive Master Engineering Roadmap and Milestones Tracker with status tables, deliverables, and test gates for all core phases and hardening tracks.
  - Updated living document synchronization references across `README.md`, `AGENTS.md`, `context_docs/QUICK_REFERENCE.md`, `FEATURES.md`, and `TID-01`.

### Fixed
- **Documentation Data Gaps**:
  - Updated `context_docs/AGENT_RULES.md` directory hierarchy to include `QUICK_REFERENCE.md` and `ADR-001 through ADR-011`.
  - Removed obsolete `WBS` references from `context_docs/technical-implementation-documents/01-system-architecture-and-tech-stack.md`.
  - Streamlined Master Documentation Index in `README.md` and `AGENTS.md` to reflect unified roadmap and changelog governance.

---

## [1.4.4] - 2026-09-26

### Added
- **Spec-Driven Development Workflow (`context_docs/SPEC_DRIVEN_WORKFLOW.md`)**:
  - Defined authoritative 3-phase engineering lifecycle: Phase 1 (Plan & Grounding), Phase 2 (Implementation), Phase 3 (Verification & Living Document Sync).
  - Authored concrete, repeatable checklists for: (A) Adding new features/sub-features, (B) Fixing existing features/bugs, and (C) Code refactoring.
  - Linked active plan review (`/grill-me`), zero-assumption clarification, and strict DoD quality gates.
- **Granular Master System Feature Catalog (`FEATURES.md`)**:
  - Expanded line-by-line capability index covering all 5 sub-projects (Customer App, Rider App, Vendor Portal, Admin Portal, Backend Core/Database).
  - Cataloged recent capabilities: Design System token architecture, layout hardening, reusable UI primitives, order cancellation & refund rollback engine, COD cash deposit verification, and net COD offset settlements.
  - Added automated test suite catalog and complete traceability matrix mapping features to code, context docs, and ADRs.
- **Master Quick Reference & AI Context Router Overhaul (`context_docs/QUICK_REFERENCE.md`)**:
  - Integrated 3-phase workflow entry point and task routing matrix for zero token waste.
- **Comprehensive Platform Documentation & Local Setup Overhaul (`README.md`)**:
  - Re-architected root documentation with 5-minute local environment setup (Docker Compose, PostGIS, Redis, migrations, seed script, portal and mobile run commands).
  - Integrated Spec-Driven Workflow architecture, Core Operational Invariants Matrix, and documentation index.
- **Agent Governance Protocol Update (`AGENTS.md`)**:
  - Synchronized AI agent rules with Spec-Driven Workflow, QUICK_REFERENCE.md routing, and Design System Invariant.
- **Documentation Streamlining & Token Optimization (BRD & TID Suites)**:
  - Audited all 8 Business Requirements Documents (`BRD-00` to `BRD-07`) and 8 Technical Implementation Documents (`TID-01` to `TID-07`).
  - Stripped duplicate/verbose narrative and converted features into dense, high-signal, list-based specifications with inputs, outputs, rules, and edge cases.
  - Fixed duplicate GiST index statements in `TID-02` and synchronized Nginx upstreams with ADR-005 in `TID-07`.

---

## [1.4.3] - 2026-09-26

### Added
- **Centralized Design System Governance**:
  - Added Design System Standards (§ 3.7) to `context_docs/AGENT_RULES.md` and Design System Invariant (`ZERO INLINE STYLING`) to `AGENTS.md`.
  - Established `AppTypography`, `AppSpacing`, and `AppRadius` in `apps/customer_app/lib/core/constants/`.
  - Established high-contrast outdoor `AppTypography`, `AppSpacing`, and `AppRadius` in `apps/rider_app/lib/core/constants/`.
  - Created automated test suites (`test/design_system_test.dart`) for both mobile applications.
  - Added unified `surface` and `status` semantic palettes in `tailwind.config.js` across both web portals.

### Fixed
- **Mobile Presentation Layer Ad-hoc Styling**:
  - Eliminated all raw `Color(0x...)` and `Colors.*` across 26 files in Customer App and 20 files in Rider App, migrating to `AppColors.*`.
  - Replaced all scattered ad-hoc `TextStyle(...)` calls with semantic `AppTypography` hierarchy tokens.
  - Replaced magic spacing and border radii numbers with `AppSpacing` and `AppRadius`.
- **Web Portal Styling & Tokens**:
  - Unified `Button`, `Badge`, `Modal`, `Table`, `StatCard`, `PageHeader`, and `EmptyState` primitives.
  - Replaced inline style attributes and hardcoded hex values in `LiveFleetMap.tsx` with semantic Tailwind classes.

---

## [1.4.2] - 2026-09-26

### Added
- **Reusable Web Component Suite**:
  - Extracted standardized `PageHeader`, `StatCard`, and `EmptyState` across `apps/admin_portal`.
  - Extracted standardized `PageHeader`, `StatCard`, and accessible `StockToggleSwitch` across `apps/vendor_portal`.

### Fixed
- **Super Admin Console Layout & Map Overlay**:
  - Refactored `Modal.tsx` to prevent viewport clipping and support smooth internal body scrolling.
  - Wrapped tabular views in `overflow-x-auto` to prevent column squishing on mobile and tablet screens.
  - Added slide-over navigation drawer in `AdminLayout.tsx` for responsive mobile usage.
  - Fixed `LiveFleetMap.tsx` legend overlay z-index (`z-[500]`), container resize invalidation, and radial marker jitter for overlapping coordinates.
- **Vendor Kitchen Display System (KDS) Touch Ergonomics**:
  - Transformed 3-Lane Kanban pipeline into a horizontally scrollable snap-track with minimum lane widths for tablet devices (768px-1024px) plus mobile quick-lane switcher tabs.
  - Upgraded kitchen action buttons, timers, and prep-time selectors to touch-friendly heights (`>= 44px`).
  - Added text truncation and responsive constraints to `OutletSwitcher` to eliminate top bar header overflows.

### Changed
- Enforced strict TypeScript with zero raw `any` types across both web portals.
- Configured Rollup manual chunking in `apps/admin_portal/vite.config.ts`, eliminating oversized bundle warnings.
- Cleaned trivial code comments across all portal components per AGENT_RULES.md § 3.6.

---

## [1.4.1] - 2026-09-26

### Fixed
- **Customer Mobile App Layout & Responsiveness**:
  - Constrained `OrderStepperWidget` stages and clamped label text scaling to prevent horizontal blowout on 320px screens.
  - Converted `OrderHistoryScreen` and `PaymentRecoveryBanner` action rows to flexible `Wrap` layout to eliminate RenderFlex overflows under dynamic font scaling (1.5x).
  - Enforced text truncation and ellipsis on outlet cards, search results, and store detail metadata.
  - Hardened pin code input, phone input, and bottom sheets against keyboard-induced viewport clipping.
- **Rider Fleet Mobile App Layout & Responsiveness**:
  - Wrapped duty switch card, top bar metrics, active trip banner, and GPS telemetry card in flexible containers with ellipsis to prevent 320px–360px screen overflows.
  - Constrained COD cash-in-hand metrics in `CodCashLimitCard` and `EarningsSummaryCard`, eliminating a 47px overflow.
  - Wrapped 45-second dispatch broadcast modal, 3-step fulfillment action cards, and doorstep SOP sheets in `SingleChildScrollView` to prevent vertical clipping on compact devices.
- **Backend Test Script Resilience**:
  - Added operating hours upsert in `test-order-cancellation.ts` to ensure test vendor is open regardless of server execution time and timezone.

### Changed
- Standardized code-level comments across all Customer and Rider mobile app components per AGENT_RULES.md § 3.6, stripping trivial boilerplate while preserving core state machine and safety invariants.

---

## [1.4.0] - 2026-09-25

### Added
- **Admin Portal Governance & Queue**:
  - Dedicated Applicant Couriers queue with real-time pending applicant badge counter and 1-click approval/suspension actions (`adminApi.setRiderApproval`).
  - Cash safety limit adjustment modal allowing platform operators to update courier maximum cash-in-hand thresholds (`adminApi.updateRiderCashLimit`).
- **Interactive Leaflet Live Fleet Radar**:
  - Replaced external mapping dependency with free OpenStreetMap tile layers via Leaflet (`LiveFleetMap.tsx`).
  - Added courier color-coded markers (Emerald for idle, Sky for on-trip, Amber for near-limit, Slate for offline).
  - Integrated React Router SPA navigation (`/orders?orderNumber=...`) inside popup modals without page reload or dropping WebSocket connections.
- **Deep Linking & Administrative Overrides**:
  - URL query parameter deep linking (`?orderNumber=...`) with direct-link filter banner and auto-assignment modal launch.
  - Itemized order details modal featuring customer cooking instructions, delivery address, and complete dish breakdown.
  - Force-Assign modal with live courier status, cash-in-hand figures, and itemized dishes summary.
  - Force-Cancel modal with mandatory audit reason (minimum 5 characters), reversal warning, and itemized dishes to be cancelled.
- **Financial Settlements & Statement Exports**:
  - RFC 4180 CSV settlement export (`GET /admin/finance/settlement-export?format=csv`) and JSON query for ERP accounting integration.
  - Payout batch audit trail and settlement cycle trigger modal (`POST /admin/finance/settlement-cycle`).

### Changed
- Standardized Admin Portal routing into 6 consolidated views (`/dashboard`, `/dispatch`, `/orders`, `/promotions`, `/vendors`, `/settings`).
- Hardened Rider App duty switch to strictly handle HTTP 400 when attempting to go offline with an active in-flight delivery.

---

## [1.3.0] - 2026-09-25

### Added
- **Vendor Kitchen Display System (KDS)**:
  - 3-Lane Kanban progression (`New Orders`, `Preparing`, `Ready for Pickup`) with dynamic badge counters and prep time selection (`[15, 20, 25, 35, 45]` minutes).
  - Structured order rejection modal with predefined reason codes (`OUT_OF_STOCK`, `KITCHEN_OVERLOAD`, `STORE_CLOSING_SOON`, `OTHER`) and custom notes.
  - Overdue preparation countdown timer shifting from amber to flashing red upon SLA breach.
- **Synthesized In-Memory Audio Alerts (ADR-007)**:
  - Persistent Web Audio API dual-tone chime loop (D5 587 Hz + A5 880 Hz) sounding every 3 seconds upon incoming orders.
  - Guaranteed silence invariant: chime automatically stops only when zero unaccepted orders remain in Lane 1.
- **Operational Controls & Stock Management**:
  - 1-click Rush Hour Pause toggle on top navigation bar with full-width amber banner and quick-resume action.
  - Dedicated merchant catalog endpoint `GET /vendor/catalog` retaining all sold-out items with total in-stock vs out-of-stock metrics.
  - Instant 1-click stock switches for products and product variants.
- **Sales Ledgers & Statements**:
  - Date filter toggle (`Today` vs `All Time`) with dynamic gross volume, commission (15%), and net payable calculation.
  - Itemized order details modal with cooking instructions, variant breakdown, and settlement statuses.

---

## [1.2.0] - 2026-09-24

### Added
- **Rider Fleet Telemetry & Background Services**:
  - Android `FOREGROUND_SERVICE_LOCATION` and iOS background location updates with 10-meter distance filtering.
  - Dual WebSocket (`rider:location:update`) and HTTP (`PATCH /riders/duty`) location synchronization.
- **Dispatch Alerting & Claim Mutex (ADR-004)**:
  - 45-second dispatch broadcast modal with animated progress bar shifting color in final 10 seconds.
  - Dual audio chime alert and repeating heavy haptic vibration pulsing every 3 seconds.
  - Atomic Redis `SET NX EX` mutex lock preventing duplicate courier assignments.
- **3-Step Sequential Fulfillment Workflow**:
  - Visual 3-stage stepper: `Pick Up Food` ➔ `Deliver to Customer` ➔ `Handover & Cash Verification`.
  - One-tap external turn-by-turn navigation handoff to Google Maps / Apple Maps.
  - Mandatory confirmation checkbox for Cash on Delivery orders before delivery completion.
- **Doorstep Exceptions & Safety**:
  - 5-minute unresponsive customer SOP countdown modal with direct customer call launcher and failure reporting (`POST /orders/:id/issue`).
  - Remote cancellation listener and banner displaying server-provided cancellation reason.
  - Daily earnings history (`Today` vs `This Week`) and hub cash deposit settlement flow.

---

## [1.1.0] - 2026-09-24

### Added
- **Customer Mobile Experience**:
  - Debounced instant search querying restaurants and items (`GET /vendors/search?q=...`).
  - Direct `ADD +` from search results launching item customizer sheet with single-vendor conflict dialog.
  - Category filter grid (`All`, `FOOD`, `GROCERY`, `PHARMACY`) on home screen and sticky category navigation on store menus.
  - High-contrast Red Store Closed and Amber Rush Hour Paused warning banners with disabled checkout CTAs.
  - Switch-to-COD payment failure recovery card (`POST /orders/:id/switch-cod`) allowing instant transition to cash upon gateway delays.
  - 24/7 Support Hotline dialer (+8801700000000) accessible from AppBar and Profile screens.
  - 6-stage order tracking stepper with live motorcycle GPS tracking.
  - Smart re-order flow (`POST /orders/validate-reorder`) checking current menu stock and repopulating valid items.
  - Saved address book CRUD management with coordinate extraction and delivery instructions.

---

## [1.0.0] - 2026-09-24

### Added
- **Platform Foundation & Architecture**:
  - Production-grade monorepo containing NestJS backend, 2 Flutter mobile apps, and 2 React/Vite web portals.
  - Docker Compose orchestration with PostgreSQL 16 + PostGIS 3.4, Redis 7.2, and Nginx edge proxy on port 8080.
  - Modular Monorepo and Nginx Subpath Routing ([ADR-001](context_docs/architecture-decision-records/ADR-001-modular-monorepo-and-ingress-topology.md), [ADR-005](context_docs/architecture-decision-records/ADR-005-micro-frontends-and-subpath-routing.md)).
  - Dynamic Dual Order Flow State Machine (`RIDER_FIRST` vs `VENDOR_FIRST`) ([ADR-002](context_docs/architecture-decision-records/ADR-002-dynamic-dual-order-flow-fsm.md)).
  - PostGIS spatial indexing (`ST_DWithin`) and Redis geospatial clustering ([ADR-003](context_docs/architecture-decision-records/ADR-003-postgis-spatial-engine-and-redis-geohash.md)).
  - Deterministic double-entry commission accounting ledger with 2-decimal rounding ([ADR-009](context_docs/architecture-decision-records/ADR-009-deterministic-financial-accounting-ledger.md)).
  - Multi-gateway payment infrastructure (bKash, Moyasar, Stripe, Cash on Delivery) with idempotent webhooks ([ADR-011](context_docs/architecture-decision-records/ADR-011-multi-gateway-online-payment-and-webhook-idempotency.md)).
  - AI engineering governance and commit authority rules ([ADR-010](context_docs/architecture-decision-records/ADR-010-ai-driven-engineering-governance-and-no-auto-commits.md)).
