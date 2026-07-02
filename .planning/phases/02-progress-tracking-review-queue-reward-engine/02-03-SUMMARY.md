---
phase: 02-progress-tracking-review-queue-reward-engine
plan: 03
subsystem: core-state-ui
tags: [typescript, vitest, review-pass, progress-indicator, state-machine]

# Dependency graph
requires:
  - phase: 02-progress-tracking-review-queue-reward-engine
    provides: "Plan 01 — TopicStat/RewardEvent Zod schemas, nextTopicStatus() FSM, enqueueReviewItems() scan; Plan 02 — evaluateAttempt() aggregator, enriched exercise_attempt dispatch, LessonEngine.handleAnswer wiring"
provides:
  - "reviewPassIndex on CurrentPositionSchema — required persisted cursor field (kept unused by the chosen dequeue-on-completion model, forward-compatible)"
  - "LessonEngine.getCurrentExerciseId()/getCurrentExercise()/isReviewPass() — main-vs-review-pass resolution against the immutable this.exercises, never mutating it (Pitfall 4)"
  - "store.ts exercise_attempt action gains optional reviewDequeueId — folds review-queue dequeue into the SAME single dispatch, whether the answer was correct or not (D-02)"
  - "main.ts render() serves both the main sequence and the appended review pass via getCurrentExercise() — no new screen, renderers reused unchanged"
  - "ProgressIndicator.renderReviewProgressIndicator() — distinct 'Повторение: N из K' label with a captured-once denominator, avoiding the Gap 2 overshoot for the new review range"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second-cursor pattern for an appended pass: getCurrentExerciseId() resolves index-based (main) vs queue-head-based (review) position from the SAME immutable array, rather than mutating or re-ordering the array"
    - "Dequeue-on-completion as the review-pass advance mechanism: since a review item is ALWAYS removed from reviewQueue on completion (correct or not), reviewQueue[0] is always 'the current item' — no separate advance counter needed at runtime, though the schema keeps a forward-compatible reviewPassIndex field"
    - "UI feedback keyed by exerciseId (not array index) once an appended pass no longer advances a stable index per answer"

key-files:
  created:
    - tests/e2e/reviewQueuePass.test.ts
  modified:
    - src/core/state/progressSchema.ts
    - src/core/state/initialState.ts
    - src/core/state/store.ts
    - src/core/lessonEngine.ts
    - src/ui/components/ProgressIndicator.ts
    - src/main.ts
    - tests/core/lessonEngine.test.ts
    - tests/core/state/persistence.test.ts
    - tests/ui/components/ProgressIndicator.test.ts

key-decisions:
  - "Chosen review-pass cursor model: 'always serve reviewQueue[0], reviewPassIndex unused' rather than incrementing a separate index. Since D-02 mandates dequeue-on-completion (correct or not), the head of reviewQueue is always the current item by construction — an index would be redundant and risk desync with a shrinking array. reviewPassIndex stays in the Zod schema (required, seeded 0) purely for forward-compatibility per the plan's explicit discretion clause, and is documented as intentionally unused."
  - "Review-queue dequeue folds into the EXISTING exercise_attempt action via an optional reviewDequeueId field, applied in the reduce branch as additions-then-removal — preserves the Pitfall-3 'one dispatch = one save = one render per answer' invariant with zero new action types."
  - "handleAnswer never dispatches advance_position for a review-pass answer (correct or not) — the dequeue itself is the advance. Main-pass advance_position (currentExerciseIndex increment) is completely unchanged from Plan 01/02."
  - "main.ts feedback tracking switched from an index-only key to an {atIndex, exerciseId} key: during the review pass currentExerciseIndex no longer moves per answer, so an index-only match would never re-locate the just-answered review item on re-render."
  - "Progress-indicator review-pass denominator is captured once (reviewQueue.length observed the first render the pass is active) rather than re-read live every render, since reviewQueue shrinks as items dequeue — a live read would make the total regress mid-pass."

