# ADR-017: Absolute Variation Pricing, Ordered Variations & Brand-Mandatory Outlets

## Status
**Accepted** (2026-10-02)

---

## Context & Problem Statement

Three structural weaknesses in the catalog domain made the unified governance UX impossible:

1. **Additive variation pricing.** `ProductVariant.priceModifier` stored a delta on `Product.basePrice`, so every consumer re-derived the real price (`base + modifier`). Grounding revealed the customer app had already drifted to absolute semantics while checkout still summed — the same field meant different things on different surfaces.
2. **No deterministic variation order.** "The first variation is the product price" cannot be enforced when variants have no order column (queries ordered by name).
3. **Optional outlet branding.** `Vendor.brandId` was nullable, producing standalone outlets with no owner scope — incompatible with "an owner governs one brand, a manager one outlet."

---

## Decision

- **`ProductVariant.price` is absolute** (Decimal 10,2). `priceModifier` is removed from the schema and every API payload — clean break, no aliasing window; all consumers (backend checkout, public catalog, customer app, vendor portal, seeds) switched atomically with the migration.
- **`ProductVariant.sortOrder`** makes the order explicit; queries order by it. **The first-ordered variation defines `Product.basePrice`** — the service layer re-syncs it inside the same transaction on every product write, and rejects saves with fewer than one variation (wholesale variations save: omitted ids are deleted — safe because order line items freeze variant JSONB snapshots per ADR-008).
- **Products cannot be hard-deleted** (`order_items.product_id` FK); retirement is the stock-out toggle. Variations can be hard-deleted freely.
- **`Vendor.brandId` is required** (RESTRICT). The migration auto-created a brand named after each standalone outlet. Create requires a brand; update may switch brands but never detach.
- **One active staff assignment per account** (owner → one brand via `ALL_OUTLETS_MASTER`; manager → one outlet). Assigning a user with an active assignment elsewhere returns 409; inactive assignments don't block. Toggling assignment state or scope purges the 30s session cache.
- **Variation availability** maps to the existing `isInStock` (no new column); inactive staff lockout already filtered on `isActive: true` in scope validation.

---

## Consequences

**Positive**
- One price per variation across every surface; display and checkout can no longer disagree.
- Deterministic product price without redundant state (basePrice is derived-and-synced, guarded transactionally).
- Brand governance becomes a complete hierarchy: brand → outlets → staff scopes; standalone outlets can't fragment it.

**Negative / Trade-offs**
- Historical order snapshots carry `priceModifier` (old semantics); history surfaces fall back to the stored item `unitPrice` (authoritative absolute), so no backfill is needed.
- One-time destructive conversion (`price = base + modifier`) — mitigated by a pre-migration backup; rollback = restore.
- Cheapest-first conversion heuristic for initial `sort_order` (the plain option leads in modifier-era data); admins reorder freely afterwards.

---

## Technical Implementation Details

- Migration `20261002110000`: adds `price`/`sort_order`, converts, drops `price_modifier`, auto-brands standalone outlets, sets `brand_id NOT NULL` with `ON DELETE RESTRICT`.
- `AdminService.saveProduct` is the single write path (create/update share it): validates ≥1 variation, deletes omitted variant ids, renumbers `sortOrder` 1..n, syncs `basePrice = variations[0].price` — one ACID transaction. It replaces the former override/disable endpoints.
- Checkout: `unitPrice = variant.price`; snapshot freezes `{id, name, price}`.
- Admin UI: unified ProductDialog (view/edit/create) with a unit-tested `variationsEditor` (first row anchored: not removable, reorder-up only); StaffProfileDialog (view/edit/create with active toggle and scope switch); Outlet Page aggregates brand/outlet/staff/catalog/hours via `GET /admin/outlets/:id`.

---

## Compliance & Verification

- Backend 223 unit tests (+10: empty-variations 400, reorder price re-sync, delete-first resync, vendorId-required, scope switch + vendor unbind, toggle-only patch, account edit + duplicate-phone 409, single-assignment 409, same-row reassign allowed).
- Admin Vitest 87→93 (`variationsEditor` suite: draft mapping, first-row protection, reorder/remove guards, price parsing and validation).
- E2E through the edge: outlet aggregate, brand search, product create with ordered variations (basePrice = first), empty-variations 400, reorder re-sync, staff lifecycle (assign → deactivate → scope switch → 409 elsewhere → remove/demote), public catalog carries absolute `price` with `priceModifier` gone.
