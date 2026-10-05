# ADR-012: Production Security Hardening — Fail-Fast Configuration, Rate Limiting & Authenticated Realtime Rooms

## Status
**Accepted** (2026-09-28)

---

## Context & Problem Statement
The production-readiness hardening effort (2026-09) identified security gaps that made the platform unsafe for real traffic:

1. **Forgeable credentials**: JWT secrets had hardcoded fallbacks in three code paths and as Docker Compose defaults, allowing anyone with repo access to mint admin tokens.
2. **Fail-open webhooks**: Payment adapters accepted literal bypass signatures (`test-signature`, `sandbox-bypass-valid`) and treated missing gateway credentials as "skip verification" — any unsigned webhook could mark orders `PAID`.
3. **Unauthenticated realtime rooms**: Any authenticated socket client could `order:join` any order room (cross-customer telemetry/status leak).
4. **No transport hardening**: Wildcard CORS with credentials, no security headers, no rate limiting on OTP/webhook/geo endpoints, Swagger exposed in production.
5. **Silent failures**: Unvalidated environment variables, no structured logs, no request correlation, no graceful shutdown, and `docker-compose.prod.yml` referenced uncommitted TLS assets.

---

## Decision

### 1. Fail-Fast Environment Contract
- `ConfigModule` validates the environment via a Joi schema at boot: `JWT_SECRET` / `JWT_REFRESH_SECRET` (min 32 chars), `DATABASE_URL`, `REDIS_URL` are required in **all** environments; missing variables abort startup.
- In `NODE_ENV=production`: `SMS_MOCK_STATIC_OTP` and `ALLOW_STATIC_OTP` are **forbidden**, `SMS_PROVIDER` is required and must not be `mock`, and the `SANDBOX` payment gateway is rejected per request.
- All secret fallbacks are deleted from code, compose files, and `.env.example` (placeholders only). Compose declares secrets as `${VAR:?required}` so the stack cannot boot on defaults.
- Dev-only conveniences (mock SMS, static OTP, sandbox gateway, Swagger `/docs`) remain available strictly in non-production environments.

### 2. Webhook & Transport Security
- Webhook validation is **fail-closed**: signature checks compare against the configured gateway secret only; no bypass literals, no skip-on-missing-credentials.
- Helmet is applied globally; CORS is an explicit origin whitelist (`CORS_ORIGINS`, defaulting to localhost dev origins) instead of `*` with credentials — on both HTTP and the Socket.IO gateway.
- `@nestjs/throttler` is a global guard (100 req/min per IP) with tightened limits: OTP request 5/min, OTP verify 10/min, payment webhook 30/min, geo + address-coverage proxies 30/min.
- Swagger is gated to non-production.

### 3. Realtime Room Authorization
- `order:join` is authorized per caller against the order record: customers only join their own orders, riders only their assigned trip, vendor staff only their outlet (or brand-scoped master scope), super admins unrestricted. Denied joins receive an explicit `error` event and never enter the room.

### 4. Deploy Correctness & Observability
- `docker-compose.prod.yml` renders TLS config from `nginx-templates/default.conf.template` (envsubst, Let's Encrypt webroot via a certbot renewal service); the bootstrap procedure lives in `deploy/README.md`.
- All containers run non-root (backend `USER node`; portals on `nginxinc/nginx-unprivileged` listening on 8080); JSON log rotation and memory limits are declared in compose.
- **Database Schema Baseline**: The database initializes from the schema-exact `0_init` baseline (including PostGIS extensions and GiST expression indexes). The backend container runs `prisma migrate deploy` on every startup, preventing schema drift.
- `app.enableShutdownHooks()` guarantees Prisma/Redis disconnect on SIGTERM.
- Structured JSON logging via winston with an `AsyncLocalStorage` request-id middleware (`x-request-id` echoed on responses); the global exception filter logs status, path, request id, and stack trace for every 5xx.

---

## Consequences

**Positive**
- The exploit class "read the repo → forge tokens / spoof payments" is eliminated; misconfiguration aborts boot instead of failing open at runtime.
- OTP, webhook, and proxy endpoints resist brute force and relay abuse.
- Cross-customer realtime leaks are impossible without a matching ownership record.
- Production deploys are reproducible: required env, TLS bootstrap, migrations, and log correlation are documented and automated.

**Negative / Trade-offs**
- Booting any environment now requires the four mandatory variables (previously optional).
- The `SANDBOX` gateway and static OTP cannot be used for production-shaped smoke tests; real gateway credentials are needed to exercise prod mode.
- Global rate limiting requires clients to tolerate `429` (batch GPS/telemetry calls where possible — already planned in Wave 2).
- Non-root nginx portals changed their internal port to 8080 (compose healthchecks and edge upstreams updated together).

## Related
- [ADR-011](./ADR-011-multi-gateway-online-payment-and-webhook-idempotency.md) (webhook verification now fail-closed)
- [ADR-005](./ADR-005-micro-frontends-and-subpath-routing.md) (edge routing now TLS-terminated)
