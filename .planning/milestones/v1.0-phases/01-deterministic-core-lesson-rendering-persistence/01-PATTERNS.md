# Phase 1: Deterministic Core, Lesson Rendering & Persistence - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** ~20 (per RESEARCH.md's Recommended Project Structure)
**Analogs found:** 0 / ~20

## Greenfield Notice

This is a **greenfield repository**. Prior to Phase 1, the working directory contains only:
- `SPEC.md` (project specification, not source code)
- `Lesson-1A.json` (lesson content data)
- `.planning/` (planning artifacts)
- `.claude/` (project instructions)

No `src/`, `tests/`, `package.json`, or any TypeScript/JavaScript source file exists anywhere in the repo. A full recursive listing (excluding `.git`, which doesn't exist either — this isn't even a git repo yet) confirms zero application code.

**Consequence:** there is no in-repo analog for any file this phase creates — not for the StateStore, not for the LessonLoader, not for any exercise renderer, not for the persistence module, not for a single test file. Searching for `class.*Controller`, `router\.(get|post)`, component directories, etc. returns nothing, because none of those directory structures exist yet.

This PATTERNS.md is intentionally short: it does not invent analogs that don't exist. Instead of "closest existing file," each entry below points to the concrete pattern **already worked out in `01-RESEARCH.md`**, which the planner should treat as the pattern source for this phase.

## File Classification (from RESEARCH.md's Recommended Project Structure)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|-----------------|----------------|
| `src/core/lesson/lessonSchema.ts` | model (schema) | transform | none | no analog |
| `src/core/lesson/lessonLoader.ts` | service | file-I/O | none | no analog |
| `src/core/answer-checking/normalize.ts` | utility | transform | none | no analog |
| `src/core/answer-checking/checkTextInput.ts` | utility | transform | none | no analog |
| `src/core/answer-checking/checkSingleChoice.ts` | utility | transform | none | no analog |
| `src/core/answer-checking/checkMatching.ts` | utility | transform | none | no analog |
| `src/core/answer-checking/checkOrderBuilder.ts` | utility | transform | none | no analog |
| `src/core/state/progressSchema.ts` | model (schema) | transform | none | no analog |
| `src/core/state/store.ts` | store | event-driven (pub/sub) | none | no analog |
| `src/core/state/persistence.ts` | service | file-I/O (localStorage) | none | no analog |
| `src/core/state/initialState.ts` | config | transform | none | no analog |
| `src/core/lessonEngine.ts` | service (orchestrator) | event-driven | none | no analog |
| `src/ui/screens/TheoryScreen.ts` | component | request-response | none | no analog |
| `src/ui/screens/ExerciseScreen.ts` | component | request-response | none | no analog |
| `src/ui/exercise-renderers/textInput.ts` | component | request-response | none | no analog |
| `src/ui/exercise-renderers/singleChoice.ts` | component | request-response | none | no analog |
| `src/ui/exercise-renderers/matching.ts` | component | request-response | none | no analog |
| `src/ui/exercise-renderers/orderBuilder.ts` | component | event-driven | none | no analog |
| `src/ui/components/ProgressIndicator.ts` | component | request-response | none | no analog |
| `src/ui/components/FeedbackBanner.ts` | component | request-response | none | no analog |
| `src/main.ts` | entrypoint | event-driven | none | no analog |
| `tests/core/**/*.test.ts` | test | — | none | no analog |
| `tests/ui/**/*.test.ts` | test | — | none | no analog |

**Files scanned:** entire repo (`find . -not -path '*/.git*'`) — 2 non-planning files exist (`SPEC.md`, `Lesson-1A.json`), zero of them are source code.

## Pattern Assignments (source: RESEARCH.md, not codebase)

Since no in-repo analog exists, the planner should copy patterns directly from `01-RESEARCH.md`'s "Architecture Patterns" and "Code Examples" sections, which are concrete, complete, and already grounded in the actual `Lesson-1A.json` shape:

### `src/core/lesson/lessonSchema.ts` (model, transform)
**Source:** `01-RESEARCH.md` Pattern 1 ("Zod discriminated union over `exercise.type`")
Copy the full `SourceRefSchema` / `HintSchema` / `NormalizedTextCheckSchema` / `PairIdsCheckSchema` / `TextInputExerciseSchema` / `MatchingExerciseSchema` / `SingleChoiceExerciseSchema` / `OrderBuilderExerciseSchema` / `ExerciseSchema` block verbatim as the starting point — it was built directly against the real `Lesson-1A.json` fields for `text-input`/`matching`, with `single-choice`/`order-builder` explicitly flagged `[ASSUMED]` (mode names `choiceId`/`orderedTokens` are executor-discretion per Open Question 1).

