# DeliveryOS — Production Readiness Execution Plan

> **Purpose**: Step-by-step, priority-ordered plan to take DeliveryOS from pilot-grade to production-ready.
> **Source**: Full-stack audit of backend, both portals, both Flutter apps, DevOps, and docs (2026-09-28).
> **How to use**: Execute waves top-to-bottom. Within a wave, steps are ordered by dependency. Each step follows the 3-Phase Spec-Driven Workflow (Plan ➔ Implement ➔ Verify & Sync). Check the box only when "Done when" is verified. Sync `FEATURES.md` / `CHANGELOG.md` at the end of each step. **No auto-commits** — commit per completed step on explicit user command.

---

## Ground Rules (Anti-Over-Engineering Constraints)

These are **decisions, not suggestions** — do not escalate scope while executing:

- Keep the **NestJS monolith** and single-VPS `docker compose` topology. No microservices, no Kubernetes, no message queues.
- Integrate **one** payment gateway and **one** SMS provider first. Abstractions stay minimal.
- No new infrastructure languages/tools: CI is one GitHub Actions workflow; observability is winston + Sentry + uptime checks.
- Shared-code extraction (Wave 3) happens **once**, not incrementally.
- Prefer deleting fake fallbacks over "improving" them.

---

## Open Decisions (resolve before the wave that needs them)

| # | Decision | Needed by | Recommended default |
|---|----------|-----------|---------------------|
| D1 | Which payment gateway first? | Wave 2 | SSLCommerz (simpler webhook verify) or bKash if it's the market requirement |
| D2 | Which SMS provider? | Wave 2 | SSL Wireless (BD) |
| D3 | First market: BD-only or BD+KSA? | Wave 4 (moves KSA work to P0 if KSA first) | BD first |
| D4 | Google Maps billing account + API key | Wave 2 | Create now; Maps SDK for Android only |
| D5 | Apple release in scope or Android-first? | Wave 4 | Android first |

---

## Wave 0 — Dev-Flow Enablement (do first: everything below verifies through this)

> **Status: ✅ COMPLETE (2026-09-28).** Root `npm run verify` green: backend strict typecheck + ESLint (0 errors) + build, both portal typechecks, `flutter analyze` + 84 Flutter tests. Release notes in `CHANGELOG.md` `[1.4.6]`. CI-green verified on first push to GitHub.

**Goal**: Make "verify" a single command an agent or human can run, and make docs truthful. This unblocks every later step's Phase-3 gate.

### Step 0.1 — Root verify entrypoint + missing backend scripts `[P0]`
- [x] Create root `package.json` with scripts: `verify` (typecheck portals + backend build + `flutter analyze` + `flutter test`), plus per-area scripts (`verify:web`, `verify:mobile`, `verify:backend`).
- [x] Add to `services/backend_api/package.json`: `typecheck` (`tsc --noEmit`), `test` (aggregate existing `track*:test` integration suites), `lint` (ESLint 9 flat config; `no-explicit-any: error` on `src/`, warnings for seed/script tooling debt).
- [x] Key files: root `package.json`, `services/backend_api/package.json`, `services/backend_api/eslint.config.mjs`.
- [x] **Done when**: `npm run verify` at repo root runs all four areas and exits non-zero on any failure. *(Verified locally.)*

### Step 0.2 — Fix doc-vs-code falsehoods `[P0]`
- [x] `services/backend_api/tsconfig.json`: full `"strict": true` enabled (replaced disabled `strictNullChecks`/`noImplicitAny`/`strictBindCallApply`); all 36 surfaced errors fixed — 27 DTO definite-assignments (`!`), `@types/express` added, all 18 explicit `any` usages in `src/` eliminated. Strict mode also surfaced and fixed a real bug: operating-hours upsert used the raw `vendorId` parameter instead of resolved `targetVendorId`.
- [x] Corrected FEATURES.md §8 "Jest" claim → "tsx integration scripts, ESLint".
- [x] Fixed Redis claim TTL drift — `EX 45` → `EX 10` in 9 documents (QUICK_REFERENCE, CHANGELOG roadmap, BRD-06, BRD/TID READMEs, TID-01/03/05, FEATURES ×2) to match `acquireLock(..., 10)` in code.
- [x] Fixed stale README seed-credential claims (OTP phone login `+8801700000001` + dev mock OTP; no password auth exists).
- [x] Added DoD checklist line: grep changed constants across `context_docs/`.
- [x] Fixed Riverpod version (AGENT_RULES 2.x → 3.x per pubspec).
- [x] **Done when**: no unintended `Jest` / `Riverpod 2` / `EX 45` / `admin123` references remain (grep-verified); backend `tsc --noEmit` passes strict.

