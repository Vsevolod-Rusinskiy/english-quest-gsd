---
phase: 02-progress-tracking-review-queue-reward-engine
verified: 2026-07-02T15:53:24Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 2: Progress Tracking, Review Queue & Reward Engine Verification Report

**Phase Goal:** Core tracks per-topic mastery, surfaces weak topics for same-session review, and pays out rubles by fixed, ledgered rules — entirely without agent involvement
**Verified:** 2026-07-02T15:53:24Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every exercise attempt updates per-exercise/topic counters (attempts, correct, errors, streaks) inspectable in state | ✓ VERIFIED | `src/core/progress/evaluateAttempt.ts` loops `exercise.topicImpact` (never index `[0]`), updates `topicUpdates[topic]` with attempts/correct/errors/correctStreak; `src/core/state/store.ts` `exercise_attempt` reduce branch folds `topicStats` and `exerciseStats` (with `lastAttemptCorrect`) into state. Tested: `tests/core/progress/evaluateAttempt.test.ts` (D-01 multi-topic loop, WR-01 duplicate-topic accumulation), `tests/core/lessonEngine.test.ts` (real Lesson-1A integration: "updates state.topicStats for that exercise's topicImpact topic"). |
| 2 | A topic that accumulates 2+ errors flips to "Повторить" (`needs_review`) and its exercises appear in `reviewQueue`; other topics move Не изучено→В процессе→Выучено by the same threshold rules | ✓ VERIFIED | `src/core/progress/topicStatusMachine.ts` `nextTopicStatus()` implements exactly the D-06 transition table (not_started→in_progress on first attempt; 2+ errors→needs_review; needs_review+correct→in_progress; 3-correct-streak from any status→mastered). `src/core/progress/reviewQueue.ts` `enqueueReviewItems()` scans all lesson exercises by topic membership and enqueues on `entered_needs_review`. Tested exhaustively: `tests/core/progress/topicStatusMachine.test.ts` (9 tests, all D-06 transitions + mastery rule + no-spurious-re-emit), `tests/core/progress/reviewQueue.test.ts` (6 tests: scan/exclude/dedup/multi-topic/no-match), `tests/core/lessonEngine.test.ts` "integration, review queue: two incorrect answers ... flip its topic to needs_review and enqueue". |
| 3 | Child can open and complete `reviewQueue` items within the same session, and completing them updates topic status | ✓ VERIFIED | `LessonEngine.getCurrentExerciseId()`/`getCurrentExercise()`/`isReviewPass()` resolve a second cursor over `reviewQueue` against the immutable `this.exercises` (never spliced). `src/main.ts` `render()` serves review items via `getCurrentExercise()` reusing `renderExerciseScreen` unchanged, showing "Урок завершён!" only when both the main sequence is done AND `reviewQueue` is empty. A review answer dequeues (correct or not) via `reviewDequeueId` folded into the same `exercise_attempt` dispatch and reuses the full `evaluateAttempt`/reward/FSM path. Tested: `tests/core/lessonEngine.test.ts` "Phase 2 Plan 03: review-pass cursor" (8 tests: main/review resolution, dequeue on correct/incorrect, persist/resume, no-array-mutation), `tests/e2e/reviewQueuePass.test.ts` (6 tests driving a real Lesson-1A session: queue populated then consumed, dequeue regardless of correctness, reward dedup reuse, persist/resume mid-review, topic closes to mastered via review path — both isolated and full-traversal variants), `tests/e2e/reviewPassFeedback.test.ts` (DOM-level: incorrect review answer shows the banner and only advances after an explicit "Продолжить" tap). |
| 4 | Rubles are awarded only for the fixed reasons (`honest_attempt`, `first_try_correct`, `correct_after_hint`, `fixed_mistake`, `streak_bonus`, `weak_topic_closed`), each capped per exercise, and every award appears as a `rewardHistory` entry with reason/amount/attemptNumber/timestamp | ✓ VERIFIED | `src/core/rewards/rewardEngine.ts` `computeRewardEvents()` implements SPEC §10 amounts (1/5/3/4/10/15) via a fixed `REWARD_AMOUNTS` map, `(exerciseId, reason)` dedup (`alreadyGranted`) for `honest_attempt`/`first_try_correct`/`correct_after_hint`, mutual exclusion via the `priorAttempts` branch, session-global `streak_bonus` (fires every 5 correct-in-a-row, resets), and `weak_topic_closed` fired off the FSM `entered_mastered` signal (looped over `masteredTopics[]` per CR-01, not a single nullable value). Every emitted event has `rewardEventId` (`crypto.randomUUID()`), `reason`, `amount`, `attemptNumber`, `createdAt` (ISO). `currentRewards` is the summed ledger, folded in `store.ts`. Tested: `tests/core/rewards/rewardEngine.test.ts` (13 tests: amounts, dedup, mutual exclusion, streak fire/reset, mastery-driven reward, event shape, `fixed_mistake` intentionally never emitted — explicitly asserted). `fixed_mistake` remains defined in `RewardReasonSchema`/`REWARD_AMOUNTS` (amount 4) but is never emitted — a documented, tested Phase 2 scope decision (collapsed into `correct_after_hint` to avoid double-granting the same recovery situation), not a stub. |

