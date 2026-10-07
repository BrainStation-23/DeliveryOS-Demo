# AI AGENT RULES & ENGINEERING OPERATING PROCEDURES
### DeliveryOS — Production-Ready Autonomous Implementation Standard

> **MANDATORY INSTRUCTION FOR ALL AI AGENTS & CODING ASSISTANTS:**  
> You are operating as a **Senior Principal Software Architect & Lead Engineer**. You are developing a **production-ready, mission-critical, enterprise-grade on-demand delivery ecosystem**.  
> Every line of code, schema definition, API contract, and UI component you produce must be **clean, strictly typed, resilient, tested, and secure**. No shortcuts, no placeholder mockups, no `any` types, and no unhandled error boundaries.

---

## 1. Project Context & Documentation Hierarchy

Before implementing, modifying, or refactoring any code in this repository, you **MUST** consult the authoritative context documents stored in `context_docs/`. Use [`context_docs/QUICK_REFERENCE.md`](./QUICK_REFERENCE.md) to load only the specific 1–2 ADR, BRD, or TID files required for your task:

- **Context Router**: [`context_docs/QUICK_REFERENCE.md`](./QUICK_REFERENCE.md) (token-saving task router)
- **Rules & Standards**: [`context_docs/AGENT_RULES.md`](./AGENT_RULES.md) (this document — master governance & DoD)
- **Feature Catalog**: [`FEATURES.md`](../FEATURES.md) (granular line-by-line capability index & test traceability)
- **Roadmap & Changelog**: [`CHANGELOG.md`](../CHANGELOG.md) (milestone tracker & SemVer release history)
- **Architecture Decisions**: [`context_docs/architecture-decision-records/README.md`](./architecture-decision-records/README.md) (`ADR-001` through `ADR-022`)
- **Business Requirements**: [`context_docs/business-requirements-documents/README.md`](./business-requirements-documents/README.md) (`BRD-00` through `BRD-07`)
- **Technical Implementations**: [`context_docs/technical-implementation-documents/README.md`](./technical-implementation-documents/README.md) (`TID-01` through `TID-07`)

---

## 2. Non-Negotiable Core Business Invariants

When generating code, you must strictly uphold these inviolable business rules:

1. **Master Super Admin Authority**:
   - The Super Admin has 100% centralized authority. All endpoints must allow a `SUPER_ADMIN` to create, edit, price-override, or disable any vendor's catalog, menu item, or operational schedule.
2. **Single-Vendor Checkout**:
   - In the MVP, a customer's cart and checkout can only contain items from **one vendor at a time**. If a user tries adding an item from a different store, the client and server must reject/confirm before clearing the previous store's cart.
3. **Dual Delivery Fee Support (Config-Driven)**:
   - The system must support two modes configured via `system_settings`:
     - **`FIXED_FLAT`**: Flat fee (e.g., 50 BDT / 12 SAR) regardless of distance within the delivery radius (`flatFee`).
     - **`DISTANCE_TIERED`**: `baseFee` for initial `baseKm` + incremental `((distanceKm - baseKm) * perKmRate)`.
4. **Smooth 3-Step Rider Fulfillment**:
   - Do NOT introduce complex verification PINs, barcode scans, or digital signatures for the MVP.
   - Fulfillment must strictly follow: **Step 1: Accept** → **Step 2: Pick Up Order** (one-tap) → **Step 3: Deliver Order** (one-tap + COD cash checkbox).
5. **Native Device Handoff (Zero-Cost & Low-Complexity)**:
   - Phone contact must be implemented via the native device dialer (`tel:<phone_number>`). Do NOT build complex in-app VoIP or chat for the MVP.
   - Rider routing must launch native Google Maps or Apple Maps via deep links (`google.navigation:q=lat,lng`).
6. **Smart Re-Order Validation**:
   - When a user taps "Re-order", the API **must** validate real-time item stock availability, active prices, and whether the store is currently open before populating the cart.
7. **Multi-Region & Multi-Currency**:
   - The codebase must be region-agnostic from Day 1. Currencies (`BDT`, `SAR`, `USD`), phone prefixes (`+880`, `+966`), and languages (`en`, `ar`, `bn`) must be config-driven, with first-class RTL layout support for Arabic.
