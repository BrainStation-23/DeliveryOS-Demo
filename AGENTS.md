# Autonomous AI Agents Guide (DeliveryOS)

🧭 **Context Router**: [`context_docs/QUICK_REFERENCE.md`](./context_docs/QUICK_REFERENCE.md) — load only the 1–2 files your task needs.
⚡ **Mandatory Workflow**: 3-Phase Protocol (Plan ➔ Implement ➔ Verify & Sync) in [`README.md`](./README.md#-spec-driven-development-workflow-3-phase-protocol).

---

## 📌 Repo Facts (Verified)

- **Stack**: `services/backend_api` (NestJS 10 + Prisma 5, port 4000, prefix `/api/v1`) • `apps/admin_portal` + `apps/vendor_portal` (React 18 + Vite + Tailwind + Zustand + TanStack Query; dev ports 3000/3001) • `apps/customer_app` + `apps/rider_app` (Flutter, Riverpod 3, Dio). No shared packages — apps intentionally own their `core/` code.
- **Quality gate**: `npm run verify` at root (mirrors CI in `.github/workflows/ci.yml`). Backend integration suites: `npm test` in `services/backend_api` (live stack); unit tests: `npm run test:unit` (no DB needed).
- **Datastores**: PostgreSQL 16 + PostGIS (`localhost:5433`), Redis 7.2 (`localhost:6380`). Boot via `./scripts/start-local.sh`.
- **Auth**: phone OTP only (no passwords anywhere). Dev seeded logins use OTP `123456`: Super Admin `+8801700000001`, vendor branch manager `+8801700000002`, brand owner `+8801700000003`.
- **Canonical sources**: schema = `services/backend_api/prisma/schema.prisma` (22 models) • endpoints = `TID-03` • WS events = `TID-04` • FSM = `src/modules/orders/order-state.machine.ts` • fees = `src/modules/promotions/pricing/delivery-fee.service.ts`.

---

## 📚 Master Specifications & Index
- **Rules & Standards**: [`context_docs/AGENT_RULES.md`](./context_docs/AGENT_RULES.md) (authoritative governance & DoD)
- **Feature Catalog**: [`FEATURES.md`](./FEATURES.md) (granular capability index + test traceability)
- **Roadmap & Changelog**: [`CHANGELOG.md`](./CHANGELOG.md) (milestone tracker & SemVer release history)
- **ADR Index**: [`context_docs/architecture-decision-records/README.md`](./context_docs/architecture-decision-records/README.md) (`ADR-001` through `ADR-015`)
- **BRD Suite**: [`context_docs/business-requirements-documents/README.md`](./context_docs/business-requirements-documents/README.md) (`BRD-00` through `BRD-07`)
- **TID Suite**: [`context_docs/technical-implementation-documents/README.md`](./context_docs/technical-implementation-documents/README.md) (`TID-01` through `TID-07`)

---

## ⚡ Core Operational Invariants Matrix

Every AI agent must adhere to these invariants. Full rationale and enforcement procedures: the linked sections in **[`AGENT_RULES.md`](./context_docs/AGENT_RULES.md)**.

| Invariant | Direct Rule | Authoritative Section in `AGENT_RULES.md` |
| :--- | :--- | :--- |
| **Commit Authority** | **NO AUTO-COMMITS**: run `git commit` **only** on an explicit user command (e.g. `"make a commit"`). | [Git Protocol (§ 6)](./context_docs/AGENT_RULES.md#6-git--version-control-protocol) |
| **Push Authority** | **NO AUTO-PUSH**: when told to commit, execute **only** the local commit. `git push` requires its own explicit command. | [Git Protocol (§ 6)](./context_docs/AGENT_RULES.md#6-git--version-control-protocol) |
| **Type Safety** | **ZERO RAW `any`**: maintain strict typing (`"strict": true`); declare explicit DTOs, interfaces, or Prisma types. | [Tech Standards (§ 3.1)](./context_docs/AGENT_RULES.md#3-technology-stack--architectural-standards) & [ADR-010](./context_docs/architecture-decision-records/ADR-010-ai-driven-engineering-governance-and-no-auto-commits.md) |
| **Design System** | **ZERO INLINE STYLING**: no hardcoded colors (`Color(0x...)`, `Colors.amber`), no arbitrary Tailwind (`text-[#...]`). Use `AppColors`/`AppTypography`/`AppSpacing`/Tailwind semantic classes. | [Design System (§ 3.7)](./context_docs/AGENT_RULES.md#37-design-system-standards-zero-arbitrary-inline-styles) |
| **Production Realism** | **ZERO PLACEHOLDER SHORTCUTS**: real production code only — no mock fallbacks, empty `TODO`s, or deleted failing tests. | [Definition of Done (§ 5)](./context_docs/AGENT_RULES.md#5-definition-of-done-dod) |
| **Modularity** | **DECOMPOSE & REUSE**: no monolithic screens (>300–400 lines) or duplicated logic; isolate state/business logic from presentation; avoid over-engineering. | [Modularity (§ 3.8)](./context_docs/AGENT_RULES.md#38-code-modularity-component-decomposition--reusability) |
| **Spec-Driven Workflow** | **3-PHASE WORKFLOW**: always Plan & Grounding ➔ Implementation ➔ Verification & Living Docs Sync. | [Spec-Driven Workflow](./README.md#-spec-driven-development-workflow-3-phase-protocol) |
| **Architectural Sync** | **ADR SYNCHRONIZATION**: dependency, state-machine, storage, or ingress changes require an ADR update/creation. | [Living Docs (§ 8)](./context_docs/AGENT_RULES.md#8-pattern-consistency--living-documentation-protocol) & [ADR Index](./context_docs/architecture-decision-records/README.md) |
| **Lean Documentation** | **CONCISE & USEFUL ONLY**: docs stay clear, dense, and free of verbose prose or speculative filler. | [Living Docs (§ 8)](./context_docs/AGENT_RULES.md#8-pattern-consistency--living-documentation-protocol) |
| **Code Commenting** | **NO TRIVIAL COMMENTS**: comment only complex algorithms, subtle business invariants, or tricky edge cases. | [Commenting (§ 3.6)](./context_docs/AGENT_RULES.md#36-code-cleanliness--commenting-standards) |
| **Active Clarification** | **ZERO ASSUMPTIONS**: pause and ask structured questions (with recommended options) when requirements are ambiguous. | [Interview Protocol (§ 7)](./context_docs/AGENT_RULES.md#7-zero-assumption--active-interview-protocol) |
