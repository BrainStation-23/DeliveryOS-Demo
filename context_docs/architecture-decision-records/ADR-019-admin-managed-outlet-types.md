# ADR-019: Admin-Managed Outlet Types Replace the Hardcoded Vertical Enum

- **Status**: Accepted
- **Date**: 2026-10-05
- **Deciders**: Platform Architecture Board
- **Related**: [ADR-002](./ADR-002-dynamic-dual-order-flow-fsm.md) (per-outlet flow modes landed in the same reset), [ADR-017](./ADR-017-absolute-variation-pricing-and-brand-mandatory-outlets.md) (brand-governed outlets)

## Context

Outlets were classified by the hardcoded Prisma enum `VendorVertical` (`FOOD | GROCERY | SUPER_SHOP | PHARMACY`). Adding a business category required a schema change and a release, admins had no control over category visibility, and the customer app hard-coded the chip list. Business ownership asked for admin-managed outlet types (Restaurant, Grocery, Pharmacy, Store, …) with an on/off toggle: a disabled type must hide **all** of its outlets from the customer app without deleting anything.

## Decision

1. **`outlet_types` table** (`name`/`slug` unique, `is_active`, `sortOrder`) replaces the `VendorVertical` enum; `vendors.type_id` is NOT NULL (every outlet is classified). Deleted only when zero outlets remain assigned (`409` otherwise).
2. **Visibility toggle is the soft control**: deactivating a type immediately excludes its outlets from customer discovery (`/vendors/nearby`, `/vendors/search`, and product matches join `outlet_types` and filter `is_active`); the public `GET /vendors/outlet-types` (active only) feeds the customer-app category chips, which became dynamic instead of hard-coded.
3. **Creation guard**: new outlets may only be created under an *active* type (`409` otherwise); editing may reassign to any existing type.
4. **Governance surface**: full CRUD at `/admin/outlet-types` (SUPER_ADMIN) + the Settings → Outlet Types manager card in the admin portal; the outlet form's former implicit vertical default became an explicit required Type dropdown.

## Alternatives Considered

- **Keep the enum + a boolean "visible" flag per vertical** — still schema-bound for new categories; rejected.
- **Outlet-level visibility only** (already exists via `vendors.is_active`) — cannot switch off an entire business line at once; kept as a separate, orthogonal control.

## Consequences

- Business teams launch/pause categories (e.g. a Cafe pilot) with zero deploys.
- The migration was trivial because it landed during the 2026-10-05 fresh-start reset (ADR-012 baseline squash): no data backfill, the seeder creates the initial types.
- Customer-app chips render server-defined names; slugs stay stable for deep-link icon mapping with a generic fallback.
