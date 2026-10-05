# ADR-017: Absolute Variation Pricing, Ordered Variations & Brand-Mandatory Outlets

## Status
**Accepted** (2026-10-02)

---

## Context & Problem Statement

The catalog domain requires deterministic variation pricing, ordered presentation, and unified brand hierarchy governance:

1. **Absolute variation pricing**: Product variations require independent, absolute pricing rather than relative modifiers or offsets on parent products, guaranteeing that checkout, catalog discovery, and customer displays calculate identical totals.
2. **Deterministic variation order**: Menu listings require explicit display ordering where the first variation consistently establishes the product headline price.
3. **Mandatory outlet branding**: Every outlet must belong to a brand (`Vendor.brandId` is required) to enforce unambiguous governance: an owner governs a brand, a manager governs an outlet.

---

## Decision

- **`ProductVariant.price` is absolute** (`Decimal(10, 2)`). All consumers (backend checkout, public catalog discovery, mobile apps, vendor portal, and seeds) operate exclusively with absolute prices.
- **`ProductVariant.sortOrder`** enforces explicit sequence (queries sort by `sortOrder ASC`). **The first-ordered variation defines `Product.basePrice`** — the backend re-syncs it inside the same ACID transaction on every product write, enforcing $\ge 1$ variation per product.
- **Products cannot be hard-deleted** when referenced by historical `order_items` (`ON DELETE RESTRICT`); retirement occurs via the `isInStock` toggle. Variations can be deleted during wholesale product updates.
- **`Vendor.brandId` is required** (`ON DELETE RESTRICT`). Outlets must be attached to an existing brand at creation, and brand reassignment is strictly controlled.
- **One active staff assignment per account**: An owner governs one brand (`ALL_OUTLETS_MASTER`), while a manager governs one outlet (`PARTICULAR_OUTLET`). Attempting to assign an already-assigned account returns HTTP 409 Conflict. Assignment mutations immediately invalidate cached session tokens in Redis.
- **Variation availability** maps to `isInStock` boolean flags on individual variations.

---

## Consequences

**Positive**
- Exact price consistency across all surfaces: customer app, vendor KDS, checkout engine, and invoice ledgers cannot disagree.
- Deterministic headline pricing derived directly from the primary variation without redundant database state.
- Unbroken brand governance hierarchy: Brand ➔ Outlets ➔ Staff Scopes.

**Trade-offs**
- Admins must configure at least one variation per product.
- Wholesale product updates transactionally replace omitted variations.

---

## Technical Implementation Details

- **Unified Write Path**: `AdminService.saveProduct` serves as the single write path for creating and updating products: validates $\ge 1$ variation, deletes omitted variations, renumbers `sortOrder` (1..n), and updates `basePrice = variations[0].price` in a single database transaction.
- **Checkout Pricing**: `unitPrice = variant.price`; the line item snapshot freezes `{ id, name, price }`.
- **Admin Governance Console**: Unified `ProductDialog` with anchored primary variation, `StaffProfileDialog` with scope controls, and aggregated outlet detail queries via `GET /admin/outlets/:id`.

---

## Compliance & Verification

- **Backend Unit Tests**: Covered in `admin.service.spec.ts` (empty-variations 400 guard, sort re-sync, single-assignment 409, scope switches).
- **Admin Portal Tests**: Covered in `variationsEditor.test.ts` (first-row protection, reorder guards, absolute price validation).
- **Integration Suites**: Validated via live catalog discovery and checkout integration suites.