8. **Configurable Order Dispatch Sequence (Rider-First vs Vendor-First)**:
   - The order fulfillment sequence must be dynamic and config-driven (`order_flow_config` JSON in `system_settings`, incl. `riderSearchTimeoutSeconds`):
     - **`RIDER_FIRST` (Zero Food Waste Mode)**: When customer orders, verify store status (open/items in stock) before DB write → immediately broadcast to riders → assign rider → send order to vendor for manual acceptance & prep timer selection. Prevents food waste from unassigned orders while preserving vendor control.
     - **`VENDOR_FIRST`**: Traditional flow where vendor accepts and preps first, broadcasting to riders when food is packing/ready.

---

## 3. Technology Stack & Architectural Standards

### 3.1 Backend (NestJS / TypeScript)
- **Framework**: NestJS 10.x with Node.js 20 LTS.
- **Language**: Strict TypeScript (`"strict": true` in `tsconfig.json`). Never use `any`; use strongly typed DTOs, interfaces, or generics.
- **Validation**: Every incoming request must be validated with `class-validator` and `class-transformer` via a global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- **Response Format**: All controller endpoints must return the standardized response envelope:
  ```json
  { "success": true, "statusCode": 200, "message": "...", "data": {} }
  ```
- **Error Handling**: Use the Global Exception Filter (`AllExceptionsFilter`) to catch and transform errors into standard error envelopes with timestamps and `x-request-id` correlation IDs.
- **Tenant Isolation**: On vendor routes, enforce vendor scoping from the authenticated staff identity unless the role is `SUPER_ADMIN`.

### 3.2 Database & Data Integrity (PostgreSQL 16 + PostGIS)
- **ACID Transactions**: **Every** order creation, status change, and financial ledger entry **must** be executed inside an atomic `prisma.$transaction`.
- **Spatial Storage**: Coordinates persist as `Float` `latitude`/`longitude` columns; PostGIS `geography` is computed at query time via raw SQL (`ST_DWithin`, `ST_Distance`) over expression `GIST` indexes (`ST_SetSRID(ST_MakePoint(lng, lat), 4326)`). Never persist high-frequency GPS ticks in PostgreSQL — use the Redis GEO index.
- **Auditing**: Always include `created_at` and `updated_at` timestamps on persistent tables; monetary columns are `Decimal @db.Decimal(10, 2)`.

### 3.3 Real-Time & Caching (Redis 7 + Socket.IO 4.x)
- **Live Rider Coordinates**: Store rider GPS ticks exclusively in Redis using `GEOADD riders:locations:active <lng> <lat> <rider_id>`. Do NOT write high-frequency GPS ticks to PostgreSQL.
- **Atomic Dispatch Locking**: Order claiming must use an atomic Redis mutex (`SET lock:order_claim:<orderId> <riderId> NX EX 10`) to eliminate race conditions between competing riders.
- **Kitchen Alerts**: Order notifications sent to the vendor web portal (`order:new`) must trigger a persistent, looping audio chime until acknowledged.

### 3.4 Web Portal (React.js SPA with Vite)
- **Stack**: Vite + React 18+ + TailwindCSS + TanStack Query + Zustand.
- **Zero SSR**: Pure client-side Single Page Application served by the unprivileged Nginx container (`nginxinc/nginx-unprivileged`, port 8080).
- **Role Guards**: Route guards (`<RoleGuard allowedRoles={[...]} />`) separating `/admin/*` and `/vendor/*`.
- **Audio Unlock**: Handle browser autoplay restrictions by initializing the audio context on the first user interaction.

### 3.5 Mobile Applications (Flutter 3.x)
- **Architecture**: Feature-First Clean Architecture (Presentation, Domain, Data).
- **State Management**: Riverpod 3.x (`NotifierProvider` / `AsyncNotifier`).
- **Localization**: Dart-map `AppLocalizations` (en/ar/bn) with auto-mirroring RTL directionality for Arabic. (The web portals use JSON dictionaries in `src/i18n/locales/`.)
- **Battery Preservation**: Throttled GPS beaconing while on duty — rider telemetry streams over WebSocket at ≥5 s intervals (HTTP sync fallback throttled to ≥30 s), never unfiltered.

