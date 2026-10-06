# ADR-019: Admin-Managed Outlet Types Replace the Hardcoded Vertical Enum

- **Status**: Accepted
- **Date**: 2026-10-05
- **Deciders**: Platform Architecture Board
- **Related**: [ADR-002](./ADR-002-dynamic-dual-order-flow-fsm.md) (per-outlet flow modes), [ADR-017](./ADR-017-absolute-variation-pricing-and-brand-mandatory-outlets.md) (brand-governed outlets)

## Context

Outlets require dynamic classification (Restaurant, Grocery, Pharmacy, Store, etc.) with operational administrative control:
1. Dynamic business lines without schema mutations or code releases.
2. Central soft-control visibility toggle: deactivating an outlet type must immediately hide all of its outlets from customer discovery without data deletion.
3. Server-driven categorization on mobile clients rather than static client-side enums.

## Decision

1. **`outlet_types` table** (`name`/`slug` unique, `is_active`, `sortOrder`) models business classifications; `vendors.type_id` is NOT NULL (every outlet is classified). Deletions are guarded while outlets remain assigned (HTTP 409 Conflict).
2. **Visibility toggle is the soft control**: deactivating a type immediately excludes its outlets from customer discovery (`/vendors/nearby`, `/vendors/search`, and product matches join `outlet_types` and filter `is_active: true`); the public `GET /vendors/outlet-types` (active only) feeds customer-app category chips dynamically.
3. **Creation guard**: new outlets may only be created under an *active* type (`409` otherwise); editing may reassign to any existing type.
4. **Governance surface**: full CRUD at `/admin/outlet-types` (SUPER_ADMIN) + the Brands & Outlets → Outlet Types tab in the admin portal; the outlet form requires an explicit Type selection.

## Alternatives Considered

- **Hardcoded enum + boolean "visible" flag per type** — rejected: schema-bound for new categories.
- **Outlet-level visibility only** (via `vendors.is_active`) — cannot switch off an entire business line at once; kept as a separate, orthogonal control.

## Consequences

- Business teams launch or pause categories with zero deploys.
- Outlet types are fully dynamic, seeded in the initial dataset, and managed at runtime via admin APIs without requiring database migrations.
- Customer-app chips render server-defined names dynamically; slugs stay stable for deep-link icon mapping with a generic fallback.
