---
phase: 01-deterministic-core-lesson-rendering-persistence
plan: 01
subsystem: core
tags: [typescript, vite, vitest, zod, jsdom, localstorage, walking-skeleton]

# Dependency graph
requires: []
provides:
  - Vite + TypeScript + Vitest + Zod project scaffold, Vite pinned to 6.4.x
  - Zod lesson-json-v1 schema (LessonSchema) covering all 4 exercise types
  - Fail-loudly lesson loader (loadLesson) with FatalError UI (D-06)
  - Deterministic text normalization + text-input exact-match checker (CHECK-01)
  - Versioned localStorage persistence adapter with defensive read (Pattern 2, PERSIST-01)
  - StateStore with dispatch/subscribe and synchronous save-on-dispatch (D-03)
  - LessonEngine orchestrator (theory -> exercise, Phase 1 slice)
  - Theory screen, text-input renderer, ProgressIndicator, FeedbackBanner components
  - main.ts boot sequence wiring the full stack; end-to-end walking skeleton passes
affects: [01-02, 01-03, phase-2-progress-tracking, phase-5-ui-polish]

# Tech tracking
tech-stack:
  added: [typescript@6.0.3, vite@6.4.3, vitest@4.1.9, zod@4.4.3, jsdom@29.1.1, "@types/node"]
  patterns:
    - "Zod discriminatedUnion over exercise.type, nested discriminatedUnion over answerCheck.mode"
    - "Versioned localStorage blob {schemaVersion, data} with defensive safeParse-or-reset read"
    - "StateStore.dispatch synchronously calls save() exactly once, never called from raw input listeners"
    - "core/ has zero DOM/LLM awareness; ui/ reads state and emits events, never mutates StateStore directly"
    - "createElement/textContent only, innerHTML banned repo-wide"

key-files:
  created:
    - src/core/lesson/lessonSchema.ts
    - src/core/lesson/lessonLoader.ts
    - src/core/answer-checking/normalize.ts
    - src/core/answer-checking/checkTextInput.ts
    - src/core/state/progressSchema.ts
    - src/core/state/initialState.ts
    - src/core/state/persistence.ts
    - src/core/state/store.ts
    - src/core/lessonEngine.ts
    - src/ui/screens/TheoryScreen.ts
    - src/ui/screens/ExerciseScreen.ts
    - src/ui/exercise-renderers/textInput.ts
    - src/ui/components/ProgressIndicator.ts
    - src/ui/components/FeedbackBanner.ts
    - src/ui/components/FatalError.ts
    - src/main.ts
    - public/Lesson-1A.json
  modified: []

key-decisions:
  - "Vite pinned explicitly to ^6.4.0 (registry latest is 8.1.3) per RESEARCH.md Pitfall 2 — verified npm ls vite resolves 6.4.3"
  - "theory.explanationLevels[].level is a string enum (\"normal\"/\"simple\") in real Lesson-1A.json, not a number as the research pattern sketch assumed — schema corrected to z.string()"
  - "Feedback banner tracked as transient (non-persisted) render-only state in main.ts, keyed to the answered exercise index, since handleAnswer advances currentExerciseIndex synchronously on correct per its literal spec"
  - "e2e test stubs global fetch to serve the real public/Lesson-1A.json bytes from disk (jsdom has no static file server); the real fetch->JSON.parse->Zod safeParse code path stays under test"

patterns-established:
  - "Pattern 1 (lessonSchema): Zod discriminatedUnion over type, nested discriminatedUnion over answerCheck.mode"
  - "Pattern 2 (persistence): {schemaVersion, data} versioned blob, safeParse-or-reset on every read, sync write on every dispatch"
  - "core/ vs ui/ separation: core has zero DOM/LLM awareness; ui/ never calls StateStore.dispatch directly, only via engine methods"

requirements-completed: [THEORY-01, THEORY-02, EXERCISE-01, EXERCISE-05, CHECK-01, PERSIST-01, PERSIST-02]