requirements-completed: [PROGRESS-04]

coverage:
  - id: D1
    description: "LessonEngine exposes getCurrentExerciseId()/getCurrentExercise()/isReviewPass() resolving main-sequence vs review-pass position by looking up reviewQueue against the immutable this.exercises array, which is never mutated or spliced (Pitfall 4)"
    requirement: "PROGRESS-04"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#Phase 2 Plan 03: review-pass cursor"
        status: pass
    human_judgment: false
  - id: D2
    description: "A review-pass answer dequeues the completed item from reviewQueue whether correct or not, folded into the SAME single exercise_attempt dispatch (no new action type, no immediate re-add), and reuses the same reward dedup path via the original exerciseId (Pitfall 5)"
    requirement: "PROGRESS-04"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#dequeue on correct, dequeue on incorrect (D-02)"
      - kind: e2e
        ref: "tests/e2e/reviewQueuePass.test.ts#dequeue regardless of correctness; #review reward reuses same dedup path"
        status: pass
    human_judgment: false
  - id: D3
    description: "The review-pass position (reviewQueue contents) survives save()/load() so a reload mid-review resumes at the correct remaining item (PERSIST-02)"
    requirement: "PROGRESS-04"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#persist/resume (PERSIST-02)"
      - kind: e2e
        ref: "tests/e2e/reviewQueuePass.test.ts#persist/resume mid-review (PERSIST-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "main.ts render() serves review exercises via getCurrentExercise() (reusing renderExerciseScreen unchanged) instead of the old direct engine.exercises[index] lookup, showing 'Урок завершён!' only when BOTH the main sequence is done AND reviewQueue is empty; the top-bar shows a distinct 'Повторение: N из K' label during the review pass without overshooting the main total (avoids compounding Phase 1 UAT Gap 2)"
    requirement: "PROGRESS-04"
    verification:
      - kind: unit
        ref: "tests/ui/components/ProgressIndicator.test.ts#renderReviewProgressIndicator"
        status: pass
      - kind: e2e
        ref: "tests/e2e/reviewQueuePass.test.ts#queue populated then consumed"
        status: pass
    human_judgment: false
  - id: D5
    description: "A topic that reaches needs_review can be closed out to mastered purely through review-pass correct answers (D-06 FSM driven identically regardless of which pass supplies the correct answers), and weak_topic_closed fires exactly once even when review-pass answers continue touching an already-mastered topic (D-05)"
    requirement: "PROGRESS-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/reviewQueuePass.test.ts#topic status closes via the review path (isolated); #topic status closes via the review path"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-07-02
status: complete
---

# Phase 2 Plan 3: Review-Pass UI Wiring — LessonEngine Second Cursor + main.ts/ProgressIndicator Integration Summary

**A distinct, resumable review pass appended after the main 19-exercise sequence — `LessonEngine.getCurrentExercise()` resolves main-vs-review position from a second cursor over the immutable `this.exercises` array, `main.ts` serves review items through the existing renderers unchanged, and a `reviewDequeueId` field folds queue removal into the same single `exercise_attempt` dispatch, closing PROGRESS-04 end to end.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-02T15:24:00Z (approx, per first task commit)
- **Completed:** 2026-07-02T15:31:16Z
- **Tasks:** 3
- **Files modified:** 10 (9 modified/extended, 1 created)

