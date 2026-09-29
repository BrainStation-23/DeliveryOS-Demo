# Business Requirements Documents (BRD) Suite
### DeliveryOS — Hyperlocal On-Demand Multi-Vendor Platform

Authoritative business specifications, commercial rules, user journeys, operational playbooks, and stakeholder role matrices for the DeliveryOS platform.

---

## 1. Document Index

- **[00-master-product-overview.md](./00-master-product-overview.md)** — **Master Product Overview & Capability Catalog**: Plain-English platform guide, 4-app breakdown, end-to-end lifecycle, and commercial model.
- **[01-executive-summary-and-vision.md](./01-executive-summary-and-vision.md)** — **Executive Summary & Platform Scope**: High-level platform mission, multi-vertical strategy, phased roadmap, and pilot SLA criteria.
- **[02-stakeholder-roles-and-personas.md](./02-stakeholder-roles-and-personas.md)** — **Stakeholder Roles & Access Specifications**: Role matrix (`CUSTOMER`, `VENDOR_ADMIN`, `RIDER`, `SUPER_ADMIN`, `SUPPORT`), capabilities, inputs, outputs, invariants, and edge cases.
- **[03-core-business-rules-and-workflows.md](./03-core-business-rules-and-workflows.md)** — **Core Business Rules & Commercial Logic**: Single-vendor cart, PostGIS address geofence guard, coupon engine, deterministic order numbering, dual dispatch sequences (`RIDER_FIRST` vs `VENDOR_FIRST`), double-entry ledger equations, COD invariants, and regional parameters.
- **[04-customer-experience-and-journey.md](./04-customer-experience-and-journey.md)** — **Customer Mobile App Journey Specification**: 9-screen lifecycle from OTP auth and location picker to menu navigation, guarded cart, checkout, live tracking, failure recovery (Switch-to-COD), and 1-tap re-order.
- **[05-merchant-and-vendor-operations.md](./05-merchant-and-vendor-operations.md)** — **Merchant & Vendor Portal Specification**: 2-tier permissions (`PARTICULAR_OUTLET` vs `ALL_OUTLETS_MASTER`), 3-lane KDS, in-memory Web Audio chime, 1-click stockout toggles, rush pause, and sales ledger.
- **[06-rider-fleet-and-dispatch-handbook.md](./06-rider-fleet-and-dispatch-handbook.md)** — **Rider Fleet & Dispatch Handbook**: Courier onboarding gate, shift duty switch with in-flight duty lock, proximity broadcast claiming, 3-step fulfillment, 5-minute unresponsive customer SOP, and cash limits.
- **[07-admin-operations-and-pilot-guide.md](./07-admin-operations-and-pilot-guide.md)** — **Super Admin Operations & 10-Vendor Pilot Guide**: 6-module console architecture, Leaflet fleet radar, manual dispatch overrides, force-cancellation, promotions, RFC 4180 CSV export, and 4-week pilot playbook.

---

## 2. Platform Capability Reference

- For the line-by-line granular capability index with automated test traceability across all 5 sub-projects, consult [`FEATURES.md`](../../FEATURES.md).
- For the non-technical plain-English overview of journeys, screen catalogs, and the commercial model, consult [`00-master-product-overview.md`](./00-master-product-overview.md).
- To locate specific requirements by task without consuming context tokens, use [`context_docs/QUICK_REFERENCE.md`](../QUICK_REFERENCE.md).
