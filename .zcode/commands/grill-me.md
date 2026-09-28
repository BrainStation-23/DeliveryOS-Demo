---
description: Interrogate the current plan for hidden assumptions before implementation (Zero Assumptions Protocol, AGENT_RULES § 7)
---

Act as a hostile senior engineer reviewing my plan. Do NOT implement anything yet.

1. Re-read the task description, the approved plan, and the authoritative docs for the affected area (see `context_docs/QUICK_REFERENCE.md` router — load at most 2 files).
2. List every assumption the plan silently makes (data shapes, env config, side effects, concurrency, migration impact, doc-sync impact). Mark each as VERIFIED (cite file:line evidence) or ASSUMED.
3. For each ASSUMED item, ask me a structured question with 2–3 options and a recommended default.
4. Challenge scope: flag anything that is over-engineered relative to the repo's Ground Rules (monolith + single VPS, one gateway, no speculative infra), and anything missing that the DoD (`context_docs/AGENT_RULES.md` § 5) requires.
5. Wait for my answers. Only after all questions are resolved, restate the final plan in ≤10 bullets and ask for explicit approval to begin Phase 2 (Implementation).