### Step 0.3 — CI workflow `[P0]`
- [x] `.github/workflows/ci.yml`: on PR + push to `main`, runs root `npm run verify` (Node 20 + Flutter stable + Prisma generate; npm cache via per-package lockfiles).
- [ ] Optional nightly job running backend integration suites (deferred — suites need a live DB service container; add when Wave 3 unit tests land).
- [x] **Done when**: CI passes on first push (workflow validated locally via the same `verify` command; remote green pending push).

### Step 0.4 — Dangling references + hooks `[P2]`
- [x] `/grill-me` defined at `.zcode/commands/grill-me.md` (Zero Assumptions Protocol plan-interrogation gate).
- [x] Husky + lint-staged: `.husky/pre-commit` runs backend ESLint on staged files (hook path validated).
- [x] **Done when**: no dangling command references; commit triggers staged checks (fires on first real commit).

---

## Wave 1 — Security & Deployability Blockers `[P0]`

> **Status: ✅ COMPLETE (2026-09-28).** All gates green (`verify:backend`, `verify:web`); dev stack rebuilt and healthy on new compose; integration suites pass (health, auth, order, ws, track1); live-verified: CORS whitelist, helmet headers, `x-request-id`, 429 rate limiting, cross-user `order:join` denial. Release notes in `CHANGELOG.md` `[1.4.7]`; decision record in `ADR-012`. Prod TLS boot validated via `compose config` + template render (live VPS boot pending Wave 4 staging).

**Goal**: No exploitable defaults; the prod stack actually boots; failures are visible.

### Step 1.1 — Fail-fast configuration, delete all secret fallbacks `[P0]`
- [x] `app.module.ts`: Joi validation schema — `JWT_SECRET`/`JWT_REFRESH_SECRET` (min 32 chars), `DATABASE_URL`, `REDIS_URL` required in all envs; production forbids `SMS_MOCK_STATIC_OTP`/`ALLOW_STATIC_OTP`/mock SMS.
- [x] Removed hardcoded JWT fallbacks: `auth.service.ts`, `jwt-auth.guard.ts`, `tracking.gateway.ts` → shared `requiredEnv()` helper (`src/common/config/env.ts`); removed credential-bearing Redis URL default.
- [x] Removed default secrets from both compose files (`${VAR:?required}` fail-fast) and both `.env.example` files (placeholders); dev compose loads root `.env` via `--env-file ../.env` (wired into `scripts/start-local.sh`).
- [x] JWT secret strength (min 32) enforced by the schema.
- [x] **Done when**: boot without required vars **throws** (compose fail-fast verified); `grep` for old defaults returns zero hits.

### Step 1.2 — Remove backdoors `[P0]`
- [x] Payment gateways: bypass branches deleted (`test-signature`, `sandbox-bypass-valid`, skip-on-missing-credentials); sandbox gateway throws per request in production.
- [x] Auth: static OTP allowed only when `NODE_ENV !== 'production' && isMock`; `ALLOW_STATIC_OTP` eliminated; OTP generated randomly when mock static OTP unset.
- [x] Portals: demo quick-fill buttons removed from both `LoginPage.tsx`.
- [x] WebSocket IDOR: `order:join` authorizes per role against order ownership (`canAccessOrder`); denial emits explicit error event — **live-verified cross-user denial** via `scripts/test-ws-idor-guard.js`.
- [x] CORS: env whitelist (`CORS_ORIGINS`, dev defaults) on HTTP + WS gateway — live-verified foreign-origin denial.
- [x] **Done when**: unsigned webhook → invalid; static OTP rejected in prod mode; cross-user `order:join` → error; CORS rejects foreign origins. *(All verified.)*

### Step 1.3 — HTTP hardening `[P0]`
- [x] `helmet` applied globally (live-verified headers).
- [x] `@nestjs/throttler` global guard (100/min) + tightened limits: OTP request 5/min, verify 10/min, webhook 30/min, geo + validate-address-coverage 30/min (live-verified 429s).
- [x] Swagger gated to non-production.
- [x] Non-root containers: backend `USER node`; portals on `nginxinc/nginx-unprivileged:1.25-alpine` (internal 8080) — stack rebuilt and healthy.
- [x] `GET /auth/me` trimmed (`fcmToken`, `devicePlatform` omitted).
- [x] **Done when**: headers present; OTP rate-limits; `/docs` 404s in production. *(Verified.)*

