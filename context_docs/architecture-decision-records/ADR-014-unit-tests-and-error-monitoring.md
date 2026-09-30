# ADR-014: Unit Test Toolchain (Jest) & Error Monitoring (Sentry)

## Status
**Accepted** (2026-09-28)

---

## Context & Problem Statement
The production-readiness hardening effort (2026-09) required two capability additions that introduce new dependencies:

1. **Money-path unit tests**: the backend's integration suites are excellent but require a live Postgres/Redis stack, so CI could not run any backend tests. Pure-logic invariants (FSM transitions, timezone-correct operating hours, coupon limit races, webhook idempotency claims) need fast, dependency-free tests that run in every build.
2. **Error monitoring**: structured logs and request IDs (ADR-012) help when someone is looking, but production failures in five deployable artifacts (backend, two portals, two Flutter apps) must proactively reach an operator with stack traces, release, and context.

---

## Decision

### Unit Testing
- **Jest + ts-jest** is the backend unit-test toolchain (`npm run test:unit`), scoped to `src/**/*.spec.ts` so seed/script tooling stays out.
- The root `verify:backend` gate (and therefore CI) now runs unit tests — the quality gate no longer requires infrastructure.
- **Vitest** is the web-portal unit-test toolchain (`npm run test:unit` in each portal, `src/**/*.test.ts`), wired into `verify:web`; Flutter apps keep `flutter test` in `verify:mobile`.
- Money/security-path units under enforced per-file coverage floors (`services/backend_api/jest.config.mjs`):
  - ADR-002 state machine (legal/illegal transitions, terminal absorption, claimability per dispatch mode) — 100%.
  - Auth: OTP issuance + rate limit, brute-force lockout, static-OTP mock gating, signup role whitelisting, account-status blocks, refresh-token rotation/revocation.
  - Guards: `JwtAuthGuard` (refresh-as-access rejection, inactive users, cache behavior) and `RolesGuard` (SUPER_ADMIN bypass, deny 403).
  - Order-flow dispatch: `handleOrderPlaced` routing (unpaid ONLINE_GATEWAY withholding, TAKEAWAY kitchen-only, RIDER_FIRST broadcast with server-computed rider earnings vs VENDOR_FIRST chime), `claimOrder` guards (offline/unapproved/busy/cash-limit/mutex), and the two-tier escalation sweep with idempotency markers.
  - Payments: webhook idempotency claim (first-time, concurrent replay, unknown 404, amount mismatch, stranded-charge rescue, COD-switch reconciliation), `initiatePayment` validation guards, `getPaymentStatus` ownership, and the expired-payment sweep's claim-then-reconcile cancellation (coupon rollback, pending-ledger cleanup, lost-claim skip).
  - Pricing: coupon eligibility + discount math (percentage cap, flat cap at subtotal, rounding), delivery-fee config normalization, computation, caching, and DB-failure fallbacks; financial rounding utils.
- Full system behavior (checkout transactions, settlement, end-to-end lifecycle) remains covered by the live-DB integration suites, which stay manual/nightly — unit tests do not replace them.

### Test-Integrity Guard (anti-bypass gate)
`scripts/check-test-integrity.mjs` (root `verify:tests`, first step of `npm run verify`) fails the build on:
1. A missing or trivial (< 2 test cases) required money-path spec file.
2. Skip/only/todo markers or disabled suites in any Jest/Vitest/Flutter test file (Dart is not covered by ESLint).
3. Tautological assertions (`expect(true)`).
4. A suite area's total test count dropping below its recorded floor (deleting or hollowing out tests cannot pass silently).

ESLint (`services/backend_api/eslint.config.mjs`) additionally bans `.skip`/`.only`/`.todo`/`xit` markers in TS specs at lint time. Weakening any gate — lowering thresholds or floors — requires an explicit, reviewable edit to the enforcing config file.

### Error Monitoring
- **Sentry** is adopted across all five artifacts, strictly env-gated so no DSN means zero behavior change:
  - Backend: `@sentry/node` initialized from `SENTRY_DSN`; the global exceptions filter reports only unexpected 5xx failures (deliberate `HttpException` API outcomes are not bugs) with request-id and path context.
  - Portals: `@sentry/react` initialized from `VITE_SENTRY_DSN` (build-time); Sentry's error boundary wraps the app boundary so failures are both remotely captured and shown through the branded UI.
  - Flutter: `sentry_flutter` initialized from `SENTRY_DSN` `--dart-define`; environment is `debug`/`release` per build mode.

---

## Consequences

**Positive**
- CI runs real money-path invariant tests on every push with no infrastructure.
- Any production 5xx, portal crash, or mobile exception reaches the operator with full context once a DSN is configured.
- The timezone class of bug (server-UTC vs vendor-local hours) is now pinned by tests.
- Web portals gained hermetic unit suites (formatters, error extraction, class merge, auth/outlet stores) that previously had none.
- Deleting, skipping, or hollowing out tests fails CI through redundant guards (lint + integrity script + coverage floors + count floors).

**Negative / Trade-offs**
- New dependencies (jest, ts-jest, vitest ×2 portals, @sentry/node, @sentry/react ×2 portals, sentry_flutter ×2 apps) increase install surface.
- Sentry without a configured DSN is inert — configuring it is an operational prerequisite for the monitoring benefit, listed in `.env.example`.
- Test-count floors are baselines that must be raised as suites grow; an occasional deliberate reduction requires a conscious edit to the guard script.

## Related
- [ADR-012](./ADR-012-production-security-hardening-and-fail-fast-config.md) (structured logging foundation this builds on)
