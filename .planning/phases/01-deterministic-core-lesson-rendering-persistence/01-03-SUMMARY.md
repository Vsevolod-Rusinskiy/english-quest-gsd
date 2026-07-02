---
phase: 01-deterministic-core-lesson-rendering-persistence
plan: 03
subsystem: ui+core
tags: [typescript, jsdom, vitest, exercise-renderers, tap-interaction, lesson-engine]

# Dependency graph
requires:
  - phase: 01-01
    provides: "LessonEngine skeleton with text-input wired and 3 honest throws for the other types; ExerciseScreen shell; textInput renderer pattern (emit AnswerSubmitted, never save()); FeedbackBanner/ProgressIndicator components"
  - phase: 01-02
    provides: "checkSingleChoice/checkMatching/checkOrderBuilder deterministic checkers; single-choice.fixture.json and order-builder.fixture.json (Lesson-1A.json has no real data for these two types)"
provides:
  - "renderSingleChoice — one-selectable accent-marked option renderer, emits selected optionId"
  - "renderMatching — two-column tap-to-pair renderer (image-prompt placeholders left, word labels right), emits full leftId/rightId pair list"
  - "renderOrderBuilder — tap-to-append/tap-to-remove word-bank + sequence renderer (D-05), emits assembled sequence"
  - "renderExercise — exhaustive type-switch dispatcher over all 4 exercise types"
  - "LessonEngine.handleAnswer routing all 4 types to their Plan 02 checkers, zero agent calls (CHECK-02)"
  - "Full-lesson traversal proven end-to-end: all 19 real Lesson-1A.json exercises (18 text-input + 1 matching), progress 1->19, position persisted at every step"
