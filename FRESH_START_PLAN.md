# DeliveryOS Fresh-Start Reset & Production Hardening — Execution Plan

- **Date:** 2026-10-05
- **Status:** Step 1 ✅ committed · Step 2 ✅ complete (backend: per-outlet flow mode + outlet-type system) — awaiting owner validation · Steps 3–6 on command
- **Authorization:** Full database wipe and migration-baseline replacement explicitly ordered by owner. No auto-commit / auto-push at any point.
- **Per-step gates:** each step ends in a validated, compilable, suite-green state for owner inspection.

---

## 0. Scope Summary

1. **Database re-architecture** — new enums, hot-query indexes, feature data models, dead concepts dropped, 9 accumulated migrations squashed into one clean `0_init` baseline (permanently fixing a migration↔schema drift).
2. **Feature: per-outlet order-flow mode** — `RIDER_FIRST` vs `VENDOR_FIRST` becomes an outlet-level setting managed in the admin portal, replacing the system-wide `order_flow_config.mode`; `Order.orderFlowMode` immutable snapshot at checkout.
3. **Feature: admin-managed Outlet Type system** — dynamic types (Restaurant, Grocery, Pharmacy, Store, …) created in Admin → Settings, chosen at outlet create/edit, with an on/off toggle that hides all outlets of a disabled type from the customer app; replaces the hardcoded `VendorVertical` enum.
4. **Dead-code purge** — every verified-unused endpoint, event, script, component, util, and i18n key removed across backend, both portals, both Flutter apps.
5. **Unified production-realistic seed** — one seeder covering every model and every practical case.
6. **Zero-issue validation + living-docs sync.**

---

## 1. Grounding Findings (full-codebase scan, 2026-10-05)

### 1.1 CRITICAL — migrations out of sync with schema
Commit `5296fba` (add-ons/toppings removal) edited `schema.prisma` but shipped **no drop migration**. The init migration still creates `product_addon_groups`, `product_addons`, `order_items.addons_snapshot` — so every fresh `migrate reset`/`deploy` (Docker CMD **and** CI) resurrects the dead tables. The baseline squash fixes this structurally.

### 1.2 Seed gaps
Neither seeder seeds `Payment`, `SettlementBatch`, `CashDeposit`, `MediaAsset`; no `PENDING_APPROVAL`/`SUSPENDED` accounts (fleet queue + suspension flows have no demo data); `seed-massive.ts` omits `delivery_economics`; two overlapping seeders (~570 + ~1,470 lines).

### 1.3 Verified dead-code inventory (zero production callers, grep-confirmed)
| Area | Item | Location |
|---|---|---|
| Backend | `POST /cart/validate-address-coverage` duplicate alias | `vendor.controller.ts:80-101` (`CartController`) |
| Backend | `GET /orders/:id/live-tracking` (app polls order detail) | `order.controller.ts:70`, `order.service.ts:672` |
| Backend | `GET /admin/vendors/:id/catalog` (superseded by `/admin/outlets/:id`) | `admin.controller.ts:256`, `admin.service.ts:964` |
| Backend | `GET/POST /admin/catalog/categories` (no producer/consumer) | `admin.controller.ts:550,560` |
| Backend | `POST /admin/uploads` legacy alias | `admin.controller.ts:81` |
| Backend | `GET /rider/cash/deposits` (rider app only POSTs) | `rider.controller.ts:130`, `rider.service.ts:347` |
| Backend | WS `user:status:changed` (zero listeners) | `tracking.gateway.ts:591` + `admin-customers.service.ts:260` |
| Backend | WS `rider:location_update` underscore alias | `tracking.gateway.ts:266` |
| Backend | Orphan scripts | `scripts/test-auth-refresh.js`, `scripts/test-ws-idor-guard.js` |
| Admin | `getCentralCategories()` + `CentralCategory` type | `services/admin/vendors.api.ts:161-165` |
| Admin | `formatPhoneNumber` (test-only) | `utils/formatters.ts:37` |
| Admin | `getOutletDeletionBlockingReasons` (page uses only `canDeleteOutlet`) | `utils/outletDeletionGuard.ts:29` |
| Vendor | `EmptyState.tsx` (zero imports) | `components/common/EmptyState.tsx` |
| Vendor | ~67 unused i18n keys incl. `kds.extras` (×3 locales) | `i18n/locales/{en,ar,bn}.json` |
| Flutter | `order_status_badge.dart` (zero refs) | `customer_app/lib/core/widgets/` |
| Flutter | Unused constants `vendorDetails`, `googleMapsApiKey`, `me` | `api_constants.dart` (both apps) |
| Text/Docs | Addon prose in Swagger/dialogs; TID-02/03/04/07, BRD-00..07, ADR-008 | various |

