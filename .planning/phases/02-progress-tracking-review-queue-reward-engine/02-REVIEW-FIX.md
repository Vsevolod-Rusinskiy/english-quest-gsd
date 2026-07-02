---
phase: 02-progress-tracking-review-queue-reward-engine
fixed_at: 2026-07-02T12:47:25Z
review_path: .planning/phases/02-progress-tracking-review-queue-reward-engine/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-07-02T12:47:25Z
**Source review:** .planning/phases/02-progress-tracking-review-queue-reward-engine/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (2 critical, 3 warning — Info findings excluded per `fix_scope: critical_warning`)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: `masteredTransition` in `evaluateAttempt` silently drops a second simultaneous topic mastery

**Files modified:** `src/core/progress/evaluateAttempt.ts`, `src/core/rewards/rewardEngine.ts`, `tests/core/progress/evaluateAttempt.test.ts`, `tests/core/rewards/rewardEngine.test.ts`
**Commit:** `1969ffb`
**Applied fix:** Replaced the single nullable `masteredTransition: { topic: string } | null` with a `masteredTopics: string[]` array collected across the full topic loop in `evaluateAttempt.ts`, and threaded it through `computeRewardEvents`'s input contract in `rewardEngine.ts`. The `weak_topic_closed` reward-emission block now loops over `masteredTopics` and emits one event per topic instead of acting on a single overwritten value. Updated all existing tests referencing the old `masteredTransition` field name to the new `masteredTopics` array shape, and added two new regression tests: one exercising `computeRewardEvents` directly with two simultaneously mastered topics, and one driving `evaluateAttempt` through three consecutive correct answers on the real `multi-topic.fixture.json` exercise (two topics in `topicImpact`) to prove both topics reach `mastered` and both get their own `weak_topic_closed` reward event.

### CR-02: An exercise that was ever answered correctly can never re-enter the review queue

**Files modified:** `src/core/state/progressSchema.ts`, `src/core/state/store.ts`, `src/core/progress/reviewQueue.ts`, `tests/core/progress/evaluateAttempt.test.ts`, `tests/core/progress/reviewQueue.test.ts`, `tests/core/state/store.test.ts`
**Commit:** `94353e5`
**Applied fix:** Added a required `lastAttemptCorrect: boolean` field to `ExerciseStatSchema`, written every dispatch in `store.ts`'s `exercise_attempt` reduce branch (overwritten, not accumulated, on every attempt). `enqueueReviewItems` in `reviewQueue.ts` now filters on `!exerciseStats[id]?.lastAttemptCorrect` instead of the lifetime `correct` counter, so eligibility reflects "not resolved in the current needs_review episode" rather than "never correctly answered ever." Updated all `ExerciseStat` object literals across the affected test files to include the new required field, and added two new regression tests to `reviewQueue.test.ts` covering both the exclusion case (last attempt correct despite a lower lifetime count) and the exact regression-after-correct scenario described in the finding (lifetime `correct: 1` but `lastAttemptCorrect: false` — exercise must be eligible again).

### WR-01: Duplicate topic names within a single exercise's `topicImpact` silently drop earlier increments

**Files modified:** `src/core/progress/evaluateAttempt.ts`, `tests/core/progress/evaluateAttempt.test.ts`
**Commit:** `f429220`
**Applied fix:** Changed the topic loop in `evaluateAttempt.ts` to read `topicUpdates[topic] ?? state.topicStats[topic] ?? DEFAULT_TOPIC_STAT` instead of always re-reading the pre-dispatch `state.topicStats[topic]` snapshot, so a duplicate topic within one exercise's `topicImpact` accumulates against the in-progress delta rather than recomputing from stale state and discarding the first iteration's increment/transition. Added a `duplicateTopicExercise` fixture (`topicImpact: ["grammar_x", "grammar_x"]`) and a regression test proving both increments land (`attempts: 2`, `errors: 2`) on a single incorrect answer.

### WR-02: Review-pass incorrect answers show no feedback banner before the DOM swaps to the next item

**Files modified:** `src/main.ts`, `tests/e2e/reviewPassFeedback.test.ts` (new)
**Commit:** `67ef900`
**Applied fix:** The `onSubmit` handler in `main.ts` previously ran `render(store.getState())` unconditionally whenever `result.isCorrect || inReviewPass` was true — meaning any review-pass answer, correct or not, immediately tore the DOM down to the next review item, and the freshly-rendered next item's `feedbackKey` never matched the just-answered exercise's id, so the incorrect banner never appeared. Restructured into three explicit branches: main-pass correct (rebuilds, unchanged), review-pass correct (still auto-advances immediately, unchanged behavior), and review-pass incorrect (NEW: keeps the current exercise's DOM in place, shows the feedback banner in place exactly like the main-pass incorrect branch, and appends an explicit "Продолжить" button that triggers the deferred `render()` only on click). The underlying store dispatch still dequeues the item unconditionally per D-02 — only the DOM swap/render timing changed, not the deterministic core's dequeue-regardless-of-correctness contract. Added a new e2e test (`tests/e2e/reviewPassFeedback.test.ts`) that drives the real app through the DOM (theory → main sequence → review pass), answers the first review item incorrectly, and asserts the "Не совсем" banner is visible and a "Продолжить" button is present before the DOM advances, then confirms clicking it moves to the next item.

### WR-03: `errors` counter never resets, making `needs_review` re-entry overly aggressive after the first regression

**Files modified:** `src/core/progress/topicStatusMachine.ts`
**Commit:** `3badc85`
**Applied fix:** Documentation-only fix per the review's "at minimum" recommendation — no logic change. Added a detailed comment block to `topicStatusMachine.ts`'s module header explicitly documenting that the `errors` counter accumulates for the topic's entire lifetime (never reset on `in_progress`, `mastered`, or any other transition), the resulting behavior (a single isolated wrong answer long after mastery can immediately snap a topic back to `needs_review` once it has ever accumulated 2 errors), and that this is a deliberate "any regression is a review signal" interpretation rather than a bug — flagging that a windowed/decaying/reset-on-mastery model would be a separate, explicit product decision. This finding's actual behavior fix (should `errors` reset on mastery or use a cooldown window?) requires a product/design decision beyond this fixer's scope, consistent with the review's own framing ("this may be an intentional design choice... consider whether errors should reset").

---

## Notes on Verification

No `node_modules` was present in the repository at fix time, so Tier 2 syntax checking (`tsc --noEmit`) was unavailable for all TypeScript changes in this session. All fixes were verified via Tier 1 (careful re-read of the modified file sections, confirming fix text present, surrounding code intact, and no dangling references to renamed/removed identifiers via `grep` sweeps across `src/` and `tests/`) per the verification_strategy's documented fallback for missing tooling. Given the review's own finding descriptions cite specific test gaps, new regression tests were added alongside each fix (except WR-03, which is documentation-only) to cover the exact scenario described in each finding — these should be run via `npm install && npm test` to confirm before merging, since this fixer could not execute them directly.

None of the 5 in-scope findings are logic-error classifications from the review requiring the `"fixed: requires human verification"` status — CR-01/CR-02/WR-01 are collection/accumulation bugs with clear correct behavior, WR-02 is a UI/DOM sequencing bug, and WR-03 is documentation-only. All are marked `fixed` in this report, but running the actual test suite (`npm test`) is still strongly recommended before this branch is merged, since it could not be executed in this environment.

---

_Fixed: 2026-07-02T12:47:25Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
