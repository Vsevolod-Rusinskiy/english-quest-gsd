---
phase: 02-progress-tracking-review-queue-reward-engine
plan: 01
subsystem: core-state
tags: [zod, typescript, vitest, state-machine, progress-tracking]

# Dependency graph
requires:
  - phase: 01-deterministic-core-lesson-rendering-persistence
    provides: ProgressStateSchema placeholder fields, StateStore/persistence.ts safeParse-or-reset pattern, checkSingleChoice.ts pure-function house style, ExerciseSchema/lessonLoader
provides:
  - Typed TopicStatSchema/TopicStatusSchema/RewardReasonSchema/RewardEventSchema on ProgressStateSchema
  - topicStats and currentCorrectStreak required fields (legacy blobs reset via load())
  - nextTopicStatus() pure FSM implementing all D-06 transitions
  - enqueueReviewItems() pure review-queue population scan implementing D-02
  - Hand-authored multi-topic fixture proving the topicImpact-loop case (Pitfall 2)
affects: [02-progress-tracking-review-queue-reward-engine plan 02 (reward engine + handleAnswer wiring), 02-progress-tracking-review-queue-reward-engine plan 03 (review-pass UI wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod schema-per-shape + inferred type export (TopicStatusSchema/TopicStatSchema/RewardReasonSchema/RewardEventSchema), mirroring ExerciseStatSchema/CurrentPositionSchema"
    - "Pure deterministic FSM function returning a status + transition signal, no side effects — nextTopicStatus() mirrors checkSingleChoice.ts's pure-function house style"
    - "Reset-on-schema-mismatch for new required fields — a Phase-1-shaped blob missing topicStats/currentCorrectStreak fails safeParse and resets to initialState()"

key-files:
  created:
    - src/core/progress/topicStatusMachine.ts
    - src/core/progress/reviewQueue.ts
    - tests/core/state/progressSchema.test.ts
    - tests/core/progress/topicStatusMachine.test.ts
    - tests/core/progress/reviewQueue.test.ts
    - tests/fixtures/multi-topic.fixture.json
  modified:
    - src/core/state/progressSchema.ts
    - src/core/state/initialState.ts

key-decisions:
  - "TopicStatus enum uses English identifiers (not_started/in_progress/needs_review/mastered) per RESEARCH Assumption A1 — Russian labels stay a UI-layer concern for Phase 5"
  - "reviewQueue stores exerciseId strings, not full exercise objects (D-02 discretion, matches PERSIST-01 precedent)"
  - "All new Zod fields (topicStats, currentCorrectStreak, typed rewardHistory/reviewQueue) authored as required, not optional/default, so legacy Phase-1 blobs reset rather than silently produce partial state (T-02-01 mitigation)"

requirements-completed: [PROGRESS-01, PROGRESS-02, PROGRESS-03]

coverage:
  - id: D1
    description: "ProgressStateSchema exposes typed topicStats (per-topic attempts/correct/errors/correctStreak/status) and currentCorrectStreak; a legacy Phase-1 blob missing these fields resets to initialState() on load"
    requirement: "PROGRESS-01"
    verification:
      - kind: unit
        ref: "tests/core/state/progressSchema.test.ts#TopicStatSchema, #Pitfall 1: legacy Phase-1-shaped blob resets on load, #initialState()"
        status: pass
    human_judgment: false
  - id: D2
    description: "nextTopicStatus() implements the exact D-06 transition table (not_started->in_progress, in_progress->needs_review at 2+ errors, needs_review->in_progress on correct, ->mastered at 3-correct-streak from any status) with no spurious re-emits"
    requirement: "PROGRESS-02"
    verification:
      - kind: unit
        ref: "tests/core/progress/topicStatusMachine.test.ts#nextTopicStatus"
        status: pass
    human_judgment: false
  - id: D3
    description: "enqueueReviewItems() scans all lesson exercises for a topic, excludes already-correct, includes never-attempted, dedups against the current queue, returns exerciseId strings"
    requirement: "PROGRESS-03"
    verification:
      - kind: unit
        ref: "tests/core/progress/reviewQueue.test.ts#enqueueReviewItems"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-07-02
status: complete
---

# Phase 2 Plan 1: Progress Schema Extension + Topic-Status FSM + Review-Queue Scan Summary

**Typed Zod schema extension (topicStats/rewardHistory/reviewQueue) plus two pure functions — nextTopicStatus() (D-06 FSM) and enqueueReviewItems() (D-02 scan) — with 27 new table-driven unit tests, zero new dependencies.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-02T12:00:00Z (approx, per STATE.md session start)
- **Completed:** 2026-07-02T12:14:08Z
- **Tasks:** 3
- **Files modified:** 8 (2 modified, 6 created)

## Accomplishments
- Extended `ProgressStateSchema` with `TopicStatusSchema`, `TopicStatSchema`, `RewardReasonSchema`, `RewardEventSchema`; typed `rewardHistory`/`reviewQueue` (previously `z.array(z.unknown())`); added required `topicStats`/`currentCorrectStreak` fields
- Built `nextTopicStatus()` — a pure, table-driven FSM implementing all four D-06 transitions plus the "3 correct-in-a-row from any status" mastery rule
- Built `enqueueReviewItems()` — a pure scan implementing D-02's review-queue population (topic-membership filter, not-yet-correct filter, dedup)
- Hand-authored `multi-topic.fixture.json` proving the `topicImpact[]` loop handles >1 topic per exercise (Pitfall 2 — real `Lesson-1A.json` never exercises this)
- Verified the legacy-blob-resets behavior (Pitfall 1 / T-02-01): a Phase-1-shaped blob missing the new required fields fails `safeParse()` and resets to `initialState()` via the existing `load()` path

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ProgressStateSchema + initialState with typed Phase 2 fields** - `d0b6e14` (feat)
2. **Task 2: Topic-status FSM (nextTopicStatus) — D-06 transition table** - `f6b4d34` (feat)
3. **Task 3: Review-queue population scan (enqueueReviewItems) — D-02** - `ecee869` (feat)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `src/core/state/progressSchema.ts` - Adds TopicStatusSchema/TopicStatSchema/RewardReasonSchema/RewardEventSchema; types rewardHistory/reviewQueue; adds topicStats/currentCorrectStreak
- `src/core/state/initialState.ts` - Seeds `topicStats: {}` and `currentCorrectStreak: 0`
- `src/core/progress/topicStatusMachine.ts` - `nextTopicStatus()` pure FSM (PROGRESS-02, D-06)
- `src/core/progress/reviewQueue.ts` - `enqueueReviewItems()` pure scan (PROGRESS-03, D-02)
- `tests/core/state/progressSchema.test.ts` - 12 tests: new schema shapes, enum values, Pitfall-1 reset case, initialState() seeding + round-trip
- `tests/core/progress/topicStatusMachine.test.ts` - 9 tests: all D-06 transitions + fixture self-validation
- `tests/core/progress/reviewQueue.test.ts` - 6 tests: scan/exclude/dedup/multi-topic/no-match cases
- `tests/fixtures/multi-topic.fixture.json` - Hand-authored text-input exercise with 2 `topicImpact` entries

## Decisions Made
- `TopicStatus` string-literal values kept as English identifiers, imported from `progressSchema.ts` into `topicStatusMachine.ts` (re-exported via `export type { TopicStatus }`) rather than redeclared, so the FSM's output type is identical to the schema's inferred type — satisfies the plan's key_link requirement.
- No new npm dependencies added, consistent with RESEARCH.md's "zero new dependencies" finding.

## Deviations from Plan

None - plan executed exactly as written. All `<behavior>` test bullets from all three tasks are covered; all `<done>` criteria met.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (reward engine + `handleAnswer` wiring) can now consume `nextTopicStatus()` and `enqueueReviewItems()` directly — both are pure functions ready for composition into `evaluateAttempt()`.
- `TopicStatSchema`/`RewardEventSchema` are ready for the reward-engine module (Plan 02) to construct and validate reward ledger entries against.
- Full test suite green (95 tests, 18 files) and `tsc --noEmit` clean — no regressions in Phase 1 code.
- No blockers.

---
*Phase: 02-progress-tracking-review-queue-reward-engine*
*Completed: 2026-07-02*

## Self-Check: PASSED

All 9 created/modified files verified present on disk; all 4 commits (d0b6e14, f6b4d34, ecee869, c29726b) verified present in git log.