coverage:
  - id: D1
    description: "Child sees the theory block (rule + example) as the first screen and can tap Понятно or Не понятно"
    requirement: "THEORY-01, THEORY-02"
    verification:
      - kind: unit
        ref: "tests/ui/screens/TheoryScreen.test.ts"
        status: pass
      - kind: e2e
        ref: "tests/e2e/lessonWalkingSkeleton.test.ts#renders theory, advances to first text-input exercise, and shows progress"
        status: pass
    human_judgment: false
  - id: D2
    description: "After theory, child sees a text-input exercise with a Проверить button and a 'Задание N из 19' indicator"
    requirement: "EXERCISE-01, EXERCISE-05"
    verification:
      - kind: unit
        ref: "tests/ui/components/ProgressIndicator.test.ts"
        status: pass
      - kind: e2e
        ref: "tests/e2e/lessonWalkingSkeleton.test.ts#renders theory, advances to first text-input exercise, and shows progress"
        status: pass
    human_judgment: false
  - id: D3
    description: "A text-input answer matching acceptedAnswers after normalization is marked Верно! with zero network calls"
    requirement: "CHECK-01"
    verification:
      - kind: unit
        ref: "tests/core/answer-checking/checkTextInput.test.ts"
        status: pass
      - kind: unit
        ref: "tests/core/answer-checking/normalize.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every state-changing action writes synchronously to localStorage key english-quest-progress-v1"
    requirement: "PERSIST-01"
    verification:
      - kind: unit
        ref: "tests/core/state/persistence.test.ts#StateStore dispatch triggers exactly one save() (localStorage.setItem call) per dispatch"
        status: pass
    human_judgment: false
  - id: D5
    description: "Reloading the page mid-lesson restores the exact position — same theory-understood flag and same exercise index"
    requirement: "PERSIST-02"
    verification:
      - kind: unit
        ref: "tests/core/state/persistence.test.ts#reload: a ProgressState carrying currentPosition survives save then fresh load"
        status: pass
      - kind: e2e
        ref: "tests/e2e/lessonWalkingSkeleton.test.ts#resumes at the exact position after a simulated reload"
        status: pass
    human_judgment: false
  - id: D6
    description: "A structurally invalid Lesson-1A.json shows a clear non-cryptic error state and does not render the lesson (D-06)"
    verification:
      - kind: unit
        ref: "tests/core/lesson/lessonSchema.test.ts#rejects a lesson object missing the theory block"
        status: pass
    human_judgment: true
    rationale: "Automated tests cover schema-rejection logic; the actual non-cryptic error-state rendering and copy in a real browser (Task 6 how-to-verify step 6) requires visual/manual confirmation and is deferred to end-of-phase human verification per config human_verify_mode."
  - id: D7
    description: "Real-browser walking-skeleton walkthrough (dev server, theory->exercise->Верно!, reload-resume, localStorage tamper-reset, D-06 fail-loudly)"
    verification: []
    human_judgment: true
    rationale: "Task 6 is a checkpoint:human-verify gated task. Auto-approved per workflow.auto_advance=true and human_verify_mode=end-of-phase (deferred to phase-level verification, not blocking this plan); a human must still walk through npm run dev manually before the phase is considered UAT-complete."

# Metrics
duration: 13min
completed: 2026-07-02
status: complete
---

# Phase 1 Plan 01: Walking Skeleton Summary

**Theory-to-first-exercise walking skeleton on vanilla TypeScript + Vite + Zod: fail-loudly lesson validation, deterministic text-input checking, and synchronous localStorage persistence that survives a reload.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-02T09:37:42Z
- **Completed:** 2026-07-02T09:50:29Z
- **Tasks:** 5 automated tasks complete; Task 6 (human-verify checkpoint) auto-approved/deferred per workflow config
- **Files modified:** 27 (scaffold + core + ui + tests)

## Accomplishments

- Scaffolded a vanilla-TS Vite project with Vite explicitly pinned to `^6.4.0` (registry `latest` is 8.1.3) — verified `npm ls vite` resolves `6.4.3`
- Built the full deterministic core: `LessonSchema` (Zod discriminated union over all 4 exercise types), `loadLesson()` (fetch + safeParse + fail-loudly, D-06), `normalize()` + `checkTextInput()` (CHECK-01, exact-match only, no fuzzy matching)
- Built versioned `localStorage` persistence (`{schemaVersion, data}` blob under `english-quest-progress-v1`) with defensive read that resets to `initialState()` on any corrupt/wrong-shape/wrong-version input, never throwing
- Built `StateStore` with `dispatch()`/`subscribe()`; `save()` fires synchronously exactly once per dispatch, called only from `dispatch()`, never from raw UI input listeners (Pitfall 3)
- Built `LessonEngine` orchestrating theory -> first exercise -> deterministic grading, plus `TheoryScreen`, `textInput` renderer, `ProgressIndicator` (data-driven denominator, not a hardcoded 19), and `FeedbackBanner` — all via `createElement`/`textContent`, zero `innerHTML`
- Wired the full boot sequence in `main.ts`: load lesson (halt on failure) -> restore persisted state -> mount correct screen -> subscribe to re-render. End-to-end skeleton test goes GREEN, including a reload-resume assertion (fresh `mountApp()` against the same `localStorage` resumes at the advanced position, not theory)
- Full suite green: 33 tests across 8 files; `npx tsc --noEmit` clean; `npm run build` produces a static bundle

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold project + Wave 0 test infrastructure + failing e2e skeleton test** - `90dce95` (test) — RED
2. **Task 2: Lesson schema + fail-loudly loader + text normalization + text-input checker** - `61808e1` (feat)
3. **Task 3: Progress schema + initial state + versioned persistence adapter + StateStore** - `2bba81f` (feat)
4. **Task 4: LessonEngine orchestrator + TheoryScreen + text-input renderer + ProgressIndicator + FeedbackBanner** - `26468e2` (feat)
5. **Task 5: Boot wiring (main.ts) — end-to-end skeleton goes GREEN** - `d82eca1` (feat) — GREEN

