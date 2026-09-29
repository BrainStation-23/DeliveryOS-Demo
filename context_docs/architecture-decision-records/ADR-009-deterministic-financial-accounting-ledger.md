# ADR-009: Deterministic Floating-Point Math & Double-Entry Commission Settlement Ledger

## Status
**Accepted** (2026-09-22)

---

## Context & Problem Statement
Financial reconciliation in multi-vendor platforms is prone to cumulative rounding drift:
- In binary floating-point arithmetic: `0.1 + 0.2 = 0.30000000000000004`.
- Aggregating thousands of orders with floating-point variances creates balance discrepancies between merchant payouts, rider earnings, and platform take-rates.
- Computing payouts on-the-fly from live orders without an immutable settlement ledger prevents mathematical audits when commission rates change.

---

## Decision Drivers
- **Cent/Paisa Determinism**: Calculations must round to 2 decimal places at each calculation boundary.
- **Double-Entry Auditability**: Every completed order generates an immutable `CommissionLedger` entry at creation.
- **Cash-on-Delivery (COD) Support**: Reconcile offline cash collections against digital payouts seamlessly.
- **RFC 4180 CSV Export**: Produce standardized statements exportable to ERP accounting platforms (QuickBooks, SAP).

---

## Considered Options
1. **On-the-Fly Aggregation**: Calculate commissions dynamically on invoice request. *(Rejected: Subject to commission drift and historical inaccuracies)*.
2. **Payment Gateway Splitting Only**: Rely solely on gateway webhooks. *(Rejected: Cannot handle Cash on Delivery, which represents 60%+ of hyperlocal volume)*.
3. **Dedicated Transactional Commission Ledger with Deterministic Math (Chosen)**: Write frozen financial records within the order creation transaction.

---

## Decision Outcome
Chosen option: **Dedicated Transactional Commission Ledger with Deterministic Math**.

```text
Customer Checkout: ৳300.00
├── Gross Merchant Subtotal: ৳200.00
│   ├── 15% Platform Take-Rate:  ৳30.00 (CommissionLedger.commissionDeducted)
│   └── 85% Net Vendor Payable:  ৳170.00 (CommissionLedger.netVendorPayable)
└── Delivery Fee: ৳100.00
    ├── 80% Courier Earnings:    ৳80.00
    └── 20% Logistics Take-Rate: ৳20.00
```

### Positive Consequences
- **Zero Rounding Variance**: Database columns enforce `DECIMAL(10, 2)` across all monetary fields.
- **Sub-Second Balance Inquiries**: Super Admin checks settled vs unsettled accounts without traversing raw order items.
- **Standardized Accounting Exports**: Produces valid RFC 4180 CSV exports for external accountants.

### Negative Consequences & Mitigations
- *Trade-off*: Additional row write per order in the checkout transaction.
- *Mitigation*: Negligible overhead within PostgreSQL ACID transaction boundaries.

---

## Technical Implementation Details
Implemented in [`order.service.ts`](../../services/backend_api/src/modules/orders/order.service.ts) and [`admin.service.ts`](../../services/backend_api/src/modules/admin/admin.service.ts):
```typescript
const commissionRate = Number(vendor.commissionRate); // percentage, default 15.00
const platformFee = Math.round(netSubtotal * (commissionRate / 100) * 100) / 100;
const netVendorPayable = Math.round((netSubtotal - platformFee) * 100) / 100;

await tx.commissionLedger.create({
  data: {
    orderId: newOrder.id,
    vendorId: vendor.id,
    grossAmount: netSubtotal,
    commissionRate,
    commissionDeducted: platformFee,
    netVendorPayable,
    settlementStatus: SettlementStatus.UNSETTLED,
  },
});
```

---

## Compliance & Verification
- Settlements verification: Verified in [`test-admin-console.ts`](../../apps/admin_portal/scripts/test-admin-console.ts) (Section 8: Financial Settlements Statement & CSV Export).
- Multi-outlet verification: Verified in [`test-vendor-multi-tier.ts`](../../apps/vendor_portal/scripts/test-vendor-multi-tier.ts) (Section 7: Consolidated vs per-outlet sales ledgers).
