---
phase: 05-kid-friendly-visual-design
plan: 03
subsystem: ui
tags: [typescript, vitest, dom, i18n, gap-closure]

# Dependency graph
requires:
  - phase: 01-deterministic-core-lesson-rendering-persistence
    provides: LessonEngine, lessonSchema (Section.instructionRu/instructionEn), 4 exercise renderers, ExerciseScreen/renderExercise dispatch
  - phase: 05-kid-friendly-visual-design (plans 01-02)
    provides: bright/blocky visual identity, style.css tokens, top-bar ruble balance
provides:
  - LessonEngine.getCurrentSection() resolver (main pass + review pass + lesson-complete null)
  - instructionRu/instructionEn threaded through RenderExerciseOptions/ExerciseScreenOptions into all 4 renderers
  - .instruction-line rendering (RU then EN, Body size) in textInput/singleChoice/matching/orderBuilder, above exercise.prompt
  - main.ts wiring at the single shared exercise render call site (covers both main pass and review pass)
affects: [any future phase touching exercise renderers, ExerciseScreen, or LessonEngine's exercise/section resolution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Section resolver reuses getCurrentExerciseId()'s existing main-pass/review-pass branching instead of duplicating it (getCurrentSection() is a one-line scan built on top of the existing id resolution)"
    - "Bilingual instruction lines rendered as two sibling <p class=\"instruction-line\"> elements ahead of the existing prompt <p>, never merged into prompt text"

key-files:
  created: []
  modified:
    - src/core/lessonEngine.ts
    - src/ui/exercise-renderers/renderExercise.ts
    - src/ui/exercise-renderers/textInput.ts
    - src/ui/exercise-renderers/singleChoice.ts
    - src/ui/exercise-renderers/matching.ts
    - src/ui/exercise-renderers/orderBuilder.ts
    - src/ui/screens/ExerciseScreen.ts
    - src/main.ts
    - src/style.css
    - tests/core/lessonEngine.test.ts
    - tests/ui/exercise-renderers/singleChoice.test.ts
    - tests/ui/exercise-renderers/orderBuilder.test.ts
    - tests/ui/exercise-renderers/matching.test.ts

key-decisions:
  - "getCurrentSection() built directly on getCurrentExerciseId() (single find() over lesson.sections), not a new independent branching path — keeps main-pass/review-pass resolution in exactly one place"
  - "instructionRu/instructionEn default to empty string (?? \"\") at the main.ts call site as defensive typing only, since getCurrentSection() always resolves a real section whenever exercise itself is non-null"

patterns-established:
  - "Bilingual RU+EN instruction lines are a task-card-level concern threaded through the render-options chain (engine -> screen -> dispatcher -> renderer), not duplicated per-renderer lookup logic"

requirements-completed: [UI-02]

coverage:
  - id: D1
    description: "LessonEngine.getCurrentSection() resolves the parent Section for the current exercise (main pass, review pass, and null at lesson-complete)"
    requirement: "UI-02"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#Plan 03 (05-03): getCurrentSection()"
        status: pass
    human_judgment: false
  - id: D2
    description: "All 4 exercise renderers (text-input, single-choice, matching, order-builder) render instructionRu then instructionEn as two Body-size .instruction-line paragraphs above exercise.prompt"
    requirement: "UI-02"
    verification:
      - kind: unit
        ref: "tests/ui/exercise-renderers/singleChoice.test.ts#renders instructionRu then instructionEn as .instruction-line elements before the prompt paragraph (05-03 gap closure)"
        status: pass
      - kind: unit
        ref: "tests/ui/exercise-renderers/orderBuilder.test.ts#renders instructionRu then instructionEn as .instruction-line elements before the prompt paragraph (05-03 gap closure)"
        status: pass
      - kind: unit
        ref: "tests/ui/exercise-renderers/matching.test.ts#renders instructionRu then instructionEn as .instruction-line elements before the prompt paragraph (05-03 gap closure)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/fullLessonTraversal.test.ts (real Lesson-1A.json, textInput's new instruction lines exercised end-to-end)"
        status: pass
      - kind: manual_procedural
        ref: "Headless Chromium against `npx vite` dev server: ex001 (text-input) and ex019 (matching) task cards both show RU line then EN line then prompt — screenshots captured"
        status: pass
    human_judgment: false
  - id: D3
    description: "main.ts's single shared renderExerciseScreen() call site (main pass and review pass alike) supplies instructionRu/instructionEn from engine.getCurrentSection()"
    requirement: "UI-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/fullLessonTraversal.test.ts + tests/main.test.ts (both pass, exercising the real render call site)"
        status: pass
      - kind: manual_procedural
        ref: "Live browser walkthrough via headless Chromium confirmed correct instruction text for both a main-pass exercise (ex001) and a later exercise (ex019, matching)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-07-04
status: complete
---

# Phase 5 Plan 03: Task-Card RU+EN Instruction Rendering (Gap Closure) Summary

**Threaded Section-level instructionRu/instructionEn into all 4 exercise renderers via a new LessonEngine.getCurrentSection() resolver, closing the Phase 1-origin gap that left task cards English-prompt-only despite bilingual instruction data being schema-validated and populated since Phase 1.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-04T09:24:00Z (approx, first file read)
- **Completed:** 2026-07-04T09:31:34Z
- **Tasks:** 2
- **Files modified:** 13 (9 source, 4 test — 3 renderer test files + lessonEngine test file)

## Accomplishments

- `LessonEngine.getCurrentSection()` resolves the parent `Section` for the current exercise (main pass, review pass, and `null` at lesson-complete), reusing `getCurrentExerciseId()`'s existing branching rather than duplicating it
- `RenderExerciseOptions`/`ExerciseScreenOptions` now carry `instructionRu: string`/`instructionEn: string` through the dispatch chain to all 4 exercise renderers
- All 4 renderers (`textInput.ts`, `singleChoice.ts`, `matching.ts`, `orderBuilder.ts`) render two `<p class="instruction-line">` elements — RU then EN — immediately before the existing `exercise.prompt` paragraph, via `createElement`/`textContent` only (zero `innerHTML`)
- `main.ts`'s single shared `renderExerciseScreen()` call site (the one call site that serves both the main pass and the review pass, per Phase 2's unified `getCurrentExercise()` design) now resolves `engine.getCurrentSection()` and passes both strings through
- `.instruction-line` CSS rule added at Body size (16px/400/1.5) per `05-UI-SPEC.md`'s Typography Bilingual text note, using the existing `--space-sm` token
- Closes `REQUIREMENTS.md` UI-02's "карточку задания с инструкцией RU+EN" clause and ROADMAP Phase 5 Success Criterion 2's "task card with RU+EN instructions for every exercise" clause — both previously marked complete despite never being implemented (originated Phase 1, caught by `05-VERIFICATION.md`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add LessonEngine.getCurrentSection() resolver + thread instructionRu/instructionEn through the renderer dispatch layer** - `049a3a6` (feat)
2. **Task 2: Render instructionRu/instructionEn in all 4 exercise renderers + wire main.ts + style the instruction lines** - `9ffca6d` (feat)

_Both tasks used `tdd="true"` — RED (failing assertions added to existing test files, confirmed failing before implementation) then GREEN (implementation added, confirmed passing) within each task's single commit, since these are additive assertions to already-passing test files rather than net-new test files requiring a separate `test(...)` commit. No `refactor(...)` commit was needed — no cleanup pass was required after either GREEN step._

## Files Created/Modified

- `src/core/lessonEngine.ts` - Added `getCurrentSection(): Section | null`
- `src/ui/exercise-renderers/renderExercise.ts` - `RenderExerciseOptions` gains `instructionRu`/`instructionEn`, threaded to all 4 dispatch calls
- `src/ui/exercise-renderers/textInput.ts` - Renders 2 `.instruction-line` paragraphs before `exercise.prompt`
- `src/ui/exercise-renderers/singleChoice.ts` - Same
- `src/ui/exercise-renderers/matching.ts` - Same
- `src/ui/exercise-renderers/orderBuilder.ts` - Same
- `src/ui/screens/ExerciseScreen.ts` - `ExerciseScreenOptions` gains `instructionRu`/`instructionEn`, passed through unchanged
- `src/main.ts` - Resolves `engine.getCurrentSection()` at the single exercise render call site, passes `section?.instructionRu ?? ""` / `section?.instructionEn ?? ""`
- `src/style.css` - `.instruction-line` rule (Body size, `--space-sm` bottom margin)
- `tests/core/lessonEngine.test.ts` - 3 new tests for `getCurrentSection()` (main pass, review pass, lesson-complete null)
- `tests/ui/exercise-renderers/singleChoice.test.ts` - Updated call sites + 1 new instruction-line assertion
- `tests/ui/exercise-renderers/orderBuilder.test.ts` - Updated call sites + 1 new instruction-line assertion
- `tests/ui/exercise-renderers/matching.test.ts` - Updated call sites + 1 new instruction-line assertion

## Decisions Made

- `getCurrentSection()` implemented as a thin wrapper around `getCurrentExerciseId()` (`this.lesson.sections.find((s) => s.exercises.some((e) => e.exerciseId === id))`) rather than a second independent main-pass/review-pass branch, keeping exactly one place in the codebase that resolves "which exercise is current" — same reasoning as `getCurrentExercise()`'s existing precedent one line above it.
- `main.ts`'s `?? ""` fallback for `instructionRu`/`instructionEn` is defensive typing only, not a real behavior branch: `getCurrentSection()` is only called when `exercise` (from `getCurrentExercise()`) is already non-null, so a real section will always resolve for any real lesson JSON.
- `textInput.ts` has no dedicated unit test file (confirmed, none existed pre-plan) — its new instruction-line output is exercised indirectly through `tests/e2e/fullLessonTraversal.test.ts` and `tests/main.test.ts`, both of which mount the real app against real `Lesson-1A.json` data end-to-end. Per the plan's explicit scope note, creating a from-scratch `textInput.test.ts` was out of scope for this narrow gap-closure plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both tasks' RED phases (new assertions added to already-passing test files, confirmed failing pre-implementation) and GREEN phases (implementation, confirmed passing) proceeded without unexpected blockers. Manual browser verification (headless Chromium against the real `vite` dev server, not just unit tests) confirmed the fix visually for both a text-input exercise (ex001) and a matching exercise (ex019) — both show the Russian instruction line, then the English instruction line, then the English exercise prompt, exactly per spec.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 5's sole outstanding verification gap (05-VERIFICATION.md BLOCKER) is now closed. `REQUIREMENTS.md` UI-02 and ROADMAP Phase 5 Success Criterion 2 are both genuinely satisfied, not just marked complete.
- Full test suite green (250/250, up from 244 pre-plan), `tsc --noEmit` clean, zero new `innerHTML` usage, zero debt markers introduced.
- Phase 5 (and the v1.0 milestone it terminates) has no remaining known gaps from this verification cycle.

---
*Phase: 05-kid-friendly-visual-design*
*Completed: 2026-07-04*