## Accomplishments
- Added a required `reviewPassIndex` field to `CurrentPositionSchema` (seeded 0) so a legacy blob missing it resets rather than resuming into an undefined cursor (T-02-05); documented the chosen "dequeue-on-completion means reviewQueue[0] is always current" model that leaves the field unused but forward-compatible
- Built `LessonEngine.getCurrentExerciseId()` / `getCurrentExercise()` / `isReviewPass()` — a second cursor resolved by looking up `reviewQueue` ids against the immutable `this.exercises` array, which is never spliced or mutated (Pitfall 4)
- Extended the `exercise_attempt` `Action`/reduce branch in `store.ts` with an optional `reviewDequeueId`, applying additions-then-removal so a review answer can simultaneously enqueue new ids (a different topic re-triggering `needs_review`) and dequeue the just-completed one, all in the SAME single dispatch (Pitfall 3 preserved — zero new action types)
- `handleAnswer` now determines `wasReviewPass` before dispatching, passes `reviewDequeueId` when appropriate, and never dispatches `advance_position` for a review-pass answer (the dequeue itself is the advance) — main-pass `advance_position` semantics are completely unchanged
- Rewired `main.ts`'s `render()` to serve exercises via `getCurrentExercise()` instead of a direct `engine.exercises[index]` lookup, so `"Урок завершён!"` now appears only when the main sequence is done AND `reviewQueue` is empty; feedback tracking switched to an `{atIndex, exerciseId}` key since the review pass no longer advances `currentExerciseIndex` per answer
- Added `renderReviewProgressIndicator()` to `ProgressIndicator.ts` ("Повторение: N из K", zero `innerHTML`) with a review-pass total captured once at pass start so the denominator never regresses as items dequeue, and never renders the main-sequence index past `totalExercises` (avoids compounding Phase 1 UAT Gap 2 for this new range)
- Wrote `tests/e2e/reviewQueuePass.test.ts` (6 tests) driving a real `Lesson-1A.json` session through `food_vocabulary` (9 exercises) into a populated `reviewQueue`, then consuming the whole review pass, proving dequeue-regardless-of-correctness, reward dedup reuse across main-pass and review-pass answers on the same `exerciseId`, mid-review persist/resume, and the D-06 FSM closing a topic to `mastered` purely through review-pass answers

## Task Commits

Each task was committed atomically:

1. **Task 1: Review-pass cursor — schema + LessonEngine resolution + store dequeue (PROGRESS-04)** - `92ce9b9` (feat)
2. **Task 2: Wire the review pass into the UI (main.ts + ProgressIndicator) — no new screens** - `4b8146e` (feat)
3. **Task 3: End-to-end review-pass traversal test (PROGRESS-04)** - `be97b4d` (test)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `src/core/state/progressSchema.ts` - Adds required `reviewPassIndex: z.number()` to `CurrentPositionSchema`
- `src/core/state/initialState.ts` - Seeds `reviewPassIndex: 0`
- `src/core/state/store.ts` - `exercise_attempt` action gains optional `reviewDequeueId`; reduce branch applies additions-then-removal on `reviewQueue`
- `src/core/lessonEngine.ts` - `getCurrentExerciseId()`/`getCurrentExercise()`/`isReviewPass()`; `handleAnswer` computes `wasReviewPass`, sets `reviewDequeueId`, skips `advance_position` for review answers
- `src/ui/components/ProgressIndicator.ts` - Adds `renderReviewProgressIndicator(current, total)`, existing `renderProgressIndicator` signature/behavior untouched
- `src/main.ts` - `render()` serves via `getCurrentExercise()`; review-pass top-bar indicator with a captured-once denominator; feedback keyed by `{atIndex, exerciseId}`
- `tests/core/lessonEngine.test.ts` - 7 new tests: main/review `getCurrentExerciseId`, dequeue on correct/incorrect, persist/resume, no-array-mutation
- `tests/core/state/persistence.test.ts` - Fixed 2 pre-existing fixture literals missing the new required `reviewPassIndex` field (Rule 3 blocking-issue fix — TS build would otherwise fail)
- `tests/ui/components/ProgressIndicator.test.ts` - 2 new tests for `renderReviewProgressIndicator`
- `tests/e2e/reviewQueuePass.test.ts` (NEW) - 6 tests: queue populated then consumed, dequeue regardless of correctness, reward dedup reuse, persist/resume mid-review, topic status closes via review path (isolated unit-style + full-traversal variant)