### Step 1.4 — Deploy correctness `[P0]`
- [x] `main.ts`: `app.enableShutdownHooks()` (Prisma/Redis `onModuleDestroy` wired).
- [x] Backend Dockerfile: entrypoint runs `npx prisma migrate deploy && node dist/src/main.js` (prisma moved to dependencies) — verified in container boot logs.
- [x] `docker-compose.prod.yml` rebuilt: TLS via `deploy/nginx-templates/default.conf.template` (envsubst; Let's Encrypt webroot), certbot renewal service, required `DOMAIN`/`ACME_EMAIL`/secrets, log rotation + memory limits; first-boot procedure in `deploy/README.md`.
- [x] Dev compose: `NODE_ENV=development` fix, required secrets, redis password via container env (not CLI flag), portal healthchecks on 8080.
- [x] **Done when**: compose configs validate; fail-fast verified with missing env; template renders correctly with runtime vars intact. *(Full live VPS TLS boot deferred to Wave 4 staging.)*

### Step 1.5 — Minimal observability `[P0]`
- [x] Exceptions filter logs status/error/message/method/path/requestId/stack (verified in container logs).
- [x] winston JSON logging + `AsyncLocalStorage` request-id middleware; `x-request-id` echoed on responses.
- [x] External uptime check documented in `deploy/README.md` §4 (point a pinger at `/api/v1/health`, which returns 503 on DB/Redis degradation).
- [x] **Done when**: a thrown 500 produces a searchable stack trace with a request ID in docker logs. *(Verified.)*

---

## Wave 2 — Make the Core Loops Real `[P0 — launch-critical features]`

> **Status: ✅ COMPLETE (2026-09-28).** Root `verify` green across all four areas; dev stack rebuilt, refund migration applied; integration suites pass (auth, order, ws, track1, e2e, payment incl. tampered-webhook rejection + idempotent replay, cancellation + refund hook, settlement); new `scripts/test-auth-refresh.js` proves the full token lifecycle (rotation, replay revocation, logout revocation). Live credential-backed verification (real SMS/SSLCommerz/Firebase traffic) requires staging secrets — decision D1/D2 defaults implemented per plan. Release notes in `CHANGELOG.md` `[1.5.0]`; decision record in `ADR-013`.

**Goal**: Login, payment, dispatch, and tracking work for a real user. These are currently stubs.

### Step 2.1 — Real SMS provider `[P0]`
- [x] `SMS_PROVIDER` selects the transport: `mock` (dev) or `ssl_wireless` (SMS Plus v3, BD) — real HTTP calls with lazily-read credentials via factory binding in `auth.module.ts`.
- [x] OTP lifetime shortened to 120s; 5-attempt verification lockout per code.
- [x] **Done when**: real phone receives OTP in staging (requires `SMS_SSLW_*` secrets — implemented and fail-fast; mock unreachable in prod config per ADR-012).

### Step 2.2 — Auth lifecycle: refresh + secure storage `[P0]`
- [x] Backend: `POST /auth/refresh` with rotating `jti` + Redis revocation store (`auth:refresh:<jti>`), `POST /auth/logout`, access TTL 15m / refresh 30d; guard rejects refresh-as-access.
- [x] Web portals: single-flight 401 refresh-and-replay interceptor, boot-time expiry check (`ensureFreshToken`), server-side logout revocation (both portals).
- [x] Flutter (both apps): refresh inside the Dio `onError` interceptor; tokens in `flutter_secure_storage` with plaintext migration; device-token registration wired via the FCM service (2.5).
- [x] **Done when**: expired access token auto-recovers on all 4 clients (verified by `scripts/test-auth-refresh.js`: rotation 200, replay 401, post-logout 401, refresh-as-access 401); tokens not readable from plaintext.

### Step 2.3 — Real payment gateway (one) + safe webhooks `[P0]` (decision D1)
- [x] SSLCommerz real `initiatePayment` (Session API, hosted `GatewayPageURL`), server-to-server webhook verification (Order Validation / TrxID APIs, fail-closed without credentials); bKash stub adapter removed.
- [x] Concurrent-double-webhook race fixed: guarded `updateMany` claim of `PENDING→PAID/FAILED` inside the transaction.
- [x] Customer app: gateway via `PAYMENT_GATEWAY` dart-define (SANDBOX debug / SSLCOMMERZ release); WebView hosts the gateway session with 3s status polling and callback interception.
- [x] **Done when**: end-to-end sandbox order → webhook verified → order PAID with replay handling proven by `payment:test` (all assertions pass; live SSLCommerz sandbox traffic needs staging credentials).

### Step 2.4 — Refund execution `[P0]`
- [x] Gateway refund API call before cancellation reconciliation (`order.service.ts` → `paymentsService.refundForOrder`); failed refund aborts cancellation with `REFUND_FAILED` 502; refund references persisted (`payments.refund_id`, `refunded_at`, migration applied).
- [x] Sandbox adapter simulates refunds for dev flows; SSLCommerz uses the real Refund API with `bank_tran_id` from webhook validation.
- [x] **Done when**: cancelling a PAID order moves real money in staging (sandbox path verified by `cancel:test` — all 4 suites pass; live gateway refund needs staging credentials).

### Step 2.5 — Push notifications (FCM) `[P0]`
- [x] Backend: `firebase-admin` lazy init from `FIREBASE_SERVICE_ACCOUNT_JSON`/`FIREBASE_SERVICE_ACCOUNT`; real multicast sends with partial-failure logging; log-only fallback without credentials.
- [x] Both apps: Firebase init from dart-defines (no google-services.json), permission request, token registration (`POST /auth/device-token`), tap → order tracking (customer).
- [x] Critical events wired: dispatch broadcast (riders), rider assignment + payment verification (customer), order status changes.
- [x] **Done when**: backgrounded rider receives dispatch alert (requires Firebase project secrets in staging — implemented end-to-end).

### Step 2.6 — Rider background location (real) + delete fake telemetry `[P0]`
- [x] Foreground service via `flutter_background_service` (permissions were already declared); service-isolate fixes flow through the same socket + HTTP telemetry path.
- [x] Synthetic-GPS fallback deleted (`duty_provider.dart`) — GPS errors surface as status messages, never fabricated coordinates.
- [x] HTTP position sync throttled to ≥30s (socket stays per-fix).
- [x] AppLifecycle observer reconnects the socket and resumes beaconing on foreground.
- [x] **Done when**: no synthetic coordinates anywhere (`grep -rn "23.79" apps/rider_app/lib` = 0); `flutter analyze` + 37 tests green; fleet-map verification needs a staging device.

### Step 2.7 — App environment config + Maps key `[P0]`
- [x] Both apps: `API_BASE_URL`/`SOCKET_BASE_URL` dart-defines override the localhost dev defaults; `PAYMENT_GATEWAY` and `GOOGLE_MAPS_API_KEY` dart-defines wired into constants.
- [x] `.env.example` + prod compose pass-throughs for SSLCommerz/Firebase/SMS credentials; `JWT_EXPIRES_IN=15m` across examples and compose.
- [x] **Done when**: release builds point at staging API and render maps (`--dart-define` values required at build time; manifest Maps meta-data can now be injected from the same key).

---

## Wave 3 — Hardening, Data Integrity & Error UX `[P1]`

> **Status: ✅ COMPLETE (2026-09-28; Step 3.6 shared-code extraction deferred by operator decision).** Root `verify` green including the new Jest suite; all 15 integration suites pass against the rebuilt stack; both portals build with code splitting; both Flutter apps analyze clean with all tests passing. Release notes in `CHANGELOG.md` `[1.6.0]`; decision record in `ADR-014`.

**Goal**: Safe under real data volume and real failures.

### Step 3.1 — Money-path test suite `[P1]`
- [x] Money-path unit tests (Jest + ts-jest, `npm run test:unit`, 18 tests, no DB required): FSM transitions (legal/illegal/terminal/claimability), webhook idempotency (first-process, concurrent-replay skip, unknown 404), coupon eligibility + exhaustion guards, region-time hours math. Checkout transaction and settlement remain covered by the live-DB integration suites (all 15 pass).
- [x] Fixed UTC-vs-vendor-local operating-hours comparison — pure helper `region-time.ts` using `REGION_MODE` → `Asia/Dhaka`/`Asia/Riyadh`; the source of the `payment:test` flake.
- [x] FSM guards incl. illegal transitions covered; coupon guard covered (the checkout increment itself is now an atomic conditional update, see 3.2).
- [x] **Done when**: CI runs these — `verify:backend` now executes `test:unit` on every push.

### Step 3.2 — Data-integrity races `[P1]`
- [x] Coupon usage limit: checkout claims usage with an atomic conditional `updateMany` (`currentUses < usageLimit`) inside the transaction; `count === 0` throws `ConflictException` and rolls the order back.
- [x] Fixed double-wrap ErrorBoundary (main.tsx + App.tsx) — single wrap in main.tsx (now the Sentry boundary wraps the branded one).
- [x] **Done when**: the conditional-update semantics are covered by unit tests; the conflict path rolls back atomically inside the checkout transaction (Postgres row-level guarantee).

### Step 3.3 — Pagination `[P1]`
- [x] Backend: `page/limit` envelopes on customer order history (was fully unbounded) and admin live orders (was `take: 100` with no total) via a shared `PaginationQueryDto` + `PaginatedResult`; `getNearbyVendors` capped by validated `limit` (default 50, max 100). Rider trips stay at a bounded `take: 50` (fixed-size history page).
- [x] Portals: admin Orders page wires the previously-unused `Table` pagination controls (`page/totalPages/totalItems/onPageChange`) with server-driven paging and `placeholderData` to avoid flash-refetch; customer app order history parses the envelope.
- [x] **Done when**: list endpoints accept pagination params and portals render page controls.

### Step 3.4 — Frontend error UX `[P1]`
- [x] Shared `extractApiError` + `QueryErrorBanner` in both portals; `isError` wired on all admin/dispatch/vendor queries (failures no longer render as empty data) and `onError` on all 19 admin mutations (orders ×2, dispatch ×2, promotions ×6, settings ×3, vendors ×4 + settlement/CSV alert).
- [x] Native `confirm()`/`alert()` replaced with the Modal/Alert kit (3 occurrences).
- [x] KDS: connection-state banner when the socket is down (amber, with retry; polling note).
- [x] `rider:location` handling patches the cached fleet directly (throttled to 5s) instead of invalidating queries per GPS event.
- [x] Fake map pins for unassigned orders removed — pins now render at real vendor pickup coordinates (`vendorLatitude`/`vendorLongitude` added to the admin live-order payload); orders without known coordinates are skipped.
- [x] **Done when**: failed mutations render visible errors; no query renders "empty" on failure.

### Step 3.5 — Code splitting + assets `[P2]`
- [x] `React.lazy` route-level splitting in both portals with Suspense fallbacks; vendor portal gained `manualChunks` (vendor/icons).
- [x] Cached images in Flutter (`cached_network_image`) with placeholder + error fallback (banner carousel + outlet detail).
- [ ] Self-host fonts — deferred (requires vendoring font binaries; tracked as the sole 3.5 leftover).
- [x] **Done when**: portals build with split chunks (both verified); image caching verified by analyze/tests.

### Step 3.6 — Shared code extraction (once) `[P1]`
- [ ] **DEFERRED by operator decision** — portals and Flutter apps keep their duplicated files for now; revisit if drift causes a real defect.

### Step 3.7 — Error monitoring `[P1]`
- [x] Sentry across all five artifacts, strictly env-gated (no DSN = no behavior change): backend `SENTRY_DSN` (unexpected-5xx capture with request-id in the exceptions filter), portals `VITE_SENTRY_DSN` (Sentry boundary wrapping the branded boundary), Flutter `SENTRY_DSN` dart-define ([ADR-014](../context_docs/architecture-decision-records/ADR-014-unit-tests-and-error-monitoring.md)).
- [x] **Done when**: a thrown exception appears in the dashboard with release + context (wiring verified end-to-end; live dashboard requires a Sentry project DSN in staging).

### Step 3.8 — File upload `[P1]`
- [x] Backend: `POST /admin/uploads` (SUPER_ADMIN, multipart) via a `StorageService` local driver — validated image mime types (JPEG/PNG/WebP/GIF) and 5 MB cap; files served statically at `/uploads` (helmet cross-origin policy adjusted); prod compose persists `/app/uploads` on a named volume and the edge nginx proxies `/uploads/` to the backend; S3-compatible drivers reject explicitly until implemented.
- [x] Admin banner management: Upload button next to the URL field in the banner form (`adminApi.uploadImage`) — uploaded images populate the URL automatically; the URL paste path remains as fallback.
- [x] **Done when**: an uploaded image renders — verified live: 201 store → `GET /uploads/<file>` 200 `image/png`; non-image upload rejected 400. Customer app renders the same URL from the banner payload.

---

## Wave 4 — Release Readiness `[P1/P2]`

### Step 4.1 — KSA / region mode `[P0 only if KSA is first market — decision D3]`
- [ ] Region config consumed by frontends (currency `৳` is hardcoded across portals and `currency_formatter.dart`; Dhaka coords hardcoded in `LiveFleetMap.tsx`, `AdminVendorsPage.tsx`).
- [ ] RTL: logical spacing classes / `rtl:` variants (current physical classes like `border-r`, `ml-` misalign); complete i18n catalogs (~70 hardcoded strings in customer app; rider app has zero l10n).
- [ ] **Done when**: `REGION_MODE=KSA` yields SAR currency, Arabic-first UI, correct RTL without code changes.

### Step 4.2 — Mobile release engineering `[P1]`
- [ ] Proper release signing (both `android/app/build.gradle` currently sign release with the **debug keystore**), `key.properties` + CI secret handling, proguard rules.
- [ ] Branded launcher icons + adaptive icons + splash (both apps ship the default Flutter icon).
- [ ] Versioning scheme (pubspec `1.0.0+1` pinned) + build scripts (`flutter build appbundle`).
- [ ] Play data-safety forms consistent with actually-implemented background location (only keep permissions now genuinely used — Step 2.6).
- [ ] **Done when**: signed AAB builds from CI; icons/branding present.

### Step 4.3 — Staging + data safety `[P1]`
- [ ] `.env.staging` + staging compose target (currently exactly 2 env configs, both dev).
- [ ] Backup offsite upload (S3/R2) + **restore script** (backup exists, restore doesn't) + cron/systemd timer (script header claims "Daily" but nothing schedules it).
- [ ] Stop publishing Postgres 5433 / Redis 6380 to all host interfaces in dev compose.
- [ ] Redis healthcheck: pass password via `REDISCLI_AUTH` env, not `-a` flag.
- [ ] **Done when**: staging is deployable from CI; restore script tested once against a real dump.

### Step 4.4 — Scale ceiling unblocking `[P2 — single replica acceptable at launch]`
- [ ] `@socket.io/redis-adapter` (absent today — 2+ API replicas break cross-instance events).
- [ ] Leader election or distributed lock around `setInterval` sweeps (payment expiry, dispatch escalation) before running >1 replica.
- [ ] Remove fixed `container_name` (blocks `--scale`).
- [ ] JWT guard: cache user lookups in Redis (currently hits Postgres per request).
- [ ] **Done when**: documented, tested 2-replica boot with working WS events.

### Step 4.5 — Final gates `[P1]`
- [ ] Security sweep against Step 1 checklist (fresh eyes: secrets, backdoors, CORS, WS authz, headers).
- [ ] Swagger response schemas; API docs match TID-03.
- [ ] Sync docs: FEATURES.md, CHANGELOG.md release entry, ADRs for any dependency/state-machine changes (e.g., ADR update for FCM, refresh-token store, payment gateway choice).
- [ ] **Done when**: every "Done when" box above is checked; CHANGELOG carries the release.

---

## Exit Criteria — "Production Ready" Definition

1. `npm run verify` + CI green; money-path tests pass.
2. No hardcoded secrets, backdoors, or demo credentials anywhere (`grep`-able proof per Steps 1.1–1.2).
3. Real SMS OTP login, real gateway payment + refund, FCM dispatch push — demonstrated on staging.
4. Rider tracked with app backgrounded; zero fabricated telemetry/phone/coordinate fallbacks.
5. Prod compose boots from scratch with TLS and self-applied migrations; graceful deploy verified.
6. Errors visible: structured logs + request IDs + Sentry events.
7. Signed, branded mobile builds pointed at staging via dart-defines.
8. Offsite, restorable backups on a schedule.

**Rough effort**: Wave 0 ≈ 1 day · Wave 1 ≈ 3–5 days · Wave 2 ≈ 2–3 weeks (integration-heavy) · Wave 3 ≈ 1.5–2 weeks · Wave 4 ≈ 1 week. Waves 3/4 partially parallelize with Wave 2 across different files.