### `src/core/state/persistence.ts` (service, file-I/O)
**Source:** `01-RESEARCH.md` Pattern 2 ("Root-shape versioned localStorage blob, defensive read")
Copy the `PROGRESS_KEY = "english-quest-progress-v1"`, `CURRENT_SCHEMA_VERSION = 1`, `StoredBlobSchema`, `load()`, and `save()` functions verbatim. `load()` must defensively fall back to `initialState()` on parse failure, Zod validation failure, or schema-version mismatch — never throw. `save()` must be synchronous, called only from `StateStore.dispatch()` handlers (see Pitfall 3 in RESEARCH.md — never from raw `input`/`keyup` listeners).

### `src/ui/exercise-renderers/orderBuilder.ts` (component, event-driven)
**Source:** `01-RESEARCH.md` Pattern 3 ("Tap-based order-builder")
Copy the `OrderBuilderState { bank, sequence }` shape and `tapBankChip()`/`tapSequenceChip()`/`checkOrderBuilder()` pure functions verbatim, per locked decision D-05 (no drag-and-drop).

### `src/core/answer-checking/normalize.ts` (utility, transform)
**Source:** `01-RESEARCH.md` "Code Examples" — Text normalization block
Copy the `normalize()` function verbatim (`toLowerCase().trim().replace(/\s+/g,' ').replace(/[.!?,;:]+$/,'')`). Do not add fuzzy/edit-distance matching (Anti-Pattern explicitly warned against in RESEARCH.md).

### `src/core/lesson/lessonLoader.ts` (service, file-I/O)
**Source:** `01-RESEARCH.md` "Code Examples" — Zod safeParse with prettified error output
Copy the `safeParse()` + `z.prettifyError()` + `renderFatalError()` + `throw` pattern verbatim, per D-06 (fail loudly, never render from invalid data).

### All remaining UI components (`TheoryScreen.ts`, `ExerciseScreen.ts`, `textInput.ts`, `singleChoice.ts`, `matching.ts`, `ProgressIndicator.ts`, `FeedbackBanner.ts`)
**Source:** no analog, no pre-written code in RESEARCH.md beyond the System Architecture Diagram and Recommended Project Structure. Planner/executor has full discretion on internal implementation, constrained only by:
- Plain DOM APIs (`textContent`/`createElement`), never `innerHTML` (Anti-Pattern, security-relevant — XSS risk from lesson JSON content)
- No framework (locked D-01/RESEARCH.md Anti-Pattern 1)
- Stateless render functions keyed by `exercise.type`, emit events upward, never mutate state directly (Architectural Responsibility Map)

### `src/core/state/store.ts` (store, event-driven)
**Source:** no pre-written code; System Architecture Diagram (RESEARCH.md) specifies the shape: in-memory single source of truth holding `Lesson + ProgressState + current position`, exposes `dispatch()`/`subscribe()`, calls `persistence.save()` synchronously after every state-changing dispatch (D-03).

## Shared Patterns

### Zod fail-loudly validation
**Source:** `01-RESEARCH.md` "Code Examples" (Zod safeParse block)
**Apply to:** `lessonLoader.ts` (D-06) and `persistence.ts`'s `load()` (Pattern 2) — both must treat their JSON input as untrusted and never let the app proceed to render from unvalidated data.

### Synchronous save-on-dispatch only
**Source:** `01-RESEARCH.md` Pitfall 3
**Apply to:** `store.ts`, `lessonEngine.ts`, and any exercise renderer that submits an answer — `save()` must only ever be called from `StateStore.dispatch()` handlers for `exercise_attempt`/`theory_step`/position-advance events, never from raw input-change DOM listeners.

### No `innerHTML`
**Source:** `01-RESEARCH.md` Anti-Patterns / Security Domain (ASVS V5, OWASP-cited)
**Apply to:** every UI renderer that displays lesson-JSON-derived text (prompts, hints, theory text).

## No Analog Found

All ~20 files listed above have no in-repo analog. This is expected and correct for a Phase 1 of a greenfield project — see Greenfield Notice.

## Metadata

**Analog search scope:** entire repository (no `src/`, `tests/`, or config files exist)
**Files scanned:** 2 (`SPEC.md`, `Lesson-1A.json`) — neither is source code
**Pattern extraction date:** 2026-07-02
**Pattern source used instead of codebase analogs:** `01-RESEARCH.md` (Architecture Patterns 1-3, Code Examples section)

---
*Phase: 1-Deterministic Core, Lesson Rendering & Persistence*
*Patterns mapped: 2026-07-02*
