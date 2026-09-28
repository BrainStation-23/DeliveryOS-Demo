# ADR-014: Unit Test Toolchain (Jest) & Error Monitoring (Sentry)

## Status
**Accepted** (2026-09-28)

---

## Context & Problem Statement
Wave 3 of the [Production Readiness Plan](../../docs/PRODUCTION_READINESS_PLAN.md) required two capability additions that introduce new dependencies:

1. **Money-path unit tests**: the backend's integration suites are excellent but require a live Postgres/Redis stack, so CI could not run any backend tests. Pure-logic invariants (FSM transitions, timezone-correct operating hours, coupon limit races, webhook idempotency claims) need fast, dependency-free tests that run in every build.
2. **Error monitoring**: structured logs and request IDs (ADR-012) help when someone is looking, but production failures in five deployable artifacts (backend, two portals, two Flutter apps) must proactively reach an operator with stack traces, release, and context.

---

## Decision

### Unit Testing
- **Jest + ts-jest** is the backend unit-test toolchain (`npm run test:unit`), scoped to `src/**/*.spec.ts` so seed/script tooling stays out.
- The root `verify:backend` gate (and therefore CI) now runs unit tests — the quality gate no longer requires infrastructure.
- Covered invariants: the ADR-002 state machine (legal/illegal transitions, terminal absorption, claimability per dispatch mode), region-time operating-hours math (same-day and overnight windows; Asia/Dhaka rollover proving vendor-local time rather than server UTC), coupon eligibility (exhaustion, inactive, unknown) feeding checkout's atomic `updateMany` claim, and the webhook idempotency claim (first-time processing, concurrent-replay skip, unknown-payment 404).
- Full system behavior (checkout transactions, settlement, end-to-end lifecycle) remains covered by the live-DB integration suites, which stay manual/nightly — unit tests do not replace them.

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

**Negative / Trade-offs**
- Four new dependencies (jest, ts-jest, @sentry/node, @sentry/react ×2 portals, sentry_flutter ×2 apps) increase install surface.
- Sentry without a configured DSN is inert — configuring it is an operational prerequisite for the monitoring benefit, listed in `.env.example`.

## Related
- [Production Readiness Plan — Wave 3](../../docs/PRODUCTION_READINESS_PLAN.md)
- [ADR-012](./ADR-012-production-security-hardening-and-fail-fast-config.md) (structured logging foundation this builds on)