affects: [phase-2-progress-tracking, phase-3-agents, phase-5-ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Renderer contract (established by Plan 01's textInput, now applied uniformly across all 4 types): build DOM with createElement/textContent only, hold local interaction state in closures, emit the assembled answer upward via onSubmit, never call save()/StateStore.dispatch directly"
    - "renderExercise type-switch dispatcher with TypeScript never-check default branch — adding a 5th exercise type would be a compile error until a renderer is wired, not a silent runtime gap"
    - "order-builder bank/sequence state as two plain string[] arrays mutated via splice+spread on each tap, re-rendering both zones from scratch (RESEARCH.md Pattern 3), no drag events anywhere"

key-files:
  created:
    - src/ui/exercise-renderers/singleChoice.ts
    - src/ui/exercise-renderers/matching.ts
    - src/ui/exercise-renderers/orderBuilder.ts
    - src/ui/exercise-renderers/renderExercise.ts
    - tests/ui/exercise-renderers/singleChoice.test.ts
    - tests/ui/exercise-renderers/matching.test.ts
    - tests/ui/exercise-renderers/orderBuilder.test.ts
    - tests/e2e/fullLessonTraversal.test.ts
  modified:
    - src/core/lessonEngine.ts
    - src/ui/screens/ExerciseScreen.ts
    - src/main.ts
    - tests/core/lessonEngine.test.ts

key-decisions:
  - "AnswerPayload union type (string | MatchingPair[] | string[]) threaded from renderExercise through ExerciseScreen to LessonEngine.handleAnswer, replacing the Plan 01 text-input-only `rawAnswer: string` signature — each checker branch casts to its own payload shape inside the exhaustive switch, keeping the per-type contract explicit at the call site"
  - "matching renderer's pending single-side selection (tapped left, awaiting right, or vice versa) is tracked as local closure state, not DOM state — only a *completed* pair gets the accent+disabled treatment, so an in-progress half-selection never looks like a finished pair"
  - "order-builder re-renders both bankZone and sequenceZone from scratch on every tap (not an incremental DOM patch) — simplest correct implementation at this scale (max ~5-10 words), matches the project's explicit no-virtual-DOM/no-framework decision (ARCHITECTURE.md Anti-Pattern 1, D-01)"

patterns-established:
  - "Pattern 4 (this plan): uniform renderer contract now proven across all 4 exercise types, not just text-input — Phase 5's visual restyle can treat every exercise-renderers/*.ts file identically (same emit-upward, never-save contract)"

requirements-completed: [EXERCISE-02, EXERCISE-03, EXERCISE-04, EXERCISE-05, CHECK-02]

coverage:
  - id: D1
    description: "Child can play a single-choice exercise: tap one option (accent-selected), submit, get graded"
    requirement: "EXERCISE-02"
    verification:
      - kind: unit
        ref: "tests/ui/exercise-renderers/singleChoice.test.ts"
        status: pass
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#handleAnswer routes single-choice exercises to checkSingleChoice and advances on correct (CHECK-02, no agent)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Child can play a matching exercise: tap-to-pair left picture placeholder to right word, submit, get graded against the real ex019"
    requirement: "EXERCISE-03"
    verification:
      - kind: unit
        ref: "tests/ui/exercise-renderers/matching.test.ts"
        status: pass
      - kind: e2e
        ref: "tests/e2e/fullLessonTraversal.test.ts#completes all 19 real exercises across text-input + matching, advancing progress 1->19 with persistence at every step"
        status: pass
    human_judgment: false
  - id: D3
    description: "Child can play an order-builder exercise: tap word-bank chips to append, tap sequence chips to remove, submit, get graded — no drag-and-drop"
    requirement: "EXERCISE-04, D-05"
    verification:
      - kind: unit
        ref: "tests/ui/exercise-renderers/orderBuilder.test.ts"
        status: pass
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#handleAnswer routes order-builder exercises to checkOrderBuilder and advances on correct (CHECK-02, no agent)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Child can traverse all 19 real exercises of Lesson-1A.json end to end, with 'Задание N из 19' advancing correctly"
    requirement: "EXERCISE-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/fullLessonTraversal.test.ts#completes all 19 real exercises across text-input + matching, advancing progress 1->19 with persistence at every step"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every exercise type is graded deterministically via the Plan 02 checkers — no agent call"
    requirement: "CHECK-02"
    verification:
      - kind: unit
        ref: "grep -rn \"fetch|@anthropic\" src/core/ — returns only the single lesson-loader fetch call"
        status: pass
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts (4 routing tests, one per exercise type)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Full lesson playable across all 4 exercise types in a real browser; reload mid-lesson resumes at the exact index"
    verification: []
    human_judgment: true
    rationale: "Task 4 is a checkpoint:human-verify gated task. Auto-approved per workflow.auto_advance=true and human_verify_mode=end-of-phase (same pattern as Plan 01-01's Task 6) — deferred to phase-level verification, not blocking this plan. A human must still run `npm run dev` and manually confirm all 4 exercise types (including single-choice/order-builder, which have no real lesson data and need a dev harness or ad-hoc fixture wiring to reach) before the phase is considered UAT-complete."

# Metrics
duration: 40min
completed: 2026-07-02
status: complete
---

# Phase 1 Plan 03: Full Exercise-Type Rendering + LessonEngine Wiring Summary

**All 4 exercise-type renderers (text-input from Plan 01, plus single-choice/matching/order-builder built here) wired through an exhaustive `renderExercise` dispatcher into a `LessonEngine` that routes every type to its Plan 02 deterministic checker — proven end-to-end by a full 19-exercise traversal of the real `Lesson-1A.json`.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-07-02T09:37:42Z (session start; this plan began after 01-01/01-02 completed)
- **Completed:** 2026-07-02T10:17:42Z
- **Tasks:** 3 automated tasks complete; Task 4 (human-verify checkpoint) auto-approved/deferred per workflow config
- **Files modified:** 12 (4 new renderers + dispatcher, 4 new/extended test files, 4 modified core/ui files)

## Accomplishments

- Built `renderSingleChoice` — one tappable button per `options[]` entry, exactly one accent-selectable, `Проверить` inert until a selection exists, emits the chosen `optionId` on submit
- Built `renderMatching` — two-column tap-to-pair renderer (left = `leftItems[].imagePrompt` as text placeholders, right = `rightOptions[].labelEn`), paired items become accent-marked and non-tappable, verified against the real 8-pair `ex019` restaurant-vocabulary exercise
- Built `renderOrderBuilder` — "Слова:" word-bank + "Твой ответ:" sequence zones (D-05), tap-to-append/tap-to-remove only, zero drag-event wiring, emits the assembled `string[]` sequence
- Built `renderExercise` — exhaustive `exercise.type` switch dispatching to all 4 per-type renderers, with a TypeScript never-check default branch so a 5th type would be a compile error, not a silent gap
- Extended `LessonEngine.handleAnswer`'s switch: replaced the three Plan 01 "not yet wired (Plan 03)" throws with routes to `checkSingleChoice`/`checkMatching`/`checkOrderBuilder`; `AnswerPayload` (`string | MatchingPair[] | string[]`) threads the per-type answer shape from `renderExercise` through `ExerciseScreen` to the engine
- Wired `ExerciseScreen` to delegate entirely to `renderExercise` — the Plan 01 text-input-only placeholder path is gone
- Wrote `tests/e2e/fullLessonTraversal.test.ts`: boots the real app against the real `public/Lesson-1A.json`, answers all 18 text-input + 1 matching exercises correctly in lesson order, and asserts `"Задание N из 19"` advances 1→19 with `localStorage`'s `currentPosition.currentExerciseIndex` matching the loop index after every single submit — the phase's headline proof (EXERCISE-05)
- Full suite green: 68 tests across 15 files (up from 47/11 after Plan 02); `npx tsc --noEmit` clean; `npm run build` produces a static bundle; `grep -rn "innerHTML" src/` returns only comment mentions; `grep -rn "fetch|@anthropic" src/core/` returns only the lesson loader's single `fetch()` call

## Task Commits

Each task was committed atomically (TDD RED→GREEN per task):

1. **Task 1: single-choice + matching renderers**
   - `ecc4226` (test) — RED: failing renderer tests against the Plan 02 fixture and real ex019
   - `ce36d75` (feat) — GREEN: `singleChoice.ts` + `matching.ts` implemented
2. **Task 2: order-builder renderer + renderExercise dispatcher**
   - `138192b` (test) — RED: failing order-builder test (D-05 tap-only)
   - `d7b203a` (feat) — GREEN: `orderBuilder.ts` + `renderExercise.ts` implemented; fixed a test-file false positive (drag-and-drop detection regex matching the word "drop" inside a source comment)
3. **Task 3: LessonEngine extension + ExerciseScreen wiring + full-lesson traversal e2e**
   - `199ce3e` (test) — RED: failing full-lesson-traversal e2e
   - `cb7e7ef` (feat) — GREEN: `lessonEngine.ts` routing extended, `ExerciseScreen.ts`/`main.ts` wired, `lessonEngine.test.ts` extended with single-choice/order-builder routing coverage; includes the `main.ts` feedback-banner fix (see Deviations)

**Plan metadata:** (this commit, created after this SUMMARY)

_Note: all three tasks are `tdd="true"` and each produced its own RED→GREEN commit pair; no `refactor` commit was needed for any._

## Files Created/Modified

- `src/ui/exercise-renderers/singleChoice.ts` - one-selectable accent-marked option renderer (EXERCISE-02)
- `src/ui/exercise-renderers/matching.ts` - two-column tap-to-pair renderer (EXERCISE-03)
- `src/ui/exercise-renderers/orderBuilder.ts` - tap-to-append/remove word-bank renderer, no drag-and-drop (EXERCISE-04, D-05)
- `src/ui/exercise-renderers/renderExercise.ts` - exhaustive type-switch dispatcher over all 4 exercise types
- `src/core/lessonEngine.ts` - `handleAnswer` now routes all 4 types to their Plan 02 checkers, zero agent calls (CHECK-02)
- `src/ui/screens/ExerciseScreen.ts` - delegates to `renderExercise`, placeholder path removed
- `src/main.ts` - `onSubmit` type widened to `AnswerPayload`; feedback-banner fix for the last-exercise-correct case
- `tests/ui/exercise-renderers/singleChoice.test.ts`, `matching.test.ts`, `orderBuilder.test.ts` - jsdom render tests for the three new renderers
- `tests/e2e/fullLessonTraversal.test.ts` - full 19-exercise traversal proof (EXERCISE-05 headline)
- `tests/core/lessonEngine.test.ts` - extended with routing coverage for single-choice/order-builder against the Plan 02 fixtures merged into a lesson variant (real lesson has neither type)

## Decisions Made

- `AnswerPayload = string | MatchingPair[] | string[]` is the shared type threading each renderer's emitted answer shape from `renderExercise` through `ExerciseScreen.onSubmit` to `LessonEngine.handleAnswer`, where the exhaustive switch casts to the exact per-branch shape — keeps the per-type contract visible at the type level rather than using `unknown`/`any`
- Matching's tap-to-pair tracks in-progress single-side selections (left tapped, awaiting right) as local closure state (`selectedLeftId`/`selectedRightId`), not as a DOM class — only a *completed* pair gets `accent`+`disabled`, so a half-made selection never visually looks like a finished pair
- order-builder re-renders both `bankZone`/`sequenceZone` from scratch on every tap rather than patching individual DOM nodes — correct and simplest at this scale (≤10 words per exercise), consistent with the project's explicit no-framework/no-virtual-DOM decision

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing feedback banner on the last exercise's correct answer**
- **Found during:** Task 3 (full-lesson traversal e2e authoring — the last assertion, `Верно!` after the final matching exercise, failed)
- **Issue:** `main.ts`'s `render()` function only rendered the feedback banner inside the `if (exercise)` branch. When the 19th (last) exercise is answered correctly, `currentExerciseIndex` advances past the array end, `exercise` becomes `undefined`, and the code falls into the `else` (`"Урок завершён!"`) branch — which never checked `feedbackAppliesHere`, so the "Верно!" banner for the final correct answer silently never appeared. Pre-existing from Plan 01 (never exercised until this plan's full-traversal test reached the last exercise).
- **Fix:** Mirrored the same `feedbackAppliesHere` check (`feedback.isCorrect && feedback.atIndex === index - 1`) in the `else` branch, rendering the banner before the "Урок завершён!" message.
- **Files modified:** `src/main.ts`
- **Verification:** `tests/e2e/fullLessonTraversal.test.ts` passes; `npx vitest run` full suite green
- **Committed in:** `cb7e7ef` (Task 3 commit)

**2. [Test-authoring fix, not a Rule 1-3 production bug] Corrected an overly-broad regex in the order-builder no-drag-and-drop test**
- **Found during:** Task 2 (writing the D-05 compliance assertion)
- **Issue:** The initial regex `/draggable|dragstart|dragover|drop\b/` matched the word "drop" inside `orderBuilder.ts`'s own source comment ("NO drag-and-drop"), failing the test against correct, compliant source code — a test false positive, not a production defect.
- **Fix:** Tightened the regex to `/draggable=|addEventListener\(["']drag|ondrag|ondrop/`, which matches actual drag-event API usage, not prose mentioning "drag-and-drop".
- **Files modified:** `tests/ui/exercise-renderers/orderBuilder.test.ts`
- **Verification:** Test passes against the real (compliant) source; still fails if drag-event wiring were actually added (verified by temporarily adding `draggable="true"` locally during authoring)
- **Committed in:** `d7b203a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed Rule 1 production bug (feedback-banner edge case), 1 test-authoring self-correction (not a scope/architecture change)
**Impact on plan:** Both were necessary for the full-lesson traversal e2e to accurately prove EXERCISE-05. No scope creep — no architectural changes, no new abstractions beyond what the plan specified.

## Issues Encountered

None beyond the two items documented above.

## User Setup Required

None - no external service configuration required. Zero agents, zero API keys, zero backend in Phase 1.

## Next Phase Readiness

- Phase 1's headline success criterion — "child can complete all 19 exercises across the 4 exercise types" — is now proven at the code level for the two types the real lesson contains (text-input, matching) via the full-lesson traversal e2e, and at the unit level for the two types it doesn't (single-choice, order-builder) via renderer tests + `LessonEngine` routing tests against the Plan 02 fixtures
- `core/` remains zero-DOM/zero-LLM-aware; `ui/` renderers remain emit-upward-only, never touching `StateStore`/`save()` directly — the architectural boundary Phase 2/3 will build on is unchanged and now proven across all 4 types, not just one
- Task 4 (human-verify checkpoint) was auto-approved/deferred, not manually walked through, per `workflow.auto_advance=true` and `workflow.human_verify_mode="end-of-phase"`. Before Phase 1 is considered fully UAT-complete, a human must run `npm run dev` and manually confirm: theory→exercise flow across all 4 types, matching tap-to-pair against the real ex019, order-builder tap-append/tap-remove (no dragging) against a fixture, the full 19-exercise traversal reaching "Задание 19 из 19" + lesson-complete, and reload-resume at the exact mid-lesson index — this is deferred to end-of-phase verification per coverage entry D6 above, not skipped. Since `Lesson-1A.json` has no real single-choice/order-builder exercises, manual verification of those two types requires either a small dev harness or temporarily wiring the Plan 02 fixtures into the served lesson — left to the end-of-phase verifier's discretion, consistent with how Plan 01/02 already flagged this content-authoring gap (RESEARCH.md Pitfall 1).

## Known Stubs

None. All 4 exercise types are fully implemented (renderer + checker + engine routing), not stubbed or placeholder. The only pre-existing content-authoring gap (not a code stub) is that `Lesson-1A.json` itself contains zero real `single-choice`/`order-builder` exercises — this was flagged and accepted as a documented, out-of-code-control gap back in `01-RESEARCH.md` Pitfall 1 / Plan 02, not introduced or left open by this plan.

## Threat Flags

None — this plan's three new renderers and the `renderExercise` dispatcher implement exactly the `<threat_model>` dispositions specified in the plan: T-01-07 (stored-XSS mitigation via `textContent`/`createElement` only, verified by `grep -rn "innerHTML" src/` returning no functional matches), T-01-08 (correctness-bypass mitigation via strict deterministic Plan 02 checker routing, verified by the full-lesson traversal e2e and the `lessonEngine.test.ts` routing tests), and T-01-09 (no `save()` calls in any new renderer — verified by review; renderers only call `onSubmit`, never touch `StateStore`/`persistence.ts`). No new security-relevant surface was introduced beyond what the plan's threat register already covers.

---
*Phase: 01-deterministic-core-lesson-rendering-persistence*
*Completed: 2026-07-02*

## Self-Check: PASSED

All 9 created files verified present on disk (singleChoice.ts, matching.ts, orderBuilder.ts,
renderExercise.ts, singleChoice.test.ts, matching.test.ts, orderBuilder.test.ts,
fullLessonTraversal.test.ts, and this SUMMARY.md). All 7 commit hashes (ecc4226, ce36d75,
138192b, d7b203a, 199ce3e, cb7e7ef, b696726) verified present in git log.