**Score:** 4/4 roadmap success criteria verified (0 present-but-behavior-unverified)

### PLAN-Level Must-Haves (merged, deduplicated against roadmap SCs above)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | `nextTopicStatus()` returns the exact D-06 transitions (not_started→in_progress, in_progress→needs_review at 2+ errors, needs_review→in_progress on correct, →mastered at 3-in-a-row from any status) | ✓ VERIFIED | Covered under Truth 2; `topicStatusMachine.ts` code inspected directly, 9/9 unit tests pass. |
| 6 | `enqueueReviewItems()` scans ALL lesson exercises for a topic, excludes already-resolved ones, dedups, returns exerciseId strings | ✓ VERIFIED | `reviewQueue.ts` inspected directly; filters on `!lastAttemptCorrect` (CR-02 fix — reflects "unresolved in current episode," not lifetime correctness) and dedups against `currentQueue`. 6/6 unit tests pass, including the CR-02 regression case. |
| 7 | A legacy Phase-1-shaped blob resets to `initialState()` on load | ✓ VERIFIED | `progressSchema.ts` — all new fields (`topicStats`, `currentCorrectStreak`, typed `rewardHistory`/`reviewQueue`, `reviewPassIndex`) authored as required, no `.optional()`/`.default()`. Test: `tests/core/state/progressSchema.test.ts` Pitfall-1 reset case. |
| 8 | `handleAnswer()` folds the topic loop, FSM, reviewQueue population, and reward computation into ONE `exercise_attempt` dispatch (one save, one render) | ✓ VERIFIED | `lessonEngine.ts` `handleAnswer()` calls `evaluateAttempt()` once and enriches the single existing dispatch; `store.ts` `dispatch()` calls `save()` exactly once per call. Test: `tests/core/lessonEngine.test.ts` "Pitfall 3 single-save guard" (setItem-count assertion: 1 call on incorrect, 2 on correct — exactly Phase 1's shape, no new dispatch sites), `tests/core/state/store.test.ts` single-save guard. |
| 9 | `first_try_correct`/`correct_after_hint` mutually exclusive; `streak_bonus` fires every 5 correct-in-a-row; `weak_topic_closed` fires exactly once off `entered_mastered` | ✓ VERIFIED | Covered under Truth 4; directly inspected in `rewardEngine.ts`; CR-01 fix confirmed present (loops `masteredTopics[]`, not a single nullable field). |
| 10 | Review-pass position survives a page reload via a persisted cursor; `currentExerciseIndex`'s Phase 1 meaning is not corrupted; `this.exercises` is never mutated | ✓ VERIFIED | `CurrentPositionSchema.reviewPassIndex` required field; `LessonEngine` never splices `this.exercises` (lookup-only via `.find()`). Tests: `tests/core/lessonEngine.test.ts` "persist/resume (PERSIST-02)" and "no array mutation (Pitfall 4): engine.exercises.length stays === totalExercises throughout a review pass"; `tests/e2e/reviewQueuePass.test.ts` "persist/resume mid-review". |

**Score:** 10/10 must-haves verified (4 roadmap SCs + 6 plan-level truths, deduplicated where overlapping)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/state/progressSchema.ts` | Typed `TopicStatSchema`/`RewardEventSchema`/`topicStats`/`currentCorrectStreak`/`reviewPassIndex` | ✓ VERIFIED | Present, substantive, all fields required (no silent-partial-state risk). |
| `src/core/progress/topicStatusMachine.ts` | `nextTopicStatus()` D-06 FSM | ✓ VERIFIED | Present, substantive, wired into `evaluateAttempt.ts`. |
| `src/core/progress/reviewQueue.ts` | `enqueueReviewItems()` D-02 scan | ✓ VERIFIED | Present, substantive, wired into `evaluateAttempt.ts`. |
| `src/core/progress/evaluateAttempt.ts` | Single per-answer aggregator | ✓ VERIFIED | Present, substantive, wired into `lessonEngine.ts` `handleAnswer()`. |
| `src/core/rewards/rewardEngine.ts` | `computeRewardEvents()` fixed-rule engine | ✓ VERIFIED | Present, substantive, wired into `evaluateAttempt.ts`. |
| `src/core/state/store.ts` | Enriched `exercise_attempt` action/reduce | ✓ VERIFIED | Present, folds all Phase 2 slices in the existing case, no new action types. |
| `src/core/lessonEngine.ts` | `handleAnswer` wiring + review-pass cursor methods | ✓ VERIFIED | Present, `getCurrentExerciseId`/`getCurrentExercise`/`isReviewPass` wired into `main.ts`. |
| `src/main.ts` | Review-pass UI serving + feedback banner | ✓ VERIFIED | Present, uses `getCurrentExercise()`; WR-02 fix + orchestrator's follow-on fix both present (feedback-applies-here condition not gated on `!inReviewPass`). |
| `src/ui/components/ProgressIndicator.ts` | Distinct review-pass label | ✓ VERIFIED | `renderReviewProgressIndicator()` present, denominator captured once to avoid regression. |
| `tests/fixtures/multi-topic.fixture.json` | Multi-topic exercise fixture | ✓ VERIFIED | Present, validates against `ExerciseSchema`, `topicImpact.length === 2`. |
| `tests/e2e/reviewQueuePass.test.ts` | E2E review-pass traversal | ✓ VERIFIED | Present, 6 tests, all pass against real `Lesson-1A.json`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `evaluateAttempt.ts` | `topicStatusMachine.ts` | `nextTopicStatus()` call per topic in loop | ✓ WIRED | Directly imported and called inside the `topicImpact` loop. |
| `evaluateAttempt.ts` | `reviewQueue.ts` | `enqueueReviewItems()` on `entered_needs_review` | ✓ WIRED | Called conditionally on the FSM transition signal. |
| `evaluateAttempt.ts` | `rewardEngine.ts` | `computeRewardEvents()` once per attempt | ✓ WIRED | Called exactly once after the topic loop with aggregated `masteredTopics`. |
| `lessonEngine.ts handleAnswer()` | `evaluateAttempt.ts` | Direct call before the single dispatch | ✓ WIRED | Confirmed by direct code read; single dispatch enriched with the delta. |
| `store.ts exercise_attempt reduce` | All Phase 2 state slices | Spread-immutable fold in one case | ✓ WIRED | `topicStats`/`reviewQueue`/`rewardHistory`/`currentRewards`/`currentCorrectStreak` all folded in the single existing case, no new action types added. |
| `lessonEngine.ts` | `main.ts` | `getCurrentExercise()`/`isReviewPass()` consumed in `render()` | ✓ WIRED | `main.ts` no longer indexes `engine.exercises[currentExerciseIndex]` directly; uses the engine's resolution methods. |
| `main.ts` | `ProgressIndicator.ts` | `renderReviewProgressIndicator()` call gated on `isReviewPass()` | ✓ WIRED | Confirmed in `render()`; captured-once denominator avoids the K-regression bug. |

### Behavioral Spot-Checks / Test Suite Execution (independently run by verifier)

| Command | Result | Status |
|---------|--------|--------|
| `npm test` (full suite) | `Test Files 23 passed (23)` / `Tests 141 passed (141)` | ✓ PASS |
| `npx tsc --noEmit` | Exit 0, no output | ✓ PASS |
| `npx vitest run` on all Phase-2-touched test files (progressSchema, progress/, rewards/, store.test.ts, lessonEngine.test.ts, reviewQueuePass.test.ts, reviewPassFeedback.test.ts, ProgressIndicator.test.ts) | `Test Files 10 passed (10)` / `Tests 84 passed (84)` | ✓ PASS |
| `git status` | `nothing to commit, working tree clean` | ✓ PASS — all claimed commits are real and present |

The context note's claim about a post-code-review orchestrator fix (removing an overly-narrow `!inReviewPass` gate in `src/main.ts`, commit `b6db32b`) was independently verified against `git show b6db32b` — the diff matches exactly what was described, and its regression test (`tests/e2e/reviewPassFeedback.test.ts`) passes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROGRESS-01 | 02-01, 02-02 | Ядро ведёт счётчики попыток/правильных/ошибок/серий по каждому упражнению | ✓ SATISFIED | `topicStats`/`exerciseStats` counters updated via `evaluateAttempt`/reduce; tested at unit + integration level. |
| PROGRESS-02 | 02-01, 02-02 | Ядро ведёт статус каждой темы по машине состояний на основе пороговых правил | ✓ SATISFIED | `nextTopicStatus()` D-06 FSM; 9 dedicated unit tests, all transitions covered. |
| PROGRESS-03 | 02-01, 02-02 | При 2+ ошибках тема получает статус «Повторить», связанные задания добавляются в `reviewQueue` | ✓ SATISFIED | `enqueueReviewItems()` + FSM `entered_needs_review` signal wired through `evaluateAttempt`; integration test on real Lesson-1A confirms. |
| PROGRESS-04 | 02-03 | Ребёнок может пройти задания из `reviewQueue` в той же сессии | ✓ SATISFIED | Second-cursor review pass, dequeue-on-completion, full e2e traversal + DOM-level feedback test. |
| REWARD-01 | 02-02 | Ядро начисляет фиксированные суммы рублей по правилам с лимитами на упражнение | ✓ SATISFIED | `computeRewardEvents()` — fixed amounts, dedup, mutual exclusion, streak, mastery reward; 13 unit tests. |
| REWARD-02 | 02-02 | Ядро ведёт леджер начислений `rewardHistory` | ✓ SATISFIED | Every reward event carries `rewardEventId`/`reason`/`amount`/`attemptNumber`/`createdAt`; `currentRewards` is the summed balance. |

No orphaned requirements — all 6 phase requirement IDs (PROGRESS-01..04, REWARD-01/02) are declared across the 3 plans' frontmatter and match REQUIREMENTS.md's traceability table exactly (`Phase 2 | Pending` — note REQUIREMENTS.md's own checkboxes for these 6 items are still unchecked `[ ]` and its "Pending" status labels are stale; this is a documentation-sync gap in REQUIREMENTS.md itself, not a phase implementation gap — flagged below under Anti-Patterns/Notes, not a blocker to phase goal achievement since ROADMAP.md already marks Phase 2 complete).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md` | 33-36, 46-47, 125-133 | Checkboxes for PROGRESS-01..04/REWARD-01/02 still `[ ]` and traceability status still says "Pending" despite Phase 2 being complete and verified | ℹ️ Info | Documentation-sync issue only, not a code gap — does not block phase goal achievement. Recommend updating REQUIREMENTS.md checkboxes as part of phase closeout. |
| `src/core/rewards/rewardEngine.ts` | 39 | `fixed_mistake` reward reason defined with an amount but never emitted (intentionally collapsed into `correct_after_hint`) | ℹ️ Info | Explicitly documented in code comments, PLAN.md, and SUMMARY.md as a deliberate Phase 2 scope decision to avoid double-granting the same recovery situation; covered by an explicit regression test asserting it is never emitted. Not a stub — a reasoned, tested design choice with a clear rationale and no attempt to hide it. |

No blocker-level anti-patterns found. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any Phase 2 source file.

### Human Verification Required

None. This phase is logic-only (no UI polish, no agent, no external service) — every claimed truth is covered by automated unit and e2e tests, independently re-run by the verifier and confirmed passing (141/141 full suite, `tsc --noEmit` clean, working tree clean with all claimed commits present).

### Gaps Summary

No gaps found. All 4 roadmap Success Criteria and all plan-level must-haves are verified against the actual codebase (not just SUMMARY.md claims) at all three levels: exists, substantive (real logic, not stubs), and wired (imported, called, and covered by passing tests that exercise real behavior against the real `Lesson-1A.json` data, not synthetic/hollow fixtures alone). The two Info-level items above (REQUIREMENTS.md checkbox staleness, `fixed_mistake` intentional non-emission) are documentation/scope notes, not implementation gaps, and do not block phase goal achievement.

---

_Verified: 2026-07-02T15:53:24Z_
_Verifier: Claude (gsd-verifier)_
