# Autonomous AI Agents & Coding Assistants Guide

Welcome! If you are an AI coding assistant or developer working on **DeliveryOS**:

⚡ **TOKEN-SAVING FAST ENTRY**:  
Before loading large documentation files, inspect the **Context Router** to identify the exact 1–2 files needed for your specific task:  
👉 **[`context_docs/QUICK_REFERENCE.md`](./context_docs/QUICK_REFERENCE.md)**

🧭 **MANDATORY ENGINEERING WORKFLOW**:  
Every feature, bug fix, or refactor must follow the 3-Phase Spec-Driven Development Workflow:  
👉 **[`README.md#spec-driven-development-workflow-3-phase-protocol`](./README.md#-spec-driven-development-workflow-3-phase-protocol)**

---

## 📚 Master Engineering Specifications & Index

All authoritative system rules, business workflows, technical specifications, and architecture decisions are maintained in `context_docs/`:

1. **[Spec-Driven Development Workflow](./README.md#-spec-driven-development-workflow-3-phase-protocol)** — Authoritative 3-phase engineering protocol (Plan ➔ Implement ➔ Verify & Sync) and repeatable checklists directly on root README.
2. **[Master AI Agent Rules & Invariants](./context_docs/AGENT_RULES.md)** — Authoritative engineering standards, DoD, and governance.
3. **[Quick Reference & Context Router](./context_docs/QUICK_REFERENCE.md)** — Token-efficient task-to-document routing table (load 1–2 files only).
4. **[Master System Feature Catalog](./FEATURES.md)** — Line-level, granular breakdown of every capability across all 5 sub-projects.
5. **[Changelog, Milestones & Engineering Roadmap](./CHANGELOG.md)** — Step-by-step engineering roadmap, active milestone tracker, and standardized Keep a Changelog (SemVer) release history.
6. **[Architecture Decision Records (ADR)](./context_docs/architecture-decision-records/README.md)** — Permanent architectural contracts and state machines (`ADR-001` through `ADR-015`).
7. **[Business Requirements Documents (BRD)](./context_docs/business-requirements-documents/README.md)** — Core business rules, user journeys, and personas (`BRD-00` through `BRD-07`).
8. **[Technical Implementation Documents (TID)](./context_docs/technical-implementation-documents/README.md)** — System architecture, schemas, APIs, and devops (`TID-01` through `TID-07`).

---

## ⚡ Core Operational Invariants Matrix

To prevent command misinterpretation or skipped instructions, every AI agent must adhere to the invariants below. For complete technical rationale and enforcement procedures, follow the linked sections in **[`AGENT_RULES.md`](./context_docs/AGENT_RULES.md)**:

| Invariant | Direct Rule Command | Authoritative Section in `AGENT_RULES.md` |
| :--- | :--- | :--- |
| **Commit Authority** | **NO AUTO-COMMITS**: Never run `git commit` autonomously. Run `git commit` **only** when explicitly commanded by the user (e.g. `"make a commit"`). | [Git Protocol (§ 6.1)](./context_docs/AGENT_RULES.md#6-git--version-control-protocol) |
| **Push Authority** | **NO AUTO-PUSH**: When commanded to commit, execute **ONLY the local commit**. Never run `git push` without an explicit, distinct push command (e.g. `"push to remote"` or `"git push"`). | [Git Protocol (§ 6.1)](./context_docs/AGENT_RULES.md#6-git--version-control-protocol) |
| **Type Safety** | **ZERO RAW `any`**: Maintain strict typing (`"strict": true`). Declare explicit DTOs, interfaces, or Prisma types; never cast to `any`. | [Backend & Frontend Standards (§ 3)](./context_docs/AGENT_RULES.md#3-technology-stack--architectural-standards) & [ADR-010](./context_docs/architecture-decision-records/ADR-010-ai-driven-engineering-governance-and-no-auto-commits.md) |
| **Design System Invariant** | **ZERO INLINE STYLING**: Never use hardcoded inline colors (e.g. `Color(0x...)`, `Colors.amber`), arbitrary un-themed Tailwind values (`text-[#...]`), or scattered ad-hoc text styles. Use centralized tokens (`AppColors`, `AppTypography`, `AppSpacing`, Tailwind semantic classes). | [Design System Standard (§ 3.7)](./context_docs/AGENT_RULES.md#37-design-system-standards-zero-arbitrary-inline-styles) |
| **Production Realism** | **ZERO PLACEHOLDER SHORTCUTS**: Implement real production code without mock fallbacks, empty `TODO`s, or deleted failing tests. | [Definition of Done (§ 5)](./context_docs/AGENT_RULES.md#5-definition-of-done-dod) |
| **Code Modularity & Reusability** | **DECOMPOSE & REUSE**: Never write monolithic screens/components (>300–400 lines) or duplicate logic. Decompose complex UI into focused, composable units under `widgets/` or `components/`. Extract shared utilities, hooks, and UI primitives. Strictly isolate state/business logic from presentation. Avoid over-engineering. | [Modularity & Reusability (§ 3.8)](./context_docs/AGENT_RULES.md#38-code-modularity-component-decomposition--reusability) |
| **Spec-Driven Workflow** | **MANDATORY 3-PHASE WORKFLOW**: Always execute Plan & Grounding ➔ Implementation ➔ Verification & Living Docs Sync. | [Spec-Driven Workflow](./README.md#-spec-driven-development-workflow-3-phase-protocol) |
| **Architectural Sync** | **ADR SYNCHRONIZATION**: Any modification to dependencies, state machines, storage, or ingress requires an ADR update or creation. | [Pattern Consistency (§ 8.4)](./context_docs/AGENT_RULES.md#8-pattern-consistency--living-documentation-protocol) & [ADR Index](./context_docs/architecture-decision-records/README.md) |
| **Lean Documentation** | **CONCISE & USEFUL ONLY**: Keep all documentation clear, concise, and understandable. Do not over-populate with verbose prose or speculative filler. | [Living Docs Standard (§ 8.5)](./context_docs/AGENT_RULES.md#8-pattern-consistency--living-documentation-protocol) |
| **Code Commenting** | **NO TRIVIAL COMMENTS**: Do not add comments on basic code, obvious functions, simple UI widgets, or routine boilerplate. Code must be self-documenting. Add comments **only** for complex algorithms, subtle business invariants, or tricky edge cases. | [Clean Code & Minimal Comments (§ 3.6)](./context_docs/AGENT_RULES.md#36-code-cleanliness--commenting-standards) |
| **Active Clarification** | **ZERO ASSUMPTIONS**: If a requirement or user prompt is ambiguous, pause and ask structured questions with recommended options before executing. | [Active Interview Protocol (§ 7)](./context_docs/AGENT_RULES.md#7-zero-assumption--active-interview-protocol) |
