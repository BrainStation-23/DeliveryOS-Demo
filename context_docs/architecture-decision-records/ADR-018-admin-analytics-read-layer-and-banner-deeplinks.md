# ADR-018: Admin Analytics Read Layer & Banner Deeplink Completion

## Status

**Accepted** — 2026-10-02

## Context & Problem Statement

The Super Admin console had no analytics surface beyond the `GET /admin/overview` snapshot: no date-ranged KPIs, no timeseries, no per-status counts, no top-outlet/top-courier rankings, and no charting capability (zero chart dependencies existed). Parallel gaps blocked a production-grade governance panel: no admin customer directory, an unpaginated rider roster with no detail view, no per-order financial ledger (only vendor-aggregated statements), partially implemented banner deeplinks (schema carried `linkType` but no URL field, the admin form never collected a target, and the customer app only routed `OUTLET` taps), and read-only `delivery_economics` / stale-order TTL settings with no write path.

## Decision Drivers

- Dashboard must reflect system state over any date window with trend context, not just a "today" snapshot.
- All list surfaces must paginate server-side (the roster and brand grid previously fetched unbounded sets).
- Banner deeplinks must work end-to-end: admin configures → API validates → customer app routes.
- The `AdminService` (2,000+ lines) must not keep absorbing every new domain.
- No weakening of the strict typing / test-integrity gates (ADR-010, ADR-014).

## Considered Options

1. **Extend `AdminService` with analytics/customer methods** — rejected: grows an already oversized service and couples read-only aggregation with governance mutations.
2. **Separate reporting database / read replica** — rejected for pilot scale: adds infrastructure with no measured query-pressure justification; the `placedAt`/status indexes already cover bounded windows.
3. **Per-domain read services inside the admin module + a charting library on the portal** — chosen.

## Decision Outcome

1. **Analytics read layer**: `AdminAnalyticsController` (`admin/analytics`) + `AdminAnalyticsService` provide `GET /admin/analytics/overview` (window capped at 90 days, day/hour buckets, KPI cards with deltas vs the preceding equal-length window, status mix, timeseries, top outlets/riders) and `GET /admin/analytics/orders-summary`. Window math and bucketing live in pure exported functions (`resolveAnalyticsWindow`, `bucketOrderTimeseries`, `percentDelta`) that are unit-tested directly.
2. **Sibling read services** follow the same pattern for new domains: `AdminCustomersService` (`admin/customers` directory + detail, read-only), `AdminFleetService` (paginated enriched roster + unified rider detail), `AdminFinanceService` (unified per-order ledger joining commission + rider trip entries, with page-spanning summary and CSV export). Mutations stay in `AdminService`.
3. **Charting**: `recharts` is the portal's chart dependency (single new primary frontend dependency). Chart colors are centralized in `components/charts/chartTheme.ts` mirroring the Tailwind primary tokens so SVG stroke literals can never silently drift from the design system.
4. **Banner deeplink completion**: `Banner.targetUrl` (nullable `VarChar(500)`, additive migration) + server-side deeplink integrity validation on create/update (EXTERNAL ⇔ absolute http(s) `targetUrl`; OUTLET/CATEGORY ⇔ existing `targetId`). `GET /banners/active` returns `targetUrl` plus a resolved `targetName` so the customer app routes CATEGORY banners to discovery without extra lookups. The app resolves taps through a pure `resolveBannerAction` mapper (OUTLET → outlet page, CATEGORY → seeded search, EXTERNAL → `url_launcher` http/https only, everything else → generic search).
5. **Settings completion**: `PATCH /admin/settings/delivery-economics` (upserts `delivery_economics`, invalidates the pricing cache) and `staleOrderTtlMinutes` on the order-flow PATCH; `GET /admin/settings` returns all three groups.

### Positive Consequences

- The dashboard, order history glance cards, fleet roster, customer directory, and ledger all paginate and filter server-side with identical semantics.
- Analytics windowing is deterministic and unit-testable without a database.
- Banner deeplinks are validated at the boundary — the customer app can never be routed to a dead outlet/category or a non-http URL.
- Admin module grows horizontally (new services) instead of vertically.

### Negative Consequences & Trade-offs

- Timeseries bucketing fetches the window's order facts and buckets in JS — acceptable at pilot scale (bounded by the 90-day cap); a SQL `date_trunc` rollup is the escape hatch if windows grow.
- `recharts` adds ~124 KB gzip to the dashboard chunk (lazy-loaded route, never in the vendor bundle).

## Technical Implementation Details

- Backend: `src/modules/admin/admin-analytics.{service,controller}.ts`, `admin-customers.*`, `admin-fleet.service.ts`, `admin-finance.service.ts`, DTOs in `dto/admin-insights.dto.ts`; batched `groupBy` enrichment everywhere (no per-row queries).
- Portal: `services/admin/` domain API modules aggregated by `services/adminApi.ts`; shared `Tabs`, `SearchInput`, `Drawer`, `DateRangeFilterToolbar`, `TrendStatCard`, and `components/charts/*`.
- Mobile: `features/banners/domain/banner_action.dart` (pure resolver + tests), `BannerModel.targetUrl/targetName`, `SearchScreen(initialQuery:)`, `_handleBannerTap` router in the home screen.
- Migration: `20261002140000_banner_target_url` (nullable column — zero downtime).

## Compliance & Verification

- Backend: `npx jest src/modules/admin` covers analytics windowing/bucketing, roster enrichment, customer aggregation, ledger joins, product-delete 409 guard, banner deeplink validation, and economics upsert (75 admin tests; full suite 265+).
- Portal: Vitest covers trend formatting/badges and promotions filters; `npm run build` keeps the dashboard chart chunk route-split.
- Mobile: `flutter test test/banner_deeplink_test.dart` covers all four deeplink outcomes including non-http degradation.
- Docs: TID-03 §2.2/§2.5, BRD-07 module tree, and FEATURES.md §5/§9 updated in the same change.
