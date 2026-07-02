---
phase: 02-progress-tracking-review-queue-reward-engine
plan: 02
subsystem: core-progress-rewards
tags: [typescript, vitest, reducer, reward-engine, state-machine]

# Dependency graph
requires:
  - phase: 02-progress-tracking-review-queue-reward-engine
    provides: "Plan 01 — TopicStat/RewardEvent Zod schemas, nextTopicStatus() FSM, enqueueReviewItems() scan"
provides:
  - "computeRewardEvents() — fixed-rule reward engine (SPEC §10 amounts, D-03/D-04/D-05)"
  - "evaluateAttempt() — single per-answer aggregator composing the topic loop, FSM, review queue, and rewards"
  - "Enriched exercise_attempt Action/reduce branch folding topicStats/reviewQueue/rewardHistory/currentRewards/currentCorrectStreak in one dispatch"
  - "LessonEngine.handleAnswer wired to drive the full Phase 2 update on every real answer"
affects: [02-progress-tracking-review-queue-reward-engine plan 03 (review-pass UI wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure rule-engine module (computeRewardEvents) returning {rewardEvents, nextCorrectStreak}, mirroring checkTextInput.ts's CheckResult-style pure-function shape"
    - "Single aggregator function (evaluateAttempt) composing multiple pure sub-functions into one delta object, consumed by exactly one enriched dispatch — preserves the 'one dispatch = one save = one render' invariant from Phase 1"
    - "Enrich existing discriminated-union Action members instead of adding new action types, when multiple state slices must update from one user action"

key-files:
  created:
    - src/core/rewards/rewardEngine.ts
    - src/core/progress/evaluateAttempt.ts
    - tests/core/rewards/rewardEngine.test.ts
    - tests/core/progress/evaluateAttempt.test.ts
    - tests/core/state/store.test.ts
  modified:
    - src/core/state/store.ts
    - src/core/lessonEngine.ts
    - tests/core/lessonEngine.test.ts

key-decisions:
  - "Resolved RESEARCH.md Open Question 2: correct_after_hint is the single canonical reason for any correct answer after a prior incorrect attempt (Phase 1's FeedbackBanner already shows exercise.hint.firstError on every wrong answer, so a prior error implies the child saw a hint). fixed_mistake is intentionally left unreachable in this engine to avoid double-granting the same recovery situation under two different reasons — it stays in the RewardReason enum for a future phase if real hint-vs-mistake tracking is ever built."
  - "evaluateAttempt() takes allExercises as an explicit parameter (LessonEngine passes this.exercises) rather than reaching into ProgressState, since state stores no exercise objects — keeps the aggregator pure and testable with hand-built exercise fixtures."
  - "reviewQueueAdditions returned by evaluateAttempt() are pre-filtered to only the NEW ids beyond state.reviewQueue, and the reduce branch also re-filters defensively — belt-and-suspenders dedup so no duplicate exerciseIds can ever land in reviewQueue."

requirements-completed: [PROGRESS-01, PROGRESS-02, PROGRESS-03, REWARD-01, REWARD-02]

coverage:
  - id: D1
    description: "computeRewardEvents() grants the exact SPEC §10 amounts (honest_attempt +1, first_try_correct +5, correct_after_hint +3, streak_bonus +10, weak_topic_closed +15) with (exerciseId,reason) dedup preventing re-granting (D-03, no reward farming)"
    requirement: "REWARD-01"
    verification:
      - kind: unit
        ref: "tests/core/rewards/rewardEngine.test.ts#computeRewardEvents"
        status: pass
    human_judgment: false
  - id: D2
    description: "first_try_correct and correct_after_hint are mutually exclusive (priorAttempts branch); streak_bonus fires every 5 correct-in-a-row session-globally and resets; weak_topic_closed fires exactly once off the FSM's entered_mastered signal, never from a rewardHistory scan (D-04, D-05)"
    requirement: "REWARD-01"
    verification:
      - kind: unit
        ref: "tests/core/rewards/rewardEngine.test.ts#computeRewardEvents streak_bonus and weak_topic_closed cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every reward is a rewardHistory ledger entry with rewardEventId (crypto.randomUUID), reason, amount, attemptNumber, createdAt (ISO), and currentRewards reflects the summed balance"
    requirement: "REWARD-02"
    verification:
      - kind: unit
        ref: "tests/core/rewards/rewardEngine.test.ts#rewardEventId/createdAt/attemptNumber case; tests/core/state/store.test.ts#folds ... in ONE reduced state"
        status: pass
    human_judgment: false
  - id: D4
    description: "evaluateAttempt() loops ALL exercise.topicImpact entries (D-01, not just index [0]), updates topicStats counters, runs nextTopicStatus() FSM, and populates reviewQueue via enqueueReviewItems() on entered_needs_review transitions"
    requirement: "PROGRESS-01"
    verification:
      - kind: unit
        ref: "tests/core/progress/evaluateAttempt.test.ts#D-01 topic loop; #FSM + reviewQueue on 2nd error"
        status: pass
    human_judgment: false
  - id: D5
    description: "Topic-status FSM transitions are driven from the live handleAnswer path against real Lesson-1A.json exercises — a topic reaches needs_review at 2 errors and mastered at 3 correct-in-a-row, matching Plan 01's D-06 rules"
    requirement: "PROGRESS-02"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#Phase 2: progress/reward wiring; tests/core/progress/evaluateAttempt.test.ts#weak_topic_closed via aggregator"
        status: pass
    human_judgment: false
  - id: D6
    description: "2+ errors on a topic (via the live handleAnswer path) enqueues the related exerciseId into reviewQueue"
    requirement: "PROGRESS-03"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#integration, review queue: two incorrect answers ... flip its topic to needs_review and enqueue"
        status: pass
    human_judgment: false
  - id: D7
    description: "handleAnswer folds the full evaluateAttempt() delta into the SAME single enriched exercise_attempt dispatch — an incorrect answer triggers exactly 1 setItem call, a correct answer triggers exactly 2 (exercise_attempt + advance_position), proving no extra dispatch sites were added for topic/reward/queue concerns (Pitfall 3, T-02-04 mitigated)"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#Pitfall 3 single-save guard; tests/core/state/store.test.ts#dispatching the enriched exercise_attempt action still triggers exactly one save() call"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-07-02
status: complete
---

# Phase 2 Plan 2: Reward Engine + evaluateAttempt Aggregator + handleAnswer Wiring Summary

**Fixed-rule reward engine (computeRewardEvents, SPEC §10 amounts) and a single per-answer aggregator (evaluateAttempt) wired into LessonEngine.handleAnswer, so answering a real Lesson-1A exercise now updates topicStats, runs the topic-status FSM, populates reviewQueue, and appends a rewardHistory ledger entry — all folded into exactly one enriched exercise_attempt dispatch per answer.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-02T15:17:00Z (approx, per first task commit)
- **Completed:** 2026-07-02T15:20:03Z
- **Tasks:** 3
- **Files modified:** 8 (2 modified, 6 created — including this SUMMARY)

## Accomplishments
- Built `computeRewardEvents()` — pure fixed-rule reward engine implementing all six `RewardReason`s' SPEC §10 amounts (1/5/3/4/10/15), `(exerciseId, reason)` dedup (D-03), session-global streak counter firing `streak_bonus` every 5 correct-in-a-row with reset (D-04), and `weak_topic_closed` fired directly off an FSM `entered_mastered` signal rather than a `rewardHistory` scan (D-05)
- Resolved RESEARCH.md's Open Question 2 (hint-tracking gap): any correct answer after a prior incorrect attempt is graded `correct_after_hint`, since Phase 1's `FeedbackBanner` already surfaces `hint.firstError` on every wrong answer — `fixed_mistake` is intentionally left unreachable to prevent double-granting the same recovery under two reasons
- Built `evaluateAttempt()` — the single aggregator that loops `exercise.topicImpact[]` (D-01, never indexes `[0]`), drives `nextTopicStatus()` per topic, calls `enqueueReviewItems()` on `entered_needs_review`, and calls `computeRewardEvents()` exactly once, returning one delta object
- Enriched the **existing** `exercise_attempt` `Action`/`reduce` case in `store.ts` (no new action types) to fold `topicStats`, `reviewQueue`, `rewardHistory`, `currentRewards`, and `currentCorrectStreak` in a single branch
- Wired `evaluateAttempt()` into `LessonEngine.handleAnswer()`, inserted between the checker verdict and the first (existing) dispatch — the conditional `advance_position` dispatch on correct answers is untouched, preserving Phase 1's exactly-two-dispatch-per-correct-answer shape
- Verified via a setItem-count guard: an incorrect answer now still triggers exactly 1 save, a correct answer exactly 2 — proving Phase 2 added zero new dispatch call sites (T-02-04 mitigated)

## Task Commits

Each task was committed atomically:

1. **Task 1: Reward engine (computeRewardEvents) — SPEC §10 amounts, D-03/D-04/D-05** - `7d1f197` (feat)
2. **Task 2: evaluateAttempt aggregator + single enriched dispatch (Pitfall 3)** - `2209d81` (feat)
3. **Task 3: Wire evaluateAttempt into handleAnswer — one dispatch per answer** - `10ad1d0` (feat)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `src/core/rewards/rewardEngine.ts` - `computeRewardEvents()` pure reward engine (REWARD-01, REWARD-02, D-03/D-04/D-05)
- `src/core/progress/evaluateAttempt.ts` - `evaluateAttempt()` single per-answer aggregator (PROGRESS-01/02/03, REWARD-01/02, D-01/D-02/D-06)
- `src/core/state/store.ts` - Enriches the existing `exercise_attempt` `Action`/`reduce` case with topic/reward/queue deltas (Pitfall 3)
- `src/core/lessonEngine.ts` - `handleAnswer()` now calls `evaluateAttempt()` and enriches the first dispatch
- `tests/core/rewards/rewardEngine.test.ts` - 13 tests: dedup, mutual exclusion, streak firing/reset, mastery reward, amounts, event shape
- `tests/core/progress/evaluateAttempt.test.ts` - 4 tests: D-01 multi-topic loop, FSM+reviewQueue on 2nd error, reward pass-through, mastery-via-aggregator
- `tests/core/state/store.test.ts` - 3 tests: enriched reduce fold, single-save guard, reviewQueue dedup
- `tests/core/lessonEngine.test.ts` - 5 new integration tests: topic stats, rewards (=6 on first correct), review queue, Pitfall 3 setItem-count guard, attemptNumber-driven reward selection

## Decisions Made
- `correct_after_hint` chosen as the sole canonical "recovery" reward reason (see key-decisions in frontmatter) — `fixed_mistake` stays defined in the Zod enum but is never emitted by this engine, an honest and explicitly-documented scope choice rather than a stub.
- `evaluateAttempt()` receives `allExercises` as an explicit parameter rather than reading from `ProgressState` (which stores no exercise objects), keeping the function pure and easy to unit-test with hand-built fixtures.
- Defensive double-dedup on `reviewQueueAdditions`: filtered once inside `evaluateAttempt()` and again inside the `store.ts` reduce branch, so no code path can ever produce duplicate `reviewQueue` entries even if a future caller passes a delta computed against stale state.

## Deviations from Plan

None - plan executed exactly as written. All `<behavior>` test bullets from all three tasks are covered; all `<done>` criteria met.

## Issues Encountered

None. Task 2's own test scope (`tests/core/progress/`, `tests/core/state/`) was green in isolation before Task 3 wired `evaluateAttempt` into `handleAnswer` — the expected transient failure in `tests/core/lessonEngine.test.ts` (old dispatch shape missing new required action fields) was resolved entirely by Task 3 as planned, not treated as a bug to fix mid-Task-2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 (review-pass UI wiring) can now rely on a fully live `reviewQueue` that real gameplay populates — `LessonEngine.exercises` remains untouched (Pitfall 4 preserved), ready for a second cursor/pass concept.
- `currentRewards`/`rewardHistory` are now actively written by real answers — Phase 4's Reward Advisor (agent-proposed praise text) can later read this ledger without touching the amounts it already contains.
- Full suite green: 120 tests across 21 files; `tsc --noEmit` clean; no regressions in Phase 1 exercise/checker/persistence tests.
- No blockers.

---
*Phase: 02-progress-tracking-review-queue-reward-engine*
*Completed: 2026-07-02*