### 1.4 Missing hot-query indexes
`Order(riderId,status)`, `Order(customerId,placedAt)`, `Order(paymentStatus)`, `User(role,status)`, `Product(vendorId,isInStock)`, `RiderTripLedger(status)`, `Vendor(isActive)`, `CashDeposit(status)`. The 3 PostGIS GiST geography indexes exist **only in raw migration SQL** — must survive the squash.

### 1.5 Type-safety gap
`CashDeposit.status` is a raw `String` with loose literals (`admin.service.ts:2246,2285`, `rider.service.ts:331,340`).

---

## 2. New Feature Designs (owner additions)

### 2.1 Per-Outlet Order-Flow Mode
- Prisma enum **`OrderFlowMode { RIDER_FIRST, VENDOR_FIRST }`** (promoted from DTO-local enum).
- **`Vendor.orderFlowMode`** (default `RIDER_FIRST`) — admin sets at outlet create/edit.
- **`Order.orderFlowMode`** — immutable snapshot captured at checkout (mid-flight config flips never affect in-flight orders; same pattern as address/phone snapshots).
- Per-order mode resolution in `order-flow.service` (dispatch L316-388, stale sweep L633), `vendor-staff.service` invariants (L305-310, L444), rider claim, FSM claimable statuses.
- `order_flow_config` retired; timing fields (`rider_search_timeout_seconds`, `staleOrderTtlMinutes`) move to slimmed **`dispatch_config`**. Admin Settings keeps timing cards, loses the global FSM card.

### 2.2 Admin-Managed Outlet Type System
- Model **`OutletType`**: `name`/`slug` unique, `isActive` (default true), `sortOrder`, timestamps; index `(isActive, sortOrder)`.
- **`Vendor.typeId`** FK (`Restrict` delete → 409 when outlets assigned; toggle-off is the soft control). `VendorVertical` enum + `Vendor.vertical` dropped.
- Admin CRUD `/admin/outlet-types` (SUPER_ADMIN) + Settings "Outlet Types" manager (create/rename/reorder/toggle/guarded delete); outlet form vertical dropdown → type dropdown.
- Public `GET /vendors/outlet-types` (active only) feeds customer-app dynamic chips (slug→icon map, generic fallback); discovery/search SQL joins `outlet_types` with `is_active` filter — **toggled-off type hides its outlets from customers**; outlet detail carries `type` for deep-link "unavailable" states; vendor portal displays type read-only.

---

## 3. Execution — Six Steps (one owner gate per step)

### STEP 1 — Database re-architecture + single fresh baseline *(current)*
- Schema: `OrderFlowMode` + `CashDepositStatus` enums; `Vendor.orderFlowMode` + `Order.orderFlowMode` (defaults, additive); `CashDeposit.status` → enum; hot-query indexes; stale comment purge.
- Squash 9 migrations → `0_init` (`migrate diff --from-empty` + appended `CREATE EXTENSION IF NOT EXISTS` ×3 + 3 GiST geography indexes).
- Zero-drift proof (`migrate diff --from-url <live> --to-schema-datamodel` → empty).
- `prisma migrate reset --force --skip-seed` (the authorized wipe).
- Validation: psql object checks (addon tables absent, extensions/GiST/indexes present), backend typecheck + lint + unit tests, api container rebuilt to match schema.
- *Scope note:* `OutletType`/`typeId` and the `VendorVertical` drop land in Step 2 with their backend work, and `Category.vendorId` tightening lands in Step 4 with central-category removal — so every checkpoint stays compilable and green. `0_init` is regenerated after schema-affecting steps; the authoritative final reset + seed happens in Step 5.

