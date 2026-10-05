# ADR-008: Immutable Historical Order Snapshots using JSONB for Audit Integrity

## Status
**Accepted** (2026-09-22)

---

## Context & Problem Statement
In multi-vendor delivery platforms, merchant catalogs and customer addresses change constantly:
- Merchants edit dish names, alter prices, or delete discontinued menu items.
- Customers modify apartment numbers or delete old delivery addresses.

If orders reference only foreign keys (`product_id`, `customer_address_id`) and join against live tables:
1. Past receipts retroactively reflect new prices or missing items.
2. Deleting an item or address causes `Foreign Key Constraint Violation` errors or null references.
3. Financial audit trails and VAT tax records become legally invalid.

---

## Decision Drivers
- **Legal & Tax Audit Immutability**: A customer receipt or tax invoice issued today must remain unchanged indefinitely.
- **De-linking from Mutable State**: Merchants must be free to modify catalogs without cascading failures into historical orders.
- **Zero Join Overhead**: Historical receipts should render without joining 5+ mutable tables.
- **Type Safety**: Avoid untyped data; enforce explicit TypeScript snapshot interfaces.

---

## Considered Options
1. **Live Relational Joins**: Store only IDs and join against mutable entities. *(Rejected: Corrupts historical audit trails)*.
2. **Duplicated Relational Snapshot Tables**: Create separate snapshot tables per entity. *(Rejected: Massive schema bloat and complex migrations)*.
3. **Immutable JSONB Snapshots on Orders (Chosen)**: Store frozen JSON objects in `deliveryAddressSnapshot` and `variantSnapshot` at order creation.

---

## Decision Outcome
Chosen option: **Immutable JSONB Snapshots**.

| Aspect | Mutable Foreign Key Joins | Immutable JSONB Snapshots |
| :--- | :--- | :--- |
| **Catalog Price Change** | Past orders retroactively show new price ❌ | Past orders preserve purchase-time price ✅ |
| **Product Deletion** | Past orders break with foreign key / null errors ❌ | Past orders retain complete product snapshot ✅ |
| **Invoice Query Speed** | Requires 4–6 table joins ❌ | Single indexed row lookup ✅ |
| **Schema Flexibility** | Rigid relational columns ❌ | Extensible typed JSON payload ✅ |

### Positive Consequences
- **Permanent Audit Trail**: Receipts are legally immutable.
- **Resilient Operations**: Merchants can delete products without breaking past user order histories.
- **Fast Historical Queries**: Order history lookups require zero joins.

### Negative Consequences & Mitigations
- *Trade-off*: Snapshot evolution must maintain strict schema consistency.
- *Mitigation*: Snapshot TypeScript interfaces define optional fields (`?`) and non-breaking extensions.

---

## Technical Implementation Details
Implemented in [`order.service.ts`](../../services/backend_api/src/modules/orders/order.service.ts):
```typescript
export interface OrderAddressSnapshot {
  deliveryMethod: 'DELIVERY' | 'TAKEAWAY';
  vendorAddress?: string;
  addressId?: string;
  addressLine?: string;
  buildingFloor?: string | null;
  label?: string;
  latitude?: number;
  longitude?: number;
  deliveryNote?: string | null;
  [key: string]: Prisma.InputJsonValue | null | undefined;
}

export interface OrderVariantSnapshot {
  id: string;
  name: string;
  price: number;
  [key: string]: Prisma.InputJsonValue | undefined;
}
```

---

## Compliance & Verification
- Re-order verification: [`ValidateReorderDto`](../../services/backend_api/src/modules/orders/dto/validate-reorder.dto.ts) verifies snapshot integrity against live catalog data.
- Unit tests: Backend order service tests verify snapshot persistence across mutations.
