# DeliveryOS — AI Context Router & Quick Reference

> **Read this file first.** Route to the exact 1–2 files you need — never load the whole `context_docs/` tree.
> Every code change follows the **3-Phase Spec-Driven Workflow**: [README.md](../README.md#-spec-driven-development-workflow-3-phase-protocol). Rules & DoD: [AGENT_RULES.md](./AGENT_RULES.md).

---

## 1. Repo Facts (Verified Against Code)

| Fact | Value |
| :--- | :--- |
| Monorepo | `services/backend_api` (NestJS 10, Prisma 5, port 4000) • `apps/admin_portal` + `apps/vendor_portal` (React 18 + Vite + Tailwind + Zustand + TanStack Query, dev servers 3000/3001 via `npm run dev`) • `apps/customer_app` + `apps/rider_app` (Flutter, Riverpod 3, Dio, socket_io_client) |
| No shared packages | Portals and Flutter apps intentionally duplicate `core/`/UI primitives per app; do not extract cross-app packages without an ADR |
| Datastores | PostgreSQL 16 + PostGIS 3.4 on **localhost:5433** • Redis 7.2 on **localhost:6380** (dev binds 127.0.0.1) |
| API surface | Global prefix **`/api/v1`**; Socket.IO namespace **`/events`** (JWT handshake auth); Swagger at `/docs` (non-production only) |
| Auth | Phone OTP only — **no passwords anywhere**. Access JWT 15m + rotating refresh JWT 30d (Redis jti revocation). Guards: `JwtAuthGuard`, `RolesGuard` + `@Roles()`, global `ThrottlerGuard` |
| Payments | SSLCommerz (real) + Sandbox gateway (dev only, HMAC-signed webhooks) + COD. **No bKash/Stripe/Moyasar adapters** |
| Env contract (fail-fast) | Required: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (≥32), `JWT_REFRESH_SECRET` (≥32). Forbidden in production: mock SMS, static OTP, sandbox gateway |
| Edge | Nginx 8080: `/` → admin, `/vendor/` → vendor, `/api/v1/` + `/docs` + `/uploads/` → backend, `/socket.io/` + `/events/` → backend (WS upgrade). TLS via certbot in prod compose |

### Commands

| Task | Command |
| :--- | :--- |
| Full quality gate (CI-identical) | `npm run verify` (root) = backend typecheck+lint+test:unit+build, portal typechecks+builds, `flutter analyze`+`flutter test` ×2 |
| Boot local infra | `./scripts/start-local.sh` (or `docker compose -f deploy/docker-compose.yml up -d postgres redis`) |
| Migrate + seed | `npx prisma migrate dev` then `npm run prisma:seed` (or `prisma:seed:massive`) in `services/backend_api` |
| Backend integration suites (needs live stack) | `npm test` in `services/backend_api` (chains 18 `*:test` scripts: `auth:test`, `order:test`, `dispatch:test`, `payment:test`, `settlement:test`, `cancel:test`, `track1:test`, `track3:test`, …) |
| Backend unit tests (no DB needed) | `npm run test:unit` in `services/backend_api` (Jest, `src/**/*.spec.ts`) |
| Portal smoke tests (live API) | `npm test` in each portal (tsx assertion scripts) |
| Release AAB | `./scripts/build-android.sh customer|rider` (dart-define injection) |
| DB backup / restore | `./scripts/backup-db.sh` / `./scripts/restore-db.sh` |

### Seeded Dev Accounts (OTP `123456` via `SMS_MOCK_STATIC_OTP`)

- Super Admin: `+8801700000001` • Vendor branch manager: `+8801700000002` • Brand owner: `+8801700000003`
- Seed catalog: brand **Burger Point** (Gulshan + Dhanmondi outlets), **FreshMart Daily Super Shop** (Gulshan Hub); coupons `WELCOME50`, `BURGER20`

---

## 2. Task → Document & Code Router

| If Your Task Involves… | Load Docs | Key Code Paths |
| :--- | :--- | :--- |
| Workflow / DoD / commit rules | [AGENT_RULES.md](./AGENT_RULES.md) | — |
| Feature inventory & traceability | [FEATURES.md](../FEATURES.md) | — |
| Release history & roadmap | [CHANGELOG.md](../CHANGELOG.md) | — |
| Monorepo topology & ingress | `ADR-001`, `ADR-005`, `TID-01` | `deploy/nginx.local.conf`, `deploy/nginx-templates/` |
| Database schema, migrations | `TID-02` | `services/backend_api/prisma/schema.prisma` (22 models), `prisma/migrations/` |
| REST endpoints & DTOs | `TID-03` | `services/backend_api/src/modules/*/**.controller.ts` |
| WebSocket rooms & events | `TID-04` | `src/modules/realtime/tracking.gateway.ts` |
| Order FSM & dispatch | `ADR-002`, `TID-05` | `src/modules/orders/order-state.machine.ts`, `src/modules/order-flow/order-flow.service.ts` |
| Atomic claim mutex / concurrency | `ADR-004` | `order-flow.service.ts` (`claimOrder`) |
| PostGIS spatial queries | `ADR-003`, `TID-02` §4 | `src/modules/vendors/vendor.service.ts` (raw `ST_DWithin`/`ST_Distance`) |
| Auth, OTP, JWT, RBAC | `TID-03` §2.1 | `src/modules/auth/`, `src/common/guards/` |
| Payments & webhook idempotency | `ADR-011`, `TID-03` §2.6 | `src/modules/payments/` (gateways: `sslcommerz`, `sandbox`) |
| Delivery fee engine | `BRD-03`, `TID-03` §2.2 | `src/modules/promotions/pricing/delivery-fee.service.ts` |
| Settlements, ledgers, COD offset | `ADR-009`, `TID-05` §6 | `src/modules/admin/admin.service.ts` (`executeSettlementCycle`), ledgers in schema |
| Cancellation, refunds, rollbacks | `ADR-002`, `ADR-011` | `orders.service.ts`, `admin.service.ts` (`cancelOrder`), `payments.service.ts` (`refundForOrder`) |
| Vendor KDS, catalog, store hours | `BRD-05`, `TID-03` §2.3 | `apps/vendor_portal/src/` (`pages/vendor/`, `hooks/useKDSOrders`, `utils/sound.ts`) |
| Admin console & fleet radar | `BRD-07`, `TID-03` §2.5 | `apps/admin_portal/src/` (`pages/admin/`, `components/dispatch/LiveFleetMap.tsx`) |
| Customer app journeys | `BRD-04`, `TID-03` §2.2 | `apps/customer_app/lib/features/` (feature-first: domain/presentation/providers) |
| Rider app & background GPS | `BRD-06`, `TID-03` §2.4 | `apps/rider_app/lib/features/`, `core/services/background_location_service.dart` |
| Design system tokens (Flutter) | `AGENT_RULES.md` §3.7 | `apps/*/lib/core/constants/app_{colors,spacing,typography}.dart` |
| Design tokens (web Tailwind) | `AGENT_RULES.md` §3.7 | `apps/*/tailwind.config.js` (`primary`, `brand`, `surface`, `status`) |
| Security hardening & env | `ADR-012` | `src/app.module.ts` (Joi), `src/common/config/env.ts`, `deploy/docker-compose.prod.yml` |
| Integrations (SMS, FCM, Sentry) | `ADR-013`, `ADR-014` | `src/modules/auth/sms/`, `src/modules/notifications/`, `src/common/filters/` |
| Scaling & data safety | `ADR-015` | `deploy/docker-compose.prod.yml`, `deploy/systemd/`, `scripts/backup-db.sh` |
| Mobile release engineering | `TID-07` §6 | `scripts/build-android.sh`, `apps/*/android/` |
| Docker / DevOps / env setup | `TID-07` | `deploy/` + [`deploy/README.md`](../deploy/README.md) |
| Business rules & journeys (non-technical) | `BRD-00`–`BRD-07` ([index](./business-requirements-documents/README.md)) | — |
| All ADRs | [ADR index](./architecture-decision-records/README.md) (`ADR-001`–`015`) | — |

---

## 3. Domain Constants (Single Source: `prisma/schema.prisma`)

```typescript
// Prisma enums
enum UserRole         { SUPER_ADMIN, VENDOR_ADMIN, RIDER, CUSTOMER }
enum AccountStatus    { PENDING_APPROVAL, ACTIVE, SUSPENDED }
enum VendorVertical   { FOOD, GROCERY, SUPER_SHOP, PHARMACY }
enum PermissionScope  { PARTICULAR_OUTLET, ALL_OUTLETS_MASTER }
enum OrderStatus      { PLACED, RIDER_ASSIGNED, ACCEPTED /*deprecated, unused at runtime*/, PREPARING, READY_FOR_PICKUP, DISPATCHED, DELIVERED, CANCELLED }
enum PaymentMethod    { CASH_ON_DELIVERY, ONLINE_GATEWAY }
enum PaymentStatus    { PENDING, PAID, REFUNDED, FAILED }
enum SettlementStatus { PENDING, PROCESSING, SETTLED }
enum DiscountType     { PERCENTAGE, FLAT }
enum BannerLinkType   { OUTLET, CATEGORY, EXTERNAL }

// String conventions (not Prisma enums)
CashDeposit.status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'   // written by code; schema default 'COMPLETED' is legacy
OrderFlowConfig.mode: 'RIDER_FIRST' | 'VENDOR_FIRST'               // inside SystemSetting JSON `order_flow_config`
DeliveryFeeConfig.mode: 'FIXED_FLAT' | 'DISTANCE_TIERED'           // canonical camelCase; legacy snake_case normalized on read
```

**FSM transitions** (`ORDER_TRANSITIONS`, `order-state.machine.ts`): `PLACED→[RIDER_ASSIGNED, PREPARING, CANCELLED]` • `RIDER_ASSIGNED→[PREPARING, CANCELLED]` • `PREPARING→[READY_FOR_PICKUP, CANCELLED]` • `READY_FOR_PICKUP→[DISPATCHED, CANCELLED]` • `DISPATCHED→[DELIVERED]` • `DELIVERED|CANCELLED` terminal. Claimable: `RIDER_FIRST→PLACED`, `VENDOR_FIRST→READY_FOR_PICKUP`.

**Redis key map** (never invent new keys without checking collisions):

| Key | Purpose |
| :--- | :--- |
| `riders:locations:active` | GEO index of online rider GPS (`GEOADD`/`GEOSEARCH`) |
| `lock:order_claim:<orderId>` | Atomic claim mutex (`SET NX EX 10`) |
| `rider:active_order:<riderId>` | Rider in-flight trip marker (duty lock, busy check) |
| `otp:<phone>` (TTL 120s) • `ratelimit:otp:<phone>` | OTP lifecycle + 3-per-5min limiter |
| `auth:refresh:<jti>` | Rotating refresh-token revocation store |
| `lock:sweep:expired-payments` (55s) • `lock:sweep:dispatch-escalation` (25s) | Leader locks for `setInterval` sweeps (no `@nestjs/schedule`) |
| `dispatch:escalated:<orderId>:tier<N>` (1h) | Escalation idempotency |
| `order:live_location:<orderId>` • `rider:telemetry:<id>` (300s) | Tracking caches |
| `role_req:<phone>` (300s) | Requested onboarding role for new-phone OTP signups |
| `otp_attempts:<phone>` (120s) | OTP brute-force lockout counter (5 strikes invalidates) |
| `geo:reverse:<lat4>:<lng4>` (24h) | OSM Nominatim reverse-geocode cache |
| `order:seq:<YYYYMMDD>` (48h) | Daily order-number INCR counter (`ORD-YYYYMMDD-NNNN`) |
| `auth:user:<userId>` (30s) | JWT-guard user cache (invalidated on logout) |

**Socket.IO `/events`** — full catalog in `TID-04`. Client→server: `order:join`, `order:leave`, `rider:location:update`. Server→client: `connected`, `error`, `order:new`, `order:status:changed`, `order:rider:moved`, `order:cancelled`, `order:payment:verified`, `dispatch:broadcast`, `dispatch:escalated`, `order:delivery_failed`, `rider:location`. Acks: `order:joined`, `order:left` (reply to `order:join`/`order:leave`). Alias: `rider:location_update` is accepted for `rider:location:update`.

---

## 4. Canonical Patterns (Copy-Paste Ready)

**Response envelope** (enforced by `TransformInterceptor` + `AllExceptionsFilter`):
```json
{ "success": true, "statusCode": 200, "message": "…", "data": {} }
```

**Money mutation = one Prisma transaction** (order state + ledgers together, `Decimal(10,2)` everywhere):
```typescript
await prisma.$transaction(async (tx) => {
  const order = await tx.order.update({ where: { id: orderId }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
  await tx.riderTripLedger.create({ data: { orderId, riderId, deliveryEarnings, codCollected } });
});
```

**Atomic claim mutex** (`RedisService.acquireLock`):
```typescript
const acquired = await redis.set(`lock:order_claim:${orderId}`, riderId, 'NX', 'EX', 10);
if (!acquired) throw new ConflictException('Order already claimed');
```

**Coordinates**: persisted as `Float` `latitude`/`longitude` columns; PostGIS geography is computed at query time (`ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`) over expression GIST indexes (see `prisma/migrations/20260924065308_*`). Never store GPS ticks in PostgreSQL — Redis GEO only.

**Delivery fee** (`delivery-fee.service.ts`): `FIXED_FLAT { flatFee }` or `DISTANCE_TIERED { baseFee, baseKm, perKmRate }` → `baseFee + (distanceKm − baseKm) × perKmRate`; `normalizeDeliveryFeeConfig()` accepts legacy snake_case keys on read.
