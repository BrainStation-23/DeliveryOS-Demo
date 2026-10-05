# DeliveryOS — Production-Readiness Audit & Remediation Plan

- **Date:** 2026-10-05 · **Auditor:** Principal-engineer pass over all 5 codebases (backend + 2 web portals + 2 Flutter apps) + infra + docs
- **Status:** READ-ONLY AUDIT — no code changed. Awaiting owner approval before implementation.
- **Method:** full read of governance rules; six exhaustive platform scans (every source file, script, config, test); **all Critical/High findings re-verified line-by-line by the lead auditor** (12 verification spot-checks documented in-line).

---

## 0. Executive Summary

The platform is architecturally sound — the schema, FSM, dispatch mutex, financial ledgers, and test-integrity gates are genuinely strong, and all suites currently pass locally. But the audit found **4 Critical and ~30 High findings** that stand between this system and production:

1. **The CI integration gate is fiction** — the workflow never starts the API server, yet 6 of 18 chained suites call `http://localhost:4000`. CI should be red on `main` today; money-path regressions can merge unnoticed. *(verified: ci.yml:100-117 starts no server; 6 scripts hardcode the URL)*
2. **Stored XSS in the super-admin fleet map** — Leaflet popups interpolate rider/vendor strings as raw HTML; one malicious name steals the admin JWT from localStorage. *(verified: LiveFleetMap.tsx:106-119)*
3. **Riders can ghost-Online** — the rider app's duty-toggle catch-all falls through to local "online" on any network error; the rider then sits invisible to dispatch all shift. Worse, the server writes duty-GPS to a Redis GEO key (`riders:locations`) that dispatch never reads (`riders:locations:active`) — *two* independent dispatch-visibility bugs. *(verified: duty_provider.dart:100-120; rider.service.ts:128 vs order-flow.service.ts:210)*
4. **Vendor mutation endpoints bypass validation entirely** — `PATCH /vendor/settings` and `PUT /vendor/operating-hours` use inline body types the global ValidationPipe skips; malformed times poison the checkout operating-hours gate, and the hours upserts aren't transactional. *(verified: vendor-staff.controller.ts:87-136)*

Beyond these: commission economics leak to the public and to customers (2 endpoints); checkout has **zero unit tests** and can 500 *after* commit (duplicate-order on retry); the vendor portal ships **~70 silently no-op Tailwind v4 classes on Tailwind 3**; both Flutter apps never revoke refresh tokens on logout and can target `http://localhost` in release builds; the rider app has no session-expiry handling, no localization, and violates the mandated 5–8 s GPS cadence; dead realtime events and unreachable listeners pepper the WS layer; and the admin console is ~90 % hardcoded English while the docs promise trilingual RTL.

The remediation plan (§3) sequences this into 6 phases — gate-fixes and security first, then money/dispatch correctness, then frontend/mobile reliability, then consistency, naming, and docs — every fix paired with the test that proves it and the verification step that closes it.

**Finding counts:** Critical **4** · High **31** · Medium **58** · Low **47** (140 total; 2 marked *needs confirmation*).

---

## 1. Coverage (Phase 1)

| Area | Coverage |
|---|---|
| Governance | AGENT_RULES.md (all 236 lines), README, QUICK_REFERENCE, ADR index + ADR-019, FEATURES/CHANGELOG (sampled claims) |
| Backend `src/**` | Every module read in full (19 controllers, all services/DTOs, common/) — ~60 files; all 21 spec files inventoried |
| Backend prisma/scripts/cfg | schema.prisma, seed.ts, 0_init migration, all 18 integration scripts, package.json, jest/eslint/tsconfig, Dockerfile |
| Infra/CI | docker-compose (local+prod), both nginx confs + template, init-postgis.sql, ci.yml, husky, backup/restore scripts, .env.example |
| Admin portal | All 10 pages + auth, every component/hook/store/service/util (≈90 files), i18n, configs, all 23 tests |
| Vendor portal | All 4 pages + every component/hook/store/service, i18n ×3 locales, configs, all 8 tests (≈89 files) |
| Customer app | Full `lib/` (features + core), all tests, pubspec, manifest |
| Rider app | Full `lib/`, all tests, pubspec, manifest, background service |
| Cross-platform | ~110 routes vs every FE call; 13 WS emitters vs every listener; envelopes, auth flows, naming, docs-vs-code drift |

Not covered (declared): iOS `Runner` configs beyond manifest basics, generated code (`*.g.dart`, dist), coverage artifacts.

---

## 2. Findings (Phase 2)

Severity: **C**ritical / **H**igh / **M**edium / **L**ow. All findings verified unless marked ⚠ (needs confirmation). Dependency column: `→` blocks / pairs-with.

### 2.1 Critical (4)

