# Phase 1: Deterministic Core, Lesson Rendering & Persistence - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a fully playable lesson with **zero AI dependency**: the child can see the theory block, complete all 19 exercises across the 4 exercise types in `Lesson-1A.json` (`text-input`, `single-choice`, `matching`, `order-builder`), get correct/incorrect feedback from deterministic exact-match/comparison logic only, and have progress survive a full page reload via `localStorage`. Agents (Answer Checker, Theory Tutor, Progress Advisor, Reward Advisor, Parent Report Generator), the reward/review-queue engine, and visual polish are explicitly out of scope — they belong to Phases 2-5.

</domain>

<decisions>
## Implementation Decisions

Discussion ran in `--auto` mode: for each gray area below, the recommended option was auto-selected (no interactive prompts). Logged inline per gray area.

### Tech Stack for Phase 1

[auto] Tech Stack — Q: "SPEC.md §4 literally says 'HTML/CSS/JavaScript'; research/STACK.md recommends vanilla TypeScript + Vite + Vitest + Zod. Which do we build Phase 1 on?" → Selected: "TypeScript + Vite + Vitest + Zod" (recommended default)

- **D-01:** Use TypeScript (not plain JS) with Vite as the build tool and Vitest for tests, per `research/STACK.md`. This stays within SPEC.md's "no backend, browser-only" constraint (TS compiles to the same static JS bundle) while making the deterministic core — the part of the MVP graded most heavily — type-checked and unit-testable from day one.
- **D-02:** Use Zod to define and validate the `Lesson-1A.json` shape (`lesson-json-v1`) at load time. This directly addresses the PITFALLS.md-flagged risk that `acceptedAnswers` completeness and lesson-schema drift are silent failure modes; a validation failure at load time surfaces loudly instead of producing confusing runtime bugs later. The same Zod pattern will be reused for agent-response validation in Phase 3, so introducing it now is consistent, not premature.

### State & Persistence Strategy

[auto] Persistence Timing — Q: "Write to localStorage synchronously after every state-changing event, or debounce writes?" → Selected: "Synchronous write after every `exercise_attempt`-equivalent state change" (recommended default)

- **D-03:** Every state-changing action (exercise answered, theory step marked understood, lesson position advanced) triggers an immediate synchronous `localStorage` write under the single key `english-quest-progress-v1`. No debouncing. Rationale: PERSIST-02 and Phase 1 Success Criterion #4 require that a reload restores "exactly where the child left off" — debounced/delayed writes risk losing the last action on an untimely reload, which is unacceptable for a young child who may close the tab mid-exercise.
- **D-04:** Persisted state includes not just `studentProfile`/`lessonHistory`/stats (per SPEC.md §7) but also **current lesson session position** — which step/exercise the child is on and whether the theory block was already marked "понятно" — so a reload mid-theory or mid-exercise resumes at the same point rather than restarting the lesson from the top. This is required to satisfy Phase 1's own success criterion #4 literally ("restores exactly where the child left off"), which is broader than the persistence fields SPEC.md enumerates for cross-session history.

### Order-Builder Interaction Model

[auto] Order-Builder UX — Q: "How does the child assemble word order — drag-and-drop, or tap-to-append/tap-to-remove?" → Selected: "Tap-to-append word bank + tap-to-remove-from-sequence, no drag-and-drop" (recommended default)

- **D-05:** `order-builder` exercises use a tap-based interaction: available words shown as tappable chips in a word bank; tapping a chip appends it to the answer sequence; tapping a chip already in the sequence removes it (or moves it back to the bank). No drag-and-drop in Phase 1. Rationale: drag-and-drop is materially more failure-prone for a young Intermediate-level child on unknown devices (touch vs. mouse, accidental drags) and is a UI/interaction-mechanics choice, not a visual-polish choice — Phase 5 can restyle the chips/animations without changing this underlying interaction model.

### Lesson Loading & Validation

[auto] Load-Time Validation — Q: "Trust Lesson-1A.json as-is, or validate its structure at load time and fail loudly on mismatch?" → Selected: "Validate at load time via the Zod schema (D-02), fail loudly with a clear error if invalid" (recommended default)

- **D-06:** On app start, `Lesson-1A.json` is parsed and validated against the Zod schema before any rendering happens. A validation failure shows a clear, non-cryptic error state rather than allowing the app to render with malformed/missing exercise data. This is a Phase 1 concern (lesson rendering foundation), not deferred to later phases, because every downstream phase depends on lesson data being structurally trustworthy.

### Claude's Discretion

- Exact module/file layout within the Phase 1 codebase (e.g., how `StateStore`, `LessonLoader`, and per-exercise-type renderers are split into files) is left to the planner/executor, informed by `research/ARCHITECTURE.md`'s suggested component boundaries (StateStore core, LessonLoader, exercise renderers per type).
- Specific normalization regex/implementation details for `text-input` exact-match (case, whitespace, punctuation stripping) follow SPEC.md §7 literally; no additional decision needed here.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specification
- `SPEC.md` §5 (Lesson data schema), §6 (core/agent boundary table — Phase 1 owns the "core" row only), §7 (Deterministic core: storage model, normalization, counters), §9 (steps 1-3 of `checkAnswer()` — deterministic path only for Phase 1), §11 (Theory block interaction), §15 (Lesson screen layout — structural elements only, visual styling is Phase 5), §17 (steps 1-3, 5 of the one-lesson pipeline) — the full MVP spec; Phase 1 implements the deterministic-only slices of these sections
- `Lesson-1A.json` — the actual lesson content and schema (`lesson-json-v1`) that Phase 1's LessonLoader must parse and validate

### Research (from project initialization)
- `.planning/research/STACK.md` — TypeScript + Vite + Vitest + Zod recommendation and version pins (basis for D-01, D-02)
- `.planning/research/ARCHITECTURE.md` — StateStore/LessonLoader/renderer component boundaries and suggested build order (Phase 1 = step 1 of its 6-step order: "Persistence + StateStore + LessonLoader")
- `.planning/research/PITFALLS.md` — localStorage schema-versioning pitfall and text-normalization pitfall, both directly addressed by D-02/D-04/D-06

### Project-Level Context
- `.planning/PROJECT.md` — Core Value, Active requirements, Key Decisions (hybrid core/agent architecture, localStorage-only persistence)
- `.planning/REQUIREMENTS.md` — THEORY-01/02, EXERCISE-01..05, CHECK-01/02, PERSIST-01/02 (the 11 requirements this phase must satisfy)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — this is a greenfield project. Only `SPEC.md` and `Lesson-1A.json` exist in the repo prior to this phase.

### Established Patterns
- None yet established in code. `research/ARCHITECTURE.md` documents the intended pattern (deterministic StateStore + pub/sub, no framework) to follow from the start.

### Integration Points
- `Lesson-1A.json` is the single external data input this phase must parse, validate, and render from.

</code_context>

<specifics>
## Specific Ideas

No specific UI/UX references were given beyond SPEC.md's own description ("детский, блочный, яркий стиль... Roblox-вдохновлённый") — but full visual styling is explicitly Phase 5's job, not Phase 1's. Phase 1 should render functionally correct, unstyled-or-minimally-styled screens that Phase 5 will skin.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope. Agent integration, reward/review-queue logic, and visual design were correctly identified as belonging to Phases 2, 2, 3/4, and 5 respectively and were not discussed here.

### Reviewed Todos (not folded)

None — no pending todos existed at project start (`todo_count: 0`).

</deferred>

---

*Phase: 1-Deterministic Core, Lesson Rendering & Persistence*
*Context gathered: 2026-07-02*
