# Phase 1: Deterministic Core, Lesson Rendering & Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 1-Deterministic Core, Lesson Rendering & Persistence
**Areas discussed:** Tech Stack for Phase 1, State & Persistence Strategy, Order-Builder Interaction Model, Lesson Loading & Validation

**Mode:** `--auto` — all areas auto-selected, no interactive prompts. Recommended option chosen for each.

---

## Tech Stack for Phase 1

| Option | Description | Selected |
|--------|-------------|----------|
| Plain HTML/CSS/JavaScript (literal SPEC.md §4 wording) | No build step, no type system | |
| TypeScript + Vite + Vitest + Zod | Per `research/STACK.md`; compiles to static JS, adds type-checking and testability | ✓ |

**Selection:** TypeScript + Vite + Vitest + Zod (recommended default)
**Notes:** Stays within "browser-only, no backend" constraint — TS output is still static JS/HTML/CSS. Chosen because the deterministic core is the most heavily-graded part of this diploma MVP, and type-checking + unit tests materially reduce risk there.

---

## State & Persistence Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Debounced localStorage writes | Fewer writes, small risk window on abrupt close | |
| Synchronous write after every state-changing event | Zero risk window, simplest reasoning about "did it save" | ✓ |

**Selection:** Synchronous write after every state-changing event (recommended default)
**Notes:** Also decided: persisted state must include current lesson session position (step/exercise index, theory-understood flag) — not just cross-session history fields — to satisfy Phase 1 Success Criterion #4 ("restores exactly where the child left off").

---

## Order-Builder Interaction Model

| Option | Description | Selected |
|--------|-------------|----------|
| Drag-and-drop word ordering | Common in mature apps, more failure-prone for kids/touch devices | |
| Tap-to-append / tap-to-remove word bank | Simple, robust across input methods | ✓ |

**Selection:** Tap-to-append / tap-to-remove (recommended default)
**Notes:** Interaction mechanics only — Phase 5 can restyle chips/animations without changing the underlying tap model.

---

## Lesson Loading & Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Trust `Lesson-1A.json` as-is, no load-time check | Simpler, but silent failures on schema drift | |
| Validate against Zod schema at load, fail loudly on mismatch | Surfaces `PITFALLS.md`-flagged schema/content risk immediately | ✓ |

**Selection:** Validate at load time, fail loudly (recommended default)
**Notes:** Every downstream phase depends on lesson data being structurally trustworthy — this is a Phase 1 concern, not deferred.

---

## Claude's Discretion

- Exact module/file layout for Phase 1 code (StateStore, LessonLoader, per-type renderers) — left to planner/executor, informed by `research/ARCHITECTURE.md`.
- Normalization implementation details for `text-input` exact-match — follows SPEC.md §7 literally, no additional decision needed.

## Deferred Ideas

None — discussion stayed within Phase 1 scope. Agent integration (Phase 3/4), reward/review-queue logic (Phase 2), and visual design (Phase 5) were correctly recognized as out of scope for this discussion.