### STEP 2 — Backend: flow-mode + outlet-type APIs
Promote enum; per-order mode resolution everywhere; checkout snapshot; `dispatch_config` timing-only config; outlet-types controller/service (CRUD, guarded delete, toggle) + public active-types endpoint; outlet DTOs gain `typeId` + `orderFlowMode`; discovery SQL joins types + `is_active`; drop `VendorVertical`; spec rework (`order-flow.service.spec`) + new outlet-type specs + discovery spec updates. Zero raw `any`.

### STEP 3 — Admin portal & app UI
Outlet create/edit: Order Flow Mode selector + Outlet Type dropdown. Settings: drop global FSM card, add Outlet Types manager. Customer app: dynamic type chips, `typeSlug` filter, deep-link unavailable state, remove `VendorVertical` refs. Vendor portal: read-only type display. Design-system compliant, RTL-safe.

### STEP 4 — Dead-code purge
Full §1.3 inventory; repoint `test-vendor-discovery.ts` to canonical coverage path; rewrite `test-live-tracking.ts` Test 2 to order-detail fallback; fix map-picker bare `catch (_)` into surfaced error state; prune i18n ×3 (preserve dynamic `nav.vendor.*`, `settings.days.*`); tighten `Category.vendorId`. **Out of scope:** shared portal package (ADR-001), mega-service decomposition, wiring-up dead endpoints.

### STEP 5 — Unified production-realistic seed
One canonical idempotent `seed.ts`; delete `seed-massive.ts` + `prisma:seed:massive` + `--massive`; add **`db:reset`** = `prisma migrate reset --force`. Coverage: all settings (new `dispatch_config`); 5 outlet types incl. 1 toggled-off with outlets; 6 brands / 12 outlets, mixed flow modes incl. deliberate swaps; documented logins `…001/002/003/004/005` (OTP `123456`); ~25 customers incl. 1 SUSPENDED; 15 riders incl. 2 PENDING_APPROVAL + 1 near cash limit; ~50 products/variants + out-of-stock; banners all 4 link types; coupons both types + exhausted/expired/inactive/min-spend; ~100 orders / 30 days across every live FSM status, both payment methods, PAID/PENDING/REFUNDED/FAILED, multi-stage cancellations with correct rollback, mode snapshots consistent; paired ledgers per DELIVERED order; 2 settlement batches; deposits in all 3 statuses; payments per gateway order; media assets. Ends with reconciliation assert (GMV = Σ commissions + Σ payouts).

### STEP 6 — Verification & living-docs sync
`npm run verify` (floors re-checked) → integration `npm test` (19 tracks) on fresh seeded DB → stack restart + smoke (health, OTP logins, non-zero KPIs) → feature smokes (type toggle hides outlets; both flow modes dispatch correctly) → `EXPLAIN ANALYZE` proofs (GiST + compound indexes) → fix-and-reloop. Docs: TID-02/03/04/07, BRD-00..07, ADR-008/012/016 amendments, order-flow ADR amendment, new **ADR-019** (OutletType replaces VendorVertical), FEATURES/CHANGELOG/QUICK_REFERENCE/README.

---

## 4. Acceptance Checklist

- [ ] `prisma migrate diff` zero drift; single `0_init` applies cleanly via reset and deploy
- [ ] No addon/toppings remnants anywhere (code, schema, migrations, docs)
- [ ] §1.3 inventory fully removed; all suites green (`npm run verify` + integration `npm test`)
- [ ] Flow mode per outlet in admin UI; both modes dispatch differently; snapshots immune to mid-flight flips
- [ ] Outlet types CRUD + toggle; disabled type's outlets hidden from customer app; delete guarded (409)
- [ ] `npm run db:reset` → fully seeded system; reconciliation asserts pass; demo logins work (OTP `123456`)
- [ ] `EXPLAIN ANALYZE` confirms GiST + new compound index usage
- [ ] TID/BRD/ADR/FEATURES/CHANGELOG synchronized; zero raw `any`, zero inline styling, no placeholder shortcuts, no weakened tests