## Decisions Made
- Chosen cursor model documented above in `key-decisions`: `reviewPassIndex` is a required, persisted, but currently-unused schema field — the executor's explicit choice per the plan's discretion clause, since dequeue-on-completion makes `reviewQueue[0]` always the current item.
- `main.ts` feedback state switched from an index-only key to `{atIndex, exerciseId}` — a deliberate, minimal extension of Phase 1's existing transient-feedback pattern, not a new mechanism, needed because the review pass doesn't move `currentExerciseIndex` per answer.
- Review-pass progress-indicator denominator captured once per pass (not read live from the shrinking `reviewQueue.length` every render) to avoid a regressing "K" in "Повторение: N из K".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing `persistence.test.ts` fixtures missing the new required `reviewPassIndex` field**
- **Found during:** Task 1 (`npx tsc --noEmit` after extending `CurrentPositionSchema`)
- **Issue:** Two hand-built `currentPosition` object literals in `tests/core/state/persistence.test.ts` (not in this plan's `files_modified` list) predated the new required `reviewPassIndex` field and failed to typecheck, blocking the full suite from compiling.
- **Fix:** Added `reviewPassIndex: 0` to both literals and to the corresponding `toEqual` assertion.
- **Files modified:** `tests/core/state/persistence.test.ts`
- **Verification:** `npx tsc --noEmit` clean; `npx vitest run` full suite green.
- **Committed in:** `92ce9b9` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the build/test suite green after extending a shared required schema field; no scope creep — the fix only touched the two literals that broke, not the file's test logic.

## Issues Encountered

- Initial e2e test design called `handleAnswer()` for exercise ids ahead of the current main-pass cursor (bypassing the real UI's strict in-order answering), which produced a misleading `currentExerciseIndex` assertion failure. Root cause: Phase 1's `advance_position` only fires on a correct answer, so an exercise left unanswered-correctly blocks the index from moving past it — this is expected, intentional behavior (not a bug), and the test driver was rewritten to answer exercises strictly in main-pass order, mirroring how `main.ts` really drives `handleAnswer`.
- The originally-planned "topic still `needs_review` entering the review pass" full-traversal scenario turned out to reach `mastered` before the review pass even started (9 correct-in-a-row across `ex010`-`ex018` in the main pass exceeds the 3-correct-in-a-row D-06 mastery rule well before `ex019`). Rather than fight the streak math to artificially suppress mastery, added a second, isolated unit-style e2e test that constructs a `needs_review`-entering-review-pass state directly (mirroring the `lessonEngine.test.ts` unit-test style) to prove the FSM closes to `mastered` purely through review-pass answers — and kept the original full-traversal scenario since it independently proves `weak_topic_closed` does not re-fire when review-pass answers continue touching an already-mastered topic (D-05).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PROGRESS-04 is now fully closed: the child can complete `reviewQueue` items in the same session, served as a distinct appended pass, dequeued on completion (correct or not), reward-deduped by original `exerciseId`, and resumable after a reload.
- Phase 2's full requirement set (PROGRESS-01 through PROGRESS-04, REWARD-01, REWARD-02) is now complete and user-observable end to end via `npm run dev` (deliberately failing `food_vocabulary` twice reaches a review pass after the 19th exercise).
- The `getCurrentExercise()`/`isReviewPass()` second-cursor pattern is available for Phase 5's UI-polish pass to build on (e.g. fixing the still-deferred main-pass "N+1 из N" overshoot, UAT Gap 2, which this plan deliberately did NOT touch for the main range — only ensured the NEW review range doesn't compound it).
- Full suite green: 135 tests across 22 files; `tsc --noEmit` clean; `npm run build` clean; no regressions in Phase 1/Plan 01/Plan 02 tests.
- No blockers.

---
*Phase: 02-progress-tracking-review-queue-reward-engine*
*Completed: 2026-07-02*

## Self-Check: PASSED

All 9 created/modified files verified present on disk; all 4 commits (92ce9b9, 4b8146e, be97b4d, 8b6f01a) verified present in git log.