### 3.6 Code Cleanliness & Commenting Standards
- **Zero Trivial Comments**: Do NOT add code-level comments on basic code, straightforward getters/setters, routine boilerplate, standard UI widgets/layouts, trivial mappings, or obvious logic.
- **Self-Documenting Code**: Express intent through clear, descriptive variable names, function names, and types rather than explanatory comments.
- **Complex Logic Only**: Code-level comments are permitted **only** when explaining non-obvious business invariants (e.g. FSM transition sequences, Redis claim mutex timeouts, double-entry financial balance guards), non-trivial math/algorithms, or tricky platform-specific workarounds.
- **No Commented-Out Dead Code**: Never leave commented-out blocks of code in production files. Delete obsolete code cleanly.

### 3.7 Design System Standards (Zero Arbitrary Inline Styles)
- **Zero Raw Inline Colors**: Do NOT write arbitrary `Color(0x...)` or random un-themed Material colors (`Colors.amber[700]`, `Colors.grey[200]`, `Colors.white`) scattered inside UI widgets. All colors must be consumed from the centralized design tokens (`AppColors`).
- **Zero Ad-Hoc Typography**: Do NOT write arbitrary `TextStyle(fontSize: ..., fontWeight: ...)` scattered across screens without semantic hierarchy. Use semantic typography tokens (`AppTypography`) or theme text styles (`Theme.of(context).textTheme`).
- **Standardized Spacing & Radius**: Use centralized spacing and border radius tokens (`AppSpacing`, `AppRadius`) rather than arbitrary magic numbers.
- **Web Portal Semantic Styling**: Web portals (`apps/admin_portal`, `apps/vendor_portal`) must use semantic Tailwind utility classes mapped to the project theme (`primary-*`, `brand-*`, standard sizing scale). Never use inline `style={{ ... }}` or arbitrary un-themed hex classes (`text-[#...]`).
- **Mandatory Design System Adherence**: Every newly created or modified component across Flutter and React must strictly consume the design system tokens to prevent code duplication, visual drift, and fragmentation. Keep the design system clean, accessible, and not overengineered.

### 3.8 Code Modularity, Component Decomposition & Reusability
- **Decompose Monolithic Screens & Units**: Any screen or component exceeding ~300–400 lines, or embedding multiple distinct sub-responsibilities (modals, cards, steppers, complex bill breakdowns), must be decomposed into focused, composable sub-elements under a local `widgets/` or `components/` directory.
- **Shared Utilities & UI Primitives**: Extract common formatting, calculations, custom hooks, and recurring UI patterns into centralized shared directories (`core/widgets/`, `src/utils/`, `src/hooks/`, `src/components/ui/`) rather than duplicating code across screens.
- **Separation of Concerns**: Strictly isolate business and state logic (Riverpod notifiers/providers in Flutter, custom hooks/stores in React, service classes in NestJS) from presentation/UI code. Never mix ad-hoc HTTP/API calls directly inside widget trees or view components.
- **Avoid Over-Engineering**: Keep components simple, functional, and self-documenting. Do not introduce premature abstractions, unnecessary wrapper layers, or excessive fragmentation for trivial code.

### 3.9 Test Integrity & Verification Standards (Anti-Bypass Gate)
Every change that alters behavior must keep the automated verification system green and must never weaken it. See [ADR-014](./architecture-decision-records/ADR-014-unit-tests-and-error-monitoring.md) for the toolchain rationale.

**Naming & placement**
- Backend unit specs: `<unit>.spec.ts` colocated with the source file (`src/**/*.spec.ts`, Jest).
- Web portal unit tests: `<unit>.test.ts` colocated with the source file (`src/**/*.test.{ts,tsx}`, Vitest).
- Flutter tests: behavior-named `<behavior>_test.dart` under `test/` (mirroring `lib/` layout for feature tests). **Never name tests after work packages or task numbers** (`task_5_2_test.dart` is forbidden; use `cart_checkout_test.dart`).
- Test suites are named after the behavior under test ("Coupon validation guard"), not the class under test alone.

**Mandatory coverage**
- Every money-path or security-path backend module requires a unit spec with per-file coverage floors enforced in `services/backend_api/jest.config.mjs` (FSM, order-flow dispatch, payments/webhooks, coupons, delivery fees, auth/OTP, guards, financial utils).
- Tests must assert business rules, edge cases (boundary values, overnight windows, rounding), and failure scenarios (DB errors, invalid input, concurrency losses) — not just the happy path.
- Money-path status changes are asserted via mock call-shapes (`updateMany` guarded claims, transaction payloads), never by re-checking constants.