| ID | Platform | Location | Finding & why it matters | Fix | Deps |
|---|---|---|---|---|---|
| **CR-1** | CI/Infra | `.github/workflows/ci.yml:100-117` + 6 scripts (`test-address-profile`, `test-online-payments`, `test-order-cancellation`, `test-settlement-cycles`, `test-track-1-integrity`, `test-track-3-vendor-kds`) | Integration job runs `npm test` after migrate+seed but **never starts the API on :4000**; those 6 suites hardcode `http://localhost:4000` → connection-refused. The "strict blocking merge gate" comment is false; CI is red-or-skipped for money paths (cancellation/refund, payments, settlement, governance, both tracks) | CI: `node dist/src/main.js &` (with wait-on health) before `npm test`; and/or convert the 6 scripts to boot their own app like the other 12. Verify CI is actually green on `main` after | → INF-38 (harness), pairs F-15/17/18 script hygiene |
| **CR-2** | Admin portal | `apps/admin_portal/src/components/dispatch/LiveFleetMap.tsx:106-119,150-165` | Popup HTML built via string interpolation of `riderName`, `phone`, `status`, `orderNumber`, `vendorName`, `totalAmount` → stored XSS; localStorage JWT (ADM-8) is the payload target | Build popups with DOM APIs/`textContent` (pattern already used for the button in the same file) | pairs ADM-8 |
| **CR-3** | Rider app | `apps/rider_app/lib/features/dashboard/providers/duty_provider.dart:100-120` (+ `main.dart:120` resume hook) | Any non-403/400 error (network drop, 5xx, timeout) falls through "Offline fallback handling" → local state **Online**, GPS + foreground service started, server never confirmed | Fail closed: on network error return offline + surface error; "online" must be server-confirmed | pairs BE-1 |
| **CR-4** | Backend | `vendor-staff.controller.ts:87-136` (`PATCH /vendor/settings`, `PUT /vendor/operating-hours`) | Inline-object bodies: global ValidationPipe skips non-class metatypes → negative prep times, garbage `openTime:'25:99'` persist; malformed times poison `isWithinOperatingHours` string comparison (store permanently open/closed); per-day upserts not in a transaction (half-written schedules); `busyReason` silently dropped | `UpdateOutletSettingsDto` + shared `OperatingHourDayDto` (admin's validated version exists), `prisma.$transaction` upserts | → BE-28 (shared hour DTO) |

### 2.2 High — Backend (11)

| ID | Location | Finding | Fix | Deps |
|---|---|---|---|---|
| BE-1 | `riders/rider.service.ts:128` vs `order-flow.service.ts:210,222` | Duty-toggle GEOADD writes `riders:locations`; dispatch reads `riders:locations:active`. REST-online riders invisible to geo-targeted dispatch push until first socket tick; dead key grows forever | Write the active key; ZREM on offline; add index hygiene | pairs CR-3 |
| BE-2 | `vendors/vendor.service.ts:106` (public `GET /vendors/nearby`) | Unauthenticated response includes `commission_rate` per outlet — confidential platform–vendor economics public | Remove from public projection | — |
| BE-3 | `orders/order.service.ts:461-474` | Checkout response returns `commissionAmount` + `netVendorPayable` to the customer; also `handleOrderPlaced` awaited post-commit without catch → dispatch hiccup returns 500 after money committed (retry duplicates order) | Strip vendor financials from customer response; try/catch dispatch trigger (escalation sweep re-broadcasts) | — |
| BE-4 | `admin/admin.service.ts:1776-1778` vs `pricing/delivery-fee.service.ts` defaults | Fee-mode PATCH fallback tiers (baseFee 40 / rate 15) differ from the engine's canonical defaults (30/10) — admin storing defaults silently writes different money config than every surface shows | Spread `DEFAULT_DELIVERY_FEE_CONFIG` | — |
| BE-5 | `admin/admin.service.ts:718-719` | `maxDiscountAmount \|\| null`, `usageLimit \|\| 1000` falsy-zero traps: literal `0` becomes null (unbounded % discount) / default | `??` for numerics | — |
| BE-6 | `order-flow/order-flow.service.ts:216-249` | `findNearbyAvailableRiders`: per-candidate `redis.get` + `rider.findUnique` (N+1 with 2×N round trips per broadcast) | `MGET` + one `findMany({id in})` | — |
| BE-7 | `order-flow.service.ts:522-536` | Claim's final `order.update` lacks `riderId: null` re-guard; 10s lock can expire mid-tx → double-assignment window | Guarded conditional update (+ P2025 handling) like accept/handover already do | — |
| BE-8 | `admin/admin.service.ts:412-513` `forceAssignRider` | In-flight check outside tx (concurrent double-book), skips COD cash-limit projection, can assign to TAKEAWAY orders | Conditional claim tx + same invariants as rider claim | — |
| BE-9 | `auth/auth.service.ts:122-150` | Rider signup = two non-transactional writes; concurrent verify → raw P2002 500 | `$transaction` + P2002 re-fetch | — |
| BE-10 | `riders/rider.service.ts:203-299` `deliverOrder` | `codCashCollected:true` + amount 0 still marks order `PAID` — revenue booked, zero cash recorded | PAID only when collected > 0 / reject mismatch | → MOB test plan |
| BE-11 | `auth/auth.service.ts:225-246` | Refresh rotation get-then-del (non-atomic): concurrent refresh both succeed; no reuse/family revocation | Atomic `DEL`-wins or Lua compare-and-delete; treat loser as theft | — |

### 2.3 High — Cross-platform & realtime (6)

| ID | Location | Finding | Fix |
|---|---|---|---|
| XP-1 | Backend `order-flow.service.ts:203` vs FE `settings.api.ts` + tests | Dispatch-setting casing trichotomy: GET `/admin/settings/dispatch` camelCase, PATCH returns raw snake_case, combined `/admin/settings` mixes both; FE PATCH type claims camelCase (wrong) | PATCH returns `getDispatchConfig()` shape; normalize combined endpoint |
| XP-2 | Both Flutter apps `auth_provider.dart logout()` | Mobile logout only clears local storage — refresh token stays valid server-side (theft window on shared/stolen devices) | Fire-and-forget `POST /auth/logout` before clearing |
| XP-3 | `payments.service.ts:416,422` `order:payment:verified` | Zero listeners in all 4 apps (customer polls REST 3s); TID-04 claims it powers tracking — false doc | Listen in `tracking_provider` (invalidate+refresh) or remove event + fix TID-04 |
| XP-4 | `rider.service.ts:477` `order:delivery_failed` → `admin_hq` | Zero listeners — doorstep failures never reach any console | Add admin listener + invalidation |
| XP-5 | `tracking.gateway.ts:518` `dispatch:broadcast` → `riders_pool` only; `AdminFleetPage.tsx:131` listens | Structurally unreachable admin listener (masked only because `order:new` shares the handler) | Also emit to `admin_hq` (or drop the admin listener) |
| XP-6 | FEATURES.md:38-40 vs reality | Trilingual+RTL claim false: admin ~500 hardcoded strings / 30 i18n keys (9/11 pages unlocalized); rider app has **no localization at all**; money formatters hardcode `৳` in all 4 apps | Fund admin+rider i18n or scope the claim (decision item) |

### 2.4 High — Admin portal (6 of 29; rest Medium/Low in appendix table)

| ID | Location | Finding | Fix |
|---|---|---|---|
| ADM-1 | `AdminSettingsPage.tsx:21-25` | Rules-of-Hooks: early `<Navigate>` before hooks → "rendered more hooks" crash on in-app `?tab=` links | Move redirect to route config |
| ADM-2 | `AdminOrdersPage.tsx:88` vs `AdminFleetPage.tsx:42` + `CashDepositsSection.tsx:43` | One query (`getFleet`) under two keys; money mutations invalidate the wrong key(s) — stale fleet/cash after deposit-verify & force-assign | Single `['admin-fleet']` key; invalidate rider keys on verify |
| ADM-3 | `OperatingHoursEditor.tsx:46-50` | Save invalidates nothing — stale hours UI after save | Invalidate `admin-outlet-detail` + `admin-vendors` |
| ADM-4 | Whole portal | i18n: ~500 hardcoded English strings across 9/11 pages while ar/bn + selector ship (see XP-6) | Phased extraction (nav → tables → dialogs) |
| ADM-5 | `vitest.config.ts` `environment:'node'`; zero `.test.tsx` | No component/hook tests at all — incl. security-critical apiClient 401 single-flight refresh/replay and socket auth rotation | jsdom + testing-library; specs listed in §3.6 |
| ADM-6 | Both portals: `shadow-xs`, `shadow-2xs`, `focus:outline-hidden`, `h-6.5`, `py-0.2`, `animate-in` (~70 uses vendor, present in admin too) | **Tailwind v4-only classes on Tailwind 3.4.10 — silent no-ops**: elevation, focus outlines, scrollbar hiding, switch sizing, menu animation never render | Map to TW3 equivalents (`shadow-sm`, `outline-none`, define utilities, add plugin or drop `animate-in`) — verified in both package.jsons |

### 2.5 High — Vendor portal (6 of 25)

| ID | Location | Finding | Fix |
|---|---|---|---|
| VP-1 | `useKDSOrders.ts:169-173` + `sound.ts:109-125` | 3s order chime loops forever if staff leaves KDS (or order acknowledged elsewhere); never stopped on logout/unmount | Cleanup effect + stop on logout |
| VP-2 | `useRushPause.ts:40` | Rush-pause reads the **global** active outlet's `isBusy`, not the target outlet — brand owners pause/resume the wrong store | Resolve target outlet's state |
| VP-3 | `VendorOrdersPage.tsx:34-88` + backend `vendor-staff.service.ts:980-999` | Ledger: unbounded fetch (no server pagination), client-only paging; date filter uses browser-local midnight **and filters `commissionLedger.createdAt` not `orders.placedAt`** — wrong financial-day attribution for late-night orders | Server `take/skip`; region-local bounds; filter `placedAt` |
| VP-4 | `useRushPause.ts:27` + widgets | Rush-pause failures invisible (console-only + fire-and-forget rejections); catalog & settings queries have no error surfaces — a 500 renders as empty/default data | Error banners + caught mutations |
| VP-5 | `OperatingHoursWidget.tsx:125-151` | No `close > open` validation, no overnight-window support, dirty state not reset on outlet switch | Validate before save; overnight handling per business rule |
| VP-6 | `vitest node` env; zero tests for `useKDSOrders`, `useRushPause`, apiClient refresh, sound, date math | Highest-risk kitchen logic untested | jsdom + specs in §3.6 |

### 2.6 High — Mobile (rider R / customer C)

| ID | App | Location | Finding | Fix |
|---|---|---|---|---|
| MOB-1 | rider | `trip_provider.dart:204-224` + dashboard | 45s expiry: `dismissIncomingAlert` clears state but **never pops the modal** — accept stays enabled with fake fresh countdown; second broadcast stacks dialogs; `handleBroadcast` discards pending alert | Pop on expiry via `ref.listen`; guard claim by `countdownSeconds>0`; queue/ignore new broadcasts while pending |
| MOB-2 | rider | `dio_client.dart:36-41` + `auth_provider.dart` | No session-expiry listener (customer has one): refresh-failure wipes tokens, rider stuck on dead dashboard forever | Port customer's `onSessionExpired` pattern |
| MOB-3 | rider | `background_location_service.dart:63` + `duty_provider.dart:179-228` | GPS cadence violates §3.5: isolate 15s, in-app distance-only (bursts when drifting / silent in traffic), socket emit unthrottled — spec'd 5–8s beacon missing | Time-throttle emits to 5–8s minimum interval |
| MOB-4 | rider | `AndroidManifest.xml` | No `<service android:foregroundServiceType="location">` declared — Android 14+ throws `InvalidForegroundServiceTypeException` → background GPS dead/crash on new devices | Declare typed FGS; verify merged manifest on API 34+ ⚠ (needs on-device confirmation) |
| MOB-5 | both | `api_constants.dart:18-38` | Release/default `baseUrl` falls back to `http://10.0.2.2`/`localhost` **not gated on kDebugMode** — release build without `--dart-define` silently ships pointing at localhost | Fail-fast in release when `API_BASE_URL` empty |
| MOB-6 | customer | `order_history_provider.dart:186-219` | Reorder repopulates cart with **historical prices**, ignoring the server's `validItems` current pricing → bill mismatch at checkout (violates §2.6) | Use validated response pricing |
| MOB-7 | customer | `cart_screen.dart:97-108` + `cart_provider.dart:114,171-179` | Checkout can fire before geofence check completes (`canCheckout` defaults coverage true, ignores in-flight); delivery-fee fallback hardcoded `60.0`, minSpend fallback `250.0` | Gate on resolved coverage; unknown-fee state disables checkout; drop magic constants |
| MOB-8 | customer | `order_tracking_screen.dart` + `tracking_provider.dart:260` | Initial fetch failure silently renders a fake PLACED order (`#ORD-…`, zero totals); errors only `debugPrint` | Error+retry state; disconnect banner |

### 2.7 High — Infra / seed / scripts (9)

| ID | Location | Finding | Fix |
|---|---|---|---|
| INF-1 | `deploy/nginx-templates/default.conf.template` (0 `resolver` directives) | Edge resolves `backend`/portal hostnames once at startup → container recreate = stale-IP 502s for up to the 6h reload (bit us live in Step 3) | `resolver 127.0.0.11 valid=10s` + variable `proxy_pass` everywhere (local conf half-does it) |
| INF-2 | `prisma/seed.ts:953-1006` | Seed fabricates FSM-illegal data: `acceptedAt` on never-accepted orders (RIDER_ASSIGNED, cancelled-from-PLACED); riders on VENDOR_FIRST PREPARING orders — analytics/KDS/settlement validated against impossible states | Gate `acceptedAt`/`riderId` by FSM legality; extend reconciliation asserts |
| INF-3 | 5 scripts (`test-vendor-rider`, `test-e2e-lifecycle`, `test-order-dispatch-fsm`, `test-track-1`, `test-track-3`) | Raw `updateMany` mass-cancels/force-delivers: CANCELLED-with-ledger and DELIVERED-without-trip-ledger rows + permanent seed drift (commission 16.5%, cash-limit 8000, mutated phones) — books dirty for later suites & demos | Cancel via service API or restore in `finally`; deterministic fixtures |
| INF-4 | `test-vendor-rider.ts:53-60` | Upserts dead `order_flow_config` setting (pre-reset era) — pins nothing | Delete; pin outlet `orderFlowMode` if intent is mode-pinning |
| INF-5 | `test-track-1-integrity.ts:56-62,407` / `test-online-payments.ts:76-81` | Persona mix-ups: "customer" is the outlet manager; "rider" token minted as super-admin; headline assertions (post-payment broadcast, webhook idempotency, settlement net-offset) logged but **never asserted** | Correct personas; assert the actual invariants |
| INF-6 | `deploy/docker-compose.yml:103-115` | Local compose publishes 4000/3000/3001/8080 on **all interfaces** (DB/Redis correctly loopback-only) — LAN-exposed API bypassing the TLS edge | `127.0.0.1:` prefixes |
| INF-7 | Portal Dockerfiles (no `ARG VITE_API_URL`) + `apiClient.ts:8` | Same-origin `/api` works only behind the edge; direct :3000/:3001 (which INF-6 publishes!) 404s every call | Build-arg or stop publishing portal ports |
| INF-8 | `.github/workflows/ci.yml:32-35` | Flutter `channel: stable` floats (analyzer/test drift week-to-week); node unpinned minor | Pin exact versions |
| INF-9 | `check-test-integrity.mjs:50-61` | Integrity guard never scans `services/backend_api/scripts/` (18 suites) or `prisma/`; `it.each` undercounted | Add script areas (skip/tautology checks) |

### 2.8 Medium & Low (consolidated index — 105 findings)

Full detail available from the six platform scans; grouped here by theme with representative locations:

- **Security/hardening (M):** coupon-validate unauthenticated+enumerable (`coupon.controller.ts:11`); SMS-send failure ignored → "OTP sent" lie (`auth.service.ts:76`); `/health` leaks raw DB/Redis errors publicly; gateway creds in GET query strings (SMS + SSLCommerz validator); no `@IsUUID` on any `:id` param (all controllers); `KEYS` in request path + swallowed catch on suspension revocation (`admin-customers.service.ts:246,254`); non-constant-time sandbox HMAC compare; `ALLOW_STATIC_OTP` validated-but-never-read; socket clients cache user status for connection lifetime (suspension doesn't kick sockets); single fcmToken per user (second device kills first).
- **Money/logic (M):** deposit check-then-create race (`rider.service.ts:304`); duplicate productId lines → misleading checkout error; checkout DTO missing `@Max(quantity)`, `@ArrayMaxSize`, `@MaxLength(notes/coupon)` (Decimal-overflow 500 / DoS); non-tx staff promote/demote + coupon falsy-zero (BE-5) + operating-hours vendor path (CR-4) — rule §3.2 violations; `deliverOrder` PAID-with-zero-cash (BE-10); deposit response duplicate `cashInHand`/`remainingCashInHand`; ledger-detail fallback returns commission `0` instead of null; geo-cache unbounded user-controlled Redis keys; seed reconciliation blind spots (payments existence, FSM legality, cashInHand ≤ limit, coupon uses ≤ limit); backup script exits 0 on offsite failure; `--no-owner` missing in pg_dump.
- **Performance (M):** per-GPS-tick `systemSetting.findUnique` uncached ×1000 riders (`tracking.gateway.ts:326-350`); `getSalesLedger` unbounded heavy join (also VP-3); `getRiderProfile` runs 2 aggregates in every hot path; per-item `orderItem.create` loop → `createMany`; analytics windows pull all rows into JS; fee-config default uncached; `EVAL` per lock release → `EVALSHA`; CSV export unbounded in memory; fleet radar/overview unbounded counts; getLiveOrders duplicate RBAC round-trips.
- **Consistency/contract (M/L):** pagination envelope vs customer `hasNextPage` ghost field; `getAllVendors` list omits `typeId/type/orderFlowMode` the FE types require; duplicate read surface `GET /admin/settings/dispatch` unconsumed; `DELETE /admin/outlets/:id` alias unconsumed; `GET /auth/me` unconsumed; WS legacy `order:status_changed` underscore listeners in both Flutter apps; gateway `error`/`connected` events nobody listens to; TID-03 missing 2 routes (pause, outlet-delete alias); TID-04 payload shapes wrong for `order:rider:moved`/`rider:location`; FEATURES claims: rating (nonexistent), multi-currency (hardcoded ৳); dual haversine impls with different rounding; rider-share formula ×4; in-flight status array ×5; admin fee surfaces disagree (BE-4).
- **Frontend quality (M/L):** socket-subscription hook re-subscribes every render (unstable deps ×3 admin pages); Leaflet marker layer rebuilt per render + fitBounds fights panning; settings/deep-link/order-page effect dep instability; per-portal duplicated formatters/status-maps/copy-phone; no focus trap in any Modal/Drawer (both portals); single global error boundary (no per-route); double-submit gap on promotions delete; silent brand-delete close; parseFloat-silent-defaults on commission/coupon inputs; setTimeout-after-unmount ×4; dead `AuthProvider`/`filterFleet`/i18n keys; KDS prep-time picker defaults 20 ignoring outlet default; ledger custom range allows start>end; no ledger CSV export (vendor portal); vendor npm `test` requires live stack.
- **Mobile (M/L):** search debounce race + timer not disposed; coverage revalidate race; catalog provider not autoDispose (lifetime menu cache); session-expired listener re-registration leak + dead `onTokenRefresh` API; refresh Dio without timeouts; phone validation `length>=9` accepts letters; hotline placeholder hardcoded; address controllers undisposed + silent empty-save; `launchUrl` unguarded; no app-links intent filter (deeplinks internal-only); manifest backup flags; magic spacing ×37 + raw colors in suspended-card; dead `_beaconTimer`/`_telemetryTimer`; weekly earnings fabricated = today's; deposit failures never rendered (`dutyState.error` zero consumers); 600ms fake latency in approval refresh; sandbox auto-fill absent; expired-session leaves pushed routes.
- **Naming/comments/tests/docs (L):** see §3.5 rename list & §3.7 comment list. Highlights: notifications controller mounted at `@Controller('auth')`; `escalation:test` script runs FCM suite; vendor `kdsApi` carries sales/settings/catalog; 9 backend files >400 lines (admin.service 2269); 6 admin + 1 vendor + 7 Flutter files >400; trivial/no-op comments ~25 spots; `AGENT_RULES.md` §2.8 still describes retired global `order_flow_config` and §1 ADR range stale at 018; jest `payments.service` floor 50%; several test names violate behavior-naming (rider smoke tests, customer "Step 1.x" names).

⚠ Needs confirmation (2): MOB-4 Android-14 FGS crash (needs API-34 device); admin dashboard timezone label alignment with backend bucketing zone (F-28).

---

## 3. Remediation Plan (Phase 3)

Six phases; each ends with its verification gate (`npm run verify` + affected integration tracks + new tests). Nothing in later phases depends on earlier *naming* work; sequencing is risk-first.

### Phase 0 — Gates & Truth (make CI honest) — *day 1*
1. **CR-1**: CI starts the compiled API (health wait) before `npm test`; run the chain — fix whatever it exposes. *(Gate: CI green on a PR that intentionally breaks a money path → must go red.)*
2. INF-9: integrity guard scans `scripts/` + `prisma/` (skip/tautology only).
3. INF-8: pin node/flutter versions.
**Verify:** CI green ×2 consecutive runs; guard catches a planted `console.assert`-style hollow test.

### Phase 1 — Security & validation — *days 2-4*
1. CR-2 XSS → DOM-built popups (+ CSP note). 2. CR-4 + S02/S03 DTOs & tx (shared `OperatingHourDayDto` for admin+vendor). 3. BE-2/BE-3 strip commission leaks (public nearby + checkout response; add contract tests). 4. BE-11 atomic refresh rotation (+ reuse detection test). 5. XP-2 mobile logout revocation. 6. S05 coupon-validate auth, S06 SMS-failure honesty, S08 health redaction, S09 POST credentials, S10/S11/S12/S13 small guards, INF-6/INF-7 port-binding + build-arg.
**Verify:** new specs (popup escaping, DTO rejections, checkout payload field allow-list, rotation race); manual: `curl` nearby/checkout without commission fields; containers reachable only via edge.

### Phase 2 — Money & dispatch correctness — *days 5-8*
BE-1 GEO key unification (+ fleet visibility integration case) · BE-3 post-commit dispatch isolation · BE-4/BE-5 fee & coupon constants/falsy-zero · BE-7 claim re-guard · BE-8 forceAssign parity (tx + cash-limit + takeaway refusal) · BE-9 signup tx · BE-10 PAID-with-zero-cash · B11 deposit race · B13/B14 checkout dedupe + DTO bounds · CR-3 rider fail-closed duty (+ MOB-1 modal expiry pop + broadcast queue) · INF-2 seed FSM-legality + stronger reconciliation · INF-3/4/5 script hygiene (service-API cancels, persona fixes, assert the 3 silent invariants) · XP-1 casing normalization.
**Verify:** the missing money-path specs land here (see §3.6 T-list); dispatch-FSM + cancellation + settlement tracks re-run green; seed reconciliation passes with new asserts.

### Phase 3 — Frontend & mobile reliability — *days 9-13*
Admin: ADM-1 hooks, ADM-2/3 cache keys & invalidation, ADM-6 (both portals) Tailwind-v4→v3 mapping, per-route error boundaries, focus traps, double-submit gaps, input validation, marker-layer memoization, unstable-effect deps. Vendor: VP-1 chime lifecycle, VP-2 rush-pause target outlet, VP-3 ledger server-pagination + `placedAt` region-local filter, VP-4/5/8 error surfaces + hours validation, VP-18 socket-reconnect refetch, VP-23 prep-time default. Mobile: MOB-2 session expiry, MOB-3 GPS throttle to spec, MOB-5 release fail-fast, MOB-6 reorder pricing, MOB-7 checkout/coverage gating + fee-unknown state, MOB-8 tracking error state, MOB search/coverage races, catalog autoDispose, R-05 weekly earnings from server, R-06 deposit error surfacing, dead-code & timer cleanups.
**Verify:** jsdom component/hook suites (§3.6) green on both portals; flutter analyze/test green; manual smoke of each fixed flow on the seeded stack.

### Phase 4 — Realtime & contract cleanup — *days 13-15*
XP-3/4/5: wire or remove dead events (+ TID-04 rewrite of payloads); W4/W5 underscore/`error` listeners; P3 `hasNextPage`; E1/E3/E4 dead read/alias endpoints decided (consume or delete — default: delete aliases, keep `/auth/me` documented); INF-1 nginx resolvers; XP-6 i18n decision executed (scope claim or fund admin/rider extraction — recommended: scope claim now, backlog extraction).
**Verify:** event-emitter/listener matrix test (grep-based script in CI); edge recreate test (docker restart backend → no 502); docs diff clean.

### Phase 5 — Consolidation, simplification, naming, comments, docs — *days 16-20*
Execution order respects dependencies (shared helpers before renames; renames before docs):

**(a) Duplication → single source of truth** (within-platform only; cross-platform duplication stays per ADR-001, governed by the conventions doc from Phase 4 of the docs plan):
1. Backend: `computeRiderEarnings()` (kills ×4 formula), `isTakeawaySnapshot()` (×2), reuse `haversineKm` (kills gateway copy — fixes rounding drift), shared `IN_FLIGHT_STATUSES` (×5 → the already-exported admin-fleet constant), `coverageCheck()` helper (×2 SQL blocks), shared `OperatingHourDayDto` (from Phase 1), outlet-access resolver `resolveAccessibleVendorIds` (kills duplicate RBAC round-trips).
2. Scripts: one `scripts/harness.ts` — `withApp()`, `login()`, `requestJson()`, `FIXTURES` constants (phones/outlets/coupons/OTP) — adopted by all 18 suites (retires ~300 duplicated lines + the fixture-coupling class).
3. Admin portal: shared drawer formatters/status-map/copy-phone into `utils/`+`components/common/`; single `STATUS_BADGE_VARIANT`.
4. Customer app: route all errors through `ApiErrorHandler` (port to rider app too).

**(b) Over-engineering reductions:** delete dead interface member `queryTransaction` (×2 impls) or wire a poll fallback (recommend delete); drop `busyReason`, `AssignVendorStaffDto.role`, `toggleDuty.speed`, service-signature `isActive`; delete `getAllBrands`, `AuthProvider` (both portals), `filterFleet`, dead `_beaconTimer`/`_telemetryTimer`, `unlockAudio` (or wire it), `onTokenRefresh` API, dead i18n keys; retire `GET /admin/settings/dispatch` (combined endpoint is canonical) and `DELETE /admin/outlets/:id` alias; `vendor npm test` → vitest only (integration scripts renamed `verify:*`).

**(c) Naming standardization** — one convention guide (see docs plan D-8) then renames in dependency-safe order (backend route/module renames first with FE clients updated in the same commit; test renames anytime; pure-rename commits carry no behavior change):

| Old | New | Files affected |
|---|---|---|
| `NotificationsController @Controller('auth')` | `@Controller('auth/device-token')` (or notifications path) | notifications.controller.ts, TID-03 |
| `escalation:test` npm script | `fcm:test` | backend package.json, docs |
| `kdsApi.getSalesLedger/getOutletSettings/getCatalog...` | split `salesApi`/`settingsApi`/`catalogApi` under `services/` | vendor portal (VP-13 split does this) |
| `db:test`…`track3:test` scripts | `test:db`…`test:track3` (verb:noun standard) | backend package.json, CI, docs |
| `rider_earnings_screen` weekly/today mirrors | `earningsThisWeek` server-sourced field | rider app |
| `depositCash` response `remainingCashInHand` | `pendingDepositTotal` | rider.service.ts + rider app parse |
| dead DTO fields (`busyReason`, `role`, `speed`) | *(deleted — no rename)* | backend + FE senders |
| `hasNextPage` ghost parse | `totalPages`-based `hasNext` | customer order_history_provider |
| Rider/widget test names (`widget_test.dart`, `core_widgets_test`, `design_system_test`, `payment_cart_preservation` "Step 1.x" groups) | behavior names ("app entry renders phone login…", "currency formatter renders BDT…", "checkout preserves chosen payment method…") | both apps' test dirs |
| `adminPortal` `admin.title`-family dead keys | deleted or wired (with ADM-4 extraction) | admin i18n ×3 |
| AGENT_RULES §2.8 `order_flow_config` text | per-outlet `orderFlowMode` + `dispatch_config` | AGENT_RULES.md |
| AGENT_RULES §1 ADR range `ADR-018` | `ADR-019` | AGENT_RULES.md |

**(d) Comment cleanup:** strip ~25 trivial banners ("// 1. Fetch customer", "Side Effects outside DB transaction:", numbered service step banners, the catch-justifying comment at `admin-customers.service.ts:255`); add 4 missing why-comments: coupon-exceeds-subtotal clamp (`order.service.ts:353`), refund epsilon (`payments.service.ts:269`), static-OTP conditions (`auth.service.ts:108`), GPS cadence choice (mobile, post MOB-3).

**(e) Modularity (rule §3.8)** — split the 9 oversized backend files (admin.service → catalog/settings/settlement sub-services mirroring the existing fleet/finance/customers pattern; `vendor-staff` → ledger+settings split; `order.service` → checkout/detail/cancellation), 6 admin components (shared `DetailMetricCard`/`CollapsibleSection`), VendorLayout banners component, 7 Flutter screens (address form sheet, tracking cancel dialog, map presets). *Behavior-neutral; gated by Phase 2/3 tests.*

### Phase 6 — Final hardening & release — *days 20-23*
P01 GPS-tick config caching · P02/P05/P08 query aggregation/streaming · P03 profile split · P06 default caching · P07 EVALSHA · X01 cache invalidation story (documented or Redis-backed) · X02 rider-marker TTL + order-number fallback strategy · X03 lazy CORS + socket suspension kick · X04 device-token table (or documented single-device limit) · R04 refresh-token cookie decision (ADR) · backup exit-codes + `--no-owner` · certbot restart policy · F-29 ledger FKs → RESTRICT (ADR change) · F-30/31 enums + CHECK constraints (migration) · F-32 composite indexes for scans.
**Verify:** load smoke (1k rider sim → tick path DB reads ≈ 0), backup-restore drill, chaos: recreate backend under edge (no 502), kill Redis (graceful degradation paths logged).

### 3.6 Missing-test plan (priority order; every Phase 1-3 fix ships with its row here)

| # | Platform | Test case (behavior-named) | Covers | Priority |
|---|---|---|---|---|
| T1 | BE | "checkout rejects out-of-coverage address (422)", "checkout enforces single-vendor cart", "checkout clamps coupon discount below subtotal", "checkout retries order-number collision (P2002) and succeeds", "checkout response excludes vendor commission fields" | BE-3 + T01 gap | P0 |
| T2 | BE | "deliverOrder marks PAID only when COD cash collected > 0", "deliverOrder clamps collected amount and credits cashInHand", "trip ledger upsert is idempotent per order" | BE-10 + T02 gap | P0 |
| T3 | BE | "verifyCashDeposit approves exactly once under concurrent admins", "guarded decrement never drives cashInHand negative", "settlement cycle claims each ledger exactly once; batch math balances" | T03 gap | P0 |
| T4 | BE | "refresh rotation: second concurrent refresh loses and revokes family" · "rider signup under concurrent OTP verify creates one user" | BE-11/BE-9 | P0 |
| T5 | BE | "operating-hours update rejects malformed times and rolls back all days" (vendor path) · "outlet settings reject negative prep time" | CR-4 | P0 |
| T6 | BE | "force-assign refuses in-flight rider, COD-over-limit courier, and takeaway orders" | BE-8 | P1 |
| T7 | BE | "nearby projection leaks no commission fields" (contract test) · "public types omit deactivated outlet types" | BE-2 + regression net | P1 |
| T8 | ADM | apiClient "401 triggers single-flight refresh and replays original request"; "expired bootstrap token rotates before first call"; socket "reconnect re-reads rotated token" | ADM-5 security paths | P0 |
| T9 | ADM | LiveFleetMap "renders rider name with HTML markup as text" | CR-2 regression | P0 |
| T10 | VP | useKDSOrders "maps each OrderStatus to correct lane", "stops alarm on unmount/logout", "rolls back optimistic lane move on FSM 409" | VP-6 | P0 |
| T11 | VP | "rush pause toggles the target outlet, not the global one"; ledger "TODAY bounds use region-local midnight on placedAt" | VP-2/VP-3 | P1 |
| T12 | MOB-rider | "duty toggle fails closed on network error", "expired trip modal pops and blocks accept", "second broadcast while alert pending is queued" | CR-3/MOB-1 | P0 |
| T13 | MOB-rider | "session expiry resets navigation to login"; "deposit failure surfaces error state" | MOB-2/R-06 | P1 |
| T14 | MOB-customer | "reorder uses server-validated prices", "checkout blocked until coverage resolves", "coupon revalidated on subtotal change", "tracking fetch failure shows retry not fake order", "stale search response discarded" | MOB-6/7/8/15 | P0 |
| T15 | XP | CI script: emitter↔listener matrix for all WS events (fails on zero-listener emitters or dead listeners) | XP-3/4/5/W4 class | P1 |

### 3.7 Verification per fix (standard)
Every fix commit: (1) new/updated unit or component test from §3.6; (2) `npm run verify` green; (3) affected integration track(s) re-run against reseeded stack; (4) docs touched per §4 sync rules; (5) for Phase 5 renames — grep-sweep across `context_docs/` + all 5 apps in the same PR.

### 3.8 Final production-readiness checklist
- [ ] CI integration job boots the API; intentionally-broken money test turns CI red (CR-1)
- [ ] No HTML string interpolation of server data anywhere (CR-2)
- [ ] Duty-online is server-confirmed; dispatch GEO key unified; fleet-visibility case in integration suite (CR-3/BE-1)
- [ ] All vendor mutations validated + transactional (CR-4)
- [ ] No commission/vendor financials in any public or customer payload (BE-2/3)
- [ ] Refresh rotation atomic + reuse-detecting; mobile logout revokes (BE-11/XP-2)
- [ ] Checkout/deliver/verify-deposit/settlement money specs green (T1-T3)
- [ ] Edge survives backend recreate (INF-1); ports loopback-only; portals edge-only (INF-6/7)
- [ ] Seed data FSM-legal; reconciliation asserts cover payments/FSM/limits (INF-2)
- [ ] Zero Tailwind-v4-only classes on TW3 (ADM-6); focus traps in dialogs; per-route error boundaries
- [ ] Rider app: session expiry, GPS 5-8s cadence, Android-14 FGS verified on device, localized or claim-scoped (XP-6)
- [ ] No zero-listener WS emitters; TID-04 payload examples match code (XP-3/4/5)
- [ ] Dead endpoints/fields/keys deleted; naming guide + rename table executed; comments lean (Phase 5)
- [ ] Perf smoke at 1k riders; backup-restore drill passed; chaos tests passed (Phase 6)
- [ ] All docs single-sourced and code-matched (§4); AGENT_RULES drift fixed

---

## 4. Documentation Plan (Phase 4 of request)

**Principle:** every fact lives in exactly one place; everything else links. Current duplication to retire: settings semantics (AGENT_RULES §2.8 vs ADR-002 vs TID-03 vs FEATURES), endpoint lists (TID-03 vs FEATURES test table), event payloads (TID-04 vs code comments).

| Doc | Single source of truth for | Changes needed |
|---|---|---|
| D-1 `context_docs/AGENT_RULES.md` | Engineering rules, DoD, conventions pointer | Fix §2.8 flow-mode text + §1 ADR range; link (not duplicate) naming/testing standards |
| D-2 `prisma/schema.prisma` + `TID-02` | Data model (schema authoritative; TID-02 renders it) | Keep in lockstep; TID-02 already rewritten — add FK-policy + enum tables after Phase 6 |
| D-3 `TID-03` | Every HTTP route + payload + error codes | Add missing routes (pause, outlet-delete decision), fix dispatch casing doc, retire deleted routes as they go |
| D-4 `TID-04` | Every WS event, room, payload | Rewrite payload examples to code (XP-3/4/5 fixes); add emitter↔listener matrix reference |
| D-5 `ADR suite` | Why-decisions (one per decision) | New ADRs: ledger FK policy (F-29), token-storage posture (R04/R-16), cache-invalidation strategy (X01); amend ADR-014 with payments floor raise |
| D-6 `README` + `QUICK_REFERENCE` | Setup, run, verify, reset commands (one copy each) | Consolidate duplicated command blocks; add CI-truth note |
| D-7 `FEATURES.md` | Capability claims + test traceability | Remove rating/multi-currency/trilingual claims or mark roadmap; sync after every phase |
| **D-8 (new) `context_docs/CONVENTIONS.md`** | Naming (routes kebab + verb-noun table, events colon-kebab, DB snake_case, DTOs `*.dto.ts`, tests behavior-named, FE per-app duplication rules incl. `formatCurrency` spec & error-parser contract), commenting rules, testing standards | One place; AGENT_RULES/ADRs link here instead of restating |
| D-8b Release runbook (new, `deploy/RELEASE.md`) | Deploy/rollback/backup-restore/chaos drills | From Phase 6 outputs |

**Sync process (already rule §8.2 — make it mechanical):** the per-phase Definition-of-Done adds "docs diff touched for every route/event/schema/claim changed"; the Phase-4 WS-matrix CI script and a small route-diff script (routes in code vs TID-03 table) run in CI as doc-drift gates.

---

*End of audit. No code was modified. Awaiting approval to begin Phase 0.*