**Plan metadata:** (this commit, created after this SUMMARY)

_Note: Task 1 (RED) and Task 5 (GREEN) satisfy the plan-level TDD gate sequence (`type: tdd` per-task, not plan-level `type: tdd`); no `refactor` commit was needed._

## Files Created/Modified

- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.eslintrc.cjs`, `.prettierrc` - project scaffold, Vite pinned to `^6.4.0`
- `public/Lesson-1A.json` - lesson content served as static asset for `fetch()` (D-06 runtime-validation boundary)
- `src/style.css` - baseline treatment only (spacing scale, typography, functional colors) per 01-UI-SPEC.md scope boundary
- `src/core/lesson/lessonSchema.ts` - Zod `lesson-json-v1` discriminated-union schema (all 4 exercise types)
- `src/core/lesson/lessonLoader.ts` - fetch + Zod safeParse + fail-loudly loader (D-06)
- `src/core/answer-checking/normalize.ts` - SPEC §7 text normalization
- `src/core/answer-checking/checkTextInput.ts` - deterministic text-input exact-match (CHECK-01)
- `src/core/state/progressSchema.ts`, `initialState.ts`, `persistence.ts`, `store.ts` - versioned persistence + StateStore
- `src/core/lessonEngine.ts` - theory->exercise orchestrator (Phase 1 slice)
- `src/ui/screens/TheoryScreen.ts`, `ExerciseScreen.ts` - screen states
- `src/ui/exercise-renderers/textInput.ts` - first exercise-type renderer
- `src/ui/components/ProgressIndicator.ts`, `FeedbackBanner.ts`, `FatalError.ts` - shared components
- `src/main.ts` - boot: load lesson -> load/init state -> mount UI -> subscribe
- `tests/core/**`, `tests/ui/**`, `tests/e2e/**` - unit, jsdom-render, and end-to-end tests (8 files, 33 tests)

## Decisions Made

- Vite pinned to `^6.4.0` explicitly in `package.json` (not left to scaffold defaults) — registry `latest` resolves 8.x, which RESEARCH.md flags as higher-risk for this time-boxed build
- `theory.explanationLevels[].level` modeled as `z.string()` (real data uses `"normal"`/`"simple"`), correcting the research pattern's `z.number()` sketch — caught by running the real Lesson-1A.json through the schema in tests
- e2e test stubs `global.fetch` to serve the real `public/Lesson-1A.json` file content from disk (jsdom has no static file server); this keeps the real fetch -> parse -> Zod-safeParse code path under test while only substituting network transport
- Feedback banner state is intentionally NOT persisted to `ProgressState`/`localStorage` — it's transient render-only UI state in `main.ts`'s closure, since `handleAnswer` already advances `currentExerciseIndex` synchronously on a correct answer per the plan's literal `<behavior>` spec

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected `explanationLevels[].level` schema type to match real data**
- **Found during:** Task 2 (lessonSchema tests against the real Lesson-1A.json)
- **Issue:** RESEARCH.md's Pattern 1 sketch didn't cover `theory.explanationLevels[].level`; my initial schema modeled it as `z.number()`, but the real Lesson-1A.json uses string values (`"normal"`, `"simple"`)
- **Fix:** Changed `ExplanationLevelSchema.level` to `z.string()`
- **Files modified:** `src/core/lesson/lessonSchema.ts`
- **Verification:** `LessonSchema.safeParse(realLesson1A)` succeeds; `tests/core/lesson/lessonSchema.test.ts` passes
- **Committed in:** `61808e1` (Task 2 commit)

**2. [Rule 3 - Blocking] Installed `@types/node` for Node built-ins used in test fixtures**
- **Found during:** Task 2 (writing tests that read `Lesson-1A.json` from disk via `node:fs`/`node:path`)
- **Issue:** `tsc --noEmit` failed with `Cannot find name 'node:fs'` — the base tsconfig didn't include Node type definitions
- **Fix:** Added `@types/node` as a dev dependency and `"node"` to `tsconfig.json`'s `compilerOptions.types`
- **Files modified:** `package.json`, `package-lock.json`, `tsconfig.json`
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** `61808e1` (Task 2 commit)

**3. [Rule 1 - Bug] Fixed a stale-closure re-render race in the feedback-banner wiring**
- **Found during:** Task 5 (e2e reload-resume test authoring)
- **Issue:** `handleAnswer`'s synchronous `dispatch()` triggered the subscribed `render()` before the local `feedback` variable was set (dispatch fires mid-call, before `handleAnswer` returns), so the "Верно!" banner never appeared on the render immediately following a correct answer
- **Fix:** Temporarily unsubscribe `render` from the store around the `handleAnswer()` call, capture the verdict into `feedback`, resubscribe, then call `render()` explicitly exactly once with full information
- **Files modified:** `src/main.ts`
- **Verification:** `tests/e2e/lessonWalkingSkeleton.test.ts` — both the happy-path and reload-resume assertions pass
- **Committed in:** `d82eca1` (Task 5 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 schema-correctness bug, 1 Rule 3 blocking toolchain gap, 1 Rule 1 UI-wiring bug)
**Impact on plan:** All three were necessary for correctness against the real Lesson-1A.json and the plan's own literal behavior spec. No scope creep — no architectural changes, no new abstractions beyond what the plan specified.

## Issues Encountered

- jsdom has no static-file server, so a literal `fetch('/Lesson-1A.json')` against a running dev server (as the plan's Interfaces section implies) is not directly testable inside Vitest's jsdom environment. Resolved by stubbing `global.fetch` in the e2e test to return the real file's bytes read from disk — the production code path (`fetch` -> `response.json()` -> `LessonSchema.safeParse`) is unchanged and fully exercised; only the network transport is substituted for the test environment. `npm run dev` in a real browser (Task 6) exercises the actual `fetch()` against Vite's static-asset serving with no stubbing.

## User Setup Required

None - no external service configuration required. Zero agents, zero API keys, zero backend in Phase 1.

## Next Phase Readiness

- The architectural backbone (`StateStore`, versioned persistence, `LessonEngine`, fail-loudly loader, `core/` vs `ui/` separation, no-innerHTML rule) is proven end-to-end and ready for Plan 01-02/01-03 to extend with the remaining exercise types (`single-choice`, `matching`, `order-builder`) and Plan 01-03's checkers, without revisiting these contracts
- `LessonEngine.handleAnswer` has an explicit, honest `throw` for non-text-input types ("not yet wired (Plan 03)") rather than fake/stubbed behavior — Plan 01-02/03 must replace this switch arm, not work around it
- **Task 6 (human-verify checkpoint) was auto-approved/deferred, not manually walked through**, per `workflow.auto_advance=true` and `workflow.human_verify_mode="end-of-phase"` in `.planning/config.json`. Before the phase is considered fully UAT-complete, a human must still run `npm run dev` and manually confirm: theory->exercise flow, reload-resume, `localStorage` tamper-reset (Pattern 2), and the D-06 fail-loudly path with a real broken `Lesson-1A.json` — this is deferred to end-of-phase verification per the coverage `D6`/`D7` entries above, not skipped

## Known Stubs

- `src/ui/screens/ExerciseScreen.ts` renders a placeholder message ("Тип упражнения ... появится в следующем плане.") for `matching`/`single-choice`/`order-builder` exercise types. This is intentional and explicitly sanctioned by the plan's Task 4 `<action>` text ("a switch on exercise.type with text-input implemented and the other cases throwing a clear 'not yet wired (Plan 03)' is acceptable and honest"). Resolved by Plan 01-02/01-03, which implement the remaining exercise-type renderers and checkers.
- `src/core/lessonEngine.ts`'s `handleAnswer` throws for `matching`/`single-choice`/`order-builder` rather than returning a fake verdict — same rationale, same resolution path.

## Threat Flags

None — all Phase 1 threat-model dispositions (T-01-01 through T-01-04, T-01-SC) were implemented as specified in the plan's `<threat_model>` (Zod safeParse at both trust boundaries, textContent-only rendering, Vite pinned to 6.4.x). No new security-relevant surface was introduced beyond what the plan's threat register already covers.

---
*Phase: 01-deterministic-core-lesson-rendering-persistence*
*Completed: 2026-07-02*