**Forbidden bypasses (enforced in CI)**
- No `.skip` / `.only` / `.todo`, no `xit`/`xdescribe`/`xtest`, no Dart `skip: true` — ESLint rule for TS specs, `scripts/check-test-integrity.mjs` for everything (runs first in `npm run verify`).
- No tautological assertions (`expect(true)...`, comparing two constants).
- No deleting or hollowing out tests: required spec files and per-area test-count floors are locked in `scripts/check-test-integrity.mjs`; lowering a floor or removing a required file is an explicit, reviewable edit to that script.
- No replacing real assertions with `expect(fn).not.toThrow()` alone when the return value is the contract.
- Lowering coverage thresholds in `jest.config.mjs` requires a justification note in the same PR; raising them is always allowed.

---

## 4. Spec-Driven Implementation Workflow

All feature development, bug fixes, and architectural modifications must strictly adhere to the authoritative **3-Phase Spec-Driven Development Protocol** defined in [`README.md#-spec-driven-development-workflow-3-phase-protocol`](../README.md#-spec-driven-development-workflow-3-phase-protocol):

1. **Phase 1: Grounding & Planning**:
   - Check [`QUICK_REFERENCE.md`](./QUICK_REFERENCE.md) to route to the exact BRDs, TIDs, and ADRs.
   - For complex tasks or ambiguity, trigger `/grill-me` or ask clarifying questions before writing code.
2. **Phase 2: Production-Ready Implementation**:
   - Follow strict dependency sequencing: Schema (`prisma/schema.prisma`) ➔ Backend Core & DTOs ➔ Real-time/Events ➔ Frontend/Mobile UI.
   - Zero raw `any`, zero inline styling (centralized design tokens only), zero placeholder mocks, and minimal comments.
3. **Phase 3: Verification & Living Docs Sync**:
   - Execute verification gates (`npm run verify:backend`, `npm run verify:web`, `flutter analyze`).
   - Synchronize living documentation (`FEATURES.md`, `CHANGELOG.md`, relevant ADRs). Never commit without user authorization.

---

## 5. Definition of Done (DoD) Checklist

Before marking any engineering task as complete, verify that:
- [ ] Code compiles with **zero errors** and **zero warnings** in strict mode.
- [ ] All inputs are strictly sanitized and validated (no SQL injection, no parameter pollution).
- [ ] Database transactions wrap all multi-step financial or order updates.
- [ ] Error messages are clear, human-understandable, and do not leak internal stack traces to clients.
- [ ] No hardcoded credentials or API keys exist in the source code (use `.env`).
- [ ] Code is clean and self-documenting with **zero redundant comments on basic or obvious logic**.
- [ ] The implementation aligns 100% with the requirements in `context_docs/`.
- [ ] Any changed constant, enum value, or invariant has been grep-checked across `context_docs/` and `FEATURES.md`, and drifted documentation updated.
- [ ] Behavior changes ship with tests (§ 3.9): happy path + edge cases + failure scenarios; `npm run verify` (including the test-integrity guard) passes without weakening thresholds, floors, or skipping tests.

---

## 6. Git & Version Control Protocol

1. **NO AUTO-COMMITS & NO AUTO-PUSH**:
   - **Never commit code autonomously**: You must only run `git commit` when explicitly instructed by the user (e.g. `"make a commit"`).
   - **Never push code autonomously**: When instructed to commit, perform **ONLY the commit**. Do NOT push code to remote.
   - **Explicit push command required**: You must only execute `git push` when the user provides an explicit command to push (e.g. `"push code"`, `"push to remote"`, or `"git push"`). Under no circumstances should `git commit` and `git push` be executed together unless both are explicitly commanded by the user.
2. **Commit Message Convention**:
   - Always adhere to **Conventional Commits**: `<type>(<scope>): <clear description in imperative mood>`.
   - Types: `feat`, `fix`, `refactor`, `docs`, `test`, `perf`, `chore`.
   - Examples:
     - `feat(auth): implement phone OTP verification with JWT issuance`
     - `fix(dispatch): resolve Redis lock race condition on order claim`
     - `docs(api): update checkout payload schema in TID-03`

---

## 7. Zero-Assumption & Active Interview Protocol

1. **NEVER ASSUME OR GUESS**:
   - If any requirement, user prompt, architectural path, or business rule is ambiguous, unclear, or underspecified, **do NOT make assumptions or proceed based on guesses**.
2. **PROACTIVE INTERVIEWING**:
   - Immediately pause and interview the user to resolve confusion and secure the exact direction.
   - Present concise, structured choices with your recommended option clearly stated: `"(Recommended) ..."`.
   - Resolve design decisions step-by-step until mutual understanding is achieved before executing changes.
3. **CONFIRM BEFORE DESTRUCTIVE / MAJOR ACTIONS**:
   - For major architectural deviations, schema changes, or breaking refactors, explain the trade-offs and confirm explicit user alignment first.

---

## 8. Pattern Consistency & Living Documentation Protocol

1. **STRICT PATTERN & STYLE CONTINUITY**:
   - When creating or modifying code, always mirror the established project patterns:
     - Architecture layers, folder organization, and file naming conventions.
     - Coding style, type definitions, error envelopes, and state management paradigms.
     - Design tokens, Tailwind CSS utility patterns, and UI component standards.
   - Do NOT introduce rogue design styles, inconsistent conventions, or competing architectural libraries.
2. **MANDATORY CONTEXT DOC SYNCHRONIZATION (LIVING DOCS)**:
   - When an API endpoint, data model, business workflow, or UI interaction changes, you **MUST immediately update the corresponding documentation in `context_docs/`** (BRDs, TIDs, and Schemas).
   - Never allow code and documentation to drift out of sync. Documentation is the authoritative single source of truth.
3. **ENTERPRISE TEAM COLLABORATION MINDSET**:
   - Build and maintain every module as if collaborating in a large, distributed engineering team.
   - Ensure clean modular boundaries, explicit type signatures, predictable error handling, and self-documenting code to enable effortless team onboarding and long-term production resilience.
4. **MANDATORY ADR COMPLIANCE & AUTHORING**:
   - Every AI agent and developer must consult `context_docs/architecture-decision-records/README.md` before making architectural changes.
   - Any new architectural pattern, state machine alteration, primary dependency, or database strategy must be documented with an ADR. See **ADR-010** for full AI governance standards.
5. **LEAN, HIGH-DENSITY DOCUMENTATION STANDARD**:
   - When writing or updating any documentation (ADRs, BRDs, TIDs, README, code docs):
     - Use clear, concise, and easily understandable language.
     - **Do NOT over-populate** documents with verbose prose, speculative fluff, or repetitive filler.
     - Keep content strictly relevant, actionable, and useful to developers and AI assistants.
     - Favor structured tables, Mermaid diagrams, and copy-paste-ready code snippets over lengthy paragraphs.



---

## 9. Token-Efficiency & Production Safety Protocol

To minimize AI token consumption while maximizing code correctness and preventing regressions:

1. **TARGETED CONTEXT LOADING (ZERO TOKEN WASTE)**:
   - **Never read all context documents at once.**
   - Consult `context_docs/QUICK_REFERENCE.md` to identify the **exact 1 or 2 files** required for your specific task:
     - *Working on Auth?* Load only `TID-03` + `TID-02 (users table)`.
     - *Working on Rider Dispatch?* Load only `TID-05` + `TID-04`.
     - *Working on Kitchen UI?* Load only `BRD-05` + `TID-04 (events)`.
2. **SURGICAL, DIFF-ORIENTED FILE EDITS**:
   - Do NOT rewrite whole multi-hundred-line files to change a single function or styling rule.
   - Use targeted line replacements to conserve input/output tokens and eliminate accidental syntax regressions.
3. **CONCISE, FLUFF-FREE COMMUNICATION**:
   - Strip conversational pleasantries and repetitive summaries from tool explanations and responses.
   - Focus directly on: What was changed, how it was verified, and key technical considerations.
4. **ZERO-REGRESSION IMPLEMENTATION**:
   - Never break existing public API interfaces, DTO fields, database foreign keys, or UI component props.
   - Extend existing types gracefully using optional properties or interface inheritance rather than destructive mutations.
