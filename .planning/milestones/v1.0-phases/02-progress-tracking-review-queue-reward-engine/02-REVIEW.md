---
phase: 02-progress-tracking-review-queue-reward-engine
reviewed: 2026-07-02T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/core/lessonEngine.ts
  - src/core/progress/evaluateAttempt.ts
  - src/core/progress/reviewQueue.ts
  - src/core/progress/topicStatusMachine.ts
  - src/core/rewards/rewardEngine.ts
  - src/core/state/initialState.ts
  - src/core/state/progressSchema.ts
  - src/core/state/store.ts
  - src/main.ts
  - src/ui/components/ProgressIndicator.ts
  - tests/core/lessonEngine.test.ts
  - tests/core/progress/evaluateAttempt.test.ts
  - tests/core/progress/reviewQueue.test.ts
  - tests/core/progress/topicStatusMachine.test.ts
  - tests/core/rewards/rewardEngine.test.ts
  - tests/core/state/persistence.test.ts
  - tests/core/state/progressSchema.test.ts
  - tests/core/state/store.test.ts
  - tests/e2e/reviewQueuePass.test.ts
  - tests/fixtures/multi-topic.fixture.json
  - tests/ui/components/ProgressIndicator.test.ts
findings:
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

The deterministic-core architecture (topic FSM, review queue, reward engine, single-dispatch fold) is well structured and the intent is clearly documented in comments referencing SPEC decisions (D-01 through D-06). Most edge cases called out in comments (Pitfall 2 topic-loop, Pitfall 3 single-save, Pitfall 4 no-array-mutation, Pitfall 5 exerciseId reuse) are genuinely handled correctly and are well covered by unit/e2e tests.

However, two correctness bugs were found that are not covered by the existing test suite and both stem from the same class of problem: single-value "did this transition happen" signals that silently drop information when more than one topic is affected by a single exercise. A UI feedback-visibility bug in the review pass was also found. Multiple design choices (unbounded `errors` counter, "closed weak topic" reward firing on topics that were never actually weak) are risky enough to call out even though they may be intentional per the SPEC's D-06 "single advance rule."

## Critical Issues

### CR-01: `masteredTransition` in `evaluateAttempt` silently drops a second simultaneous topic mastery

**File:** `src/core/progress/evaluateAttempt.ts:38-63`
**Issue:** `masteredTransition` is declared as a single nullable value (`{ topic: string } | null`), not a collection, but the topic loop can process multiple `topicImpact` entries per exercise (this is the exact scenario the `multi-topic.fixture.json` fixture and D-01/Pitfall 2 comments exist to cover). If a single correct answer causes **two** topics in `exercise.topicImpact` to independently cross the 3-correct-streak mastery threshold in the same call, only the last topic processed in the `for` loop is kept in `masteredTransition` — the first topic's `entered_mastered` signal is overwritten and silently discarded before `computeRewardEvents` ever sees it.

The result: `topicUpdates[topicA].status` is correctly persisted as `"mastered"` in `topicStats`, but no `weak_topic_closed` reward (+15) is ever granted for `topicA`, and because `nextTopicStatus`'s `entered_mastered` transition only fires on the `current !== "mastered"` edge, this reward can never be retroactively granted later — it is permanently lost. This is a real state/reward desync: the UI/progress data says "mastered" while the reward ledger — which is the only record a parent report or Reward Advisor agent would read — has no matching event.

This gap is untested: `evaluateAttempt.test.ts`'s only mastery test (`weak_topic_closed via aggregator`, line 99) drives a single-topic exercise to mastery; the multi-topic fixture is only exercised for the error-increment path (line 32-48), never for simultaneous dual-topic mastery.

**Fix:** Collect all mastered transitions in an array and emit one `weak_topic_closed` reward per topic:
```ts
const masteredTopics: string[] = [];
// ...
} else if (fsmResult.transition === "entered_mastered") {
  masteredTopics.push(topic);
}
// ...
const { rewardEvents, nextCorrectStreak } = computeRewardEvents({
  exerciseId: exercise.exerciseId,
  isCorrect,
  priorAttempts,
  rewardHistory: state.rewardHistory,
  currentCorrectStreak: state.currentCorrectStreak,
  masteredTopics, // plural, iterate and emit one event per topic in rewardEngine.ts
});
```
`computeRewardEvents`'s `masteredTransition: { topic: string } | null` input and its single `if (masteredTransition)` block in `rewardEngine.ts:95-99` need the equivalent change (loop over `masteredTopics` and call `makeEvent("weak_topic_closed", ...)` once per topic).

### CR-02: An exercise that was ever answered correctly can never re-enter the review queue, even after its topic regresses to `needs_review`

**File:** `src/core/progress/reviewQueue.ts:16`
**Issue:** `enqueueReviewItems` treats `(exerciseStats[ex.exerciseId]?.correct ?? 0) === 0` as the sole eligibility gate for "not yet resolved, should be queued." This is a cumulative, never-reset counter (`ExerciseStatSchema` only tracks `attempts`/`correct` totals — see `store.ts:64-73`, `correct` only ever increments). Since `topicStatusMachine.ts`'s `errors` counter also never resets (see WR-03 below) and CAN cause a topic to re-enter `needs_review` from `in_progress` after a single later wrong answer, the following sequence is reachable:

1. Exercise `ex-1` (topic `T`) is answered incorrectly twice → topic `T` becomes `needs_review`, `ex-1` and its siblings are enqueued.
2. `ex-1` is later answered correctly (in the review pass or main pass) → `exerciseStats["ex-1"].correct = 1`, topic `T` returns to `in_progress`.
3. Weeks/exercises later, `ex-1` (or another exercise touching topic `T`) is answered incorrectly again → topic `T`'s cumulative `errors` count crosses the threshold again → topic `T` transitions back to `needs_review` → `enqueueReviewItems(allExercises, "T", ...)` runs again.
4. `ex-1` is now permanently excluded from the eligible set (`correct` is `1`, never resets to `0`), even though it is the exercise that JUST failed. If every exercise touching topic `T` has previously been answered correctly even once, the review queue receives **zero** new entries despite the topic being flagged `needs_review` — the review mechanism silently does nothing.

This is untested: `reviewQueue.test.ts:42-52` ("excludes an exercise already answered correctly") only proves the intended one-directional exclusion; there is no test for the regression-after-correct scenario.

**Fix:** Eligibility should reflect "not correctly answered in the CURRENT needs_review episode," not "never correctly answered ever." At minimum, use the most recent attempt outcome rather than a lifetime `correct` counter, e.g. track `lastAttemptCorrect: boolean` per exercise, or reset the relevant `exerciseStats` entries when a topic re-enters `needs_review`:
```ts
.filter((ex) => !exerciseStats[ex.exerciseId]?.lastAttemptCorrect)
```
This requires extending `ExerciseStatSchema`/`ExerciseStat` with a `lastAttemptCorrect` field written by the `store.ts` reduce branch.

## Warnings

### WR-01: Duplicate topic names within a single exercise's `topicImpact` silently drop earlier increments

**File:** `src/core/progress/evaluateAttempt.ts:41-56`
**Issue:** The topic loop always reads `prev = state.topicStats[topic]` (the pre-dispatch snapshot), never the in-progress `topicUpdates` accumulator from earlier iterations of the same loop. If `exercise.topicImpact` contains the same topic twice (e.g., `["grammar_x", "grammar_x"]` — nothing in `lessonSchema.ts`'s `topicImpact: z.array(z.string())` forbids this), the second iteration overwrites `topicUpdates[topic]` with a value computed from the same stale `prev`, so the final delta reflects only `+1` attempt instead of `+2`, and any FSM transition computed on the first iteration is discarded in favor of the second (identical) computation. Low likelihood given current `Lesson-1A.json` content, but nothing in the schema or code guards against it, and a future lesson author could introduce this without any validation error.
**Fix:** Either de-duplicate `topicImpact` before the loop, or accumulate against `topicUpdates[topic] ?? prev` instead of always re-reading `state.topicStats[topic]`:
```ts
for (const topic of exercise.topicImpact) {
  const prev = topicUpdates[topic] ?? state.topicStats[topic] ?? DEFAULT_TOPIC_STAT;
  ...
}
```

### WR-02: Review-pass incorrect answers show no feedback banner before the DOM swaps to the next item

**File:** `src/main.ts:105-138`
**Issue:** For a review-pass answer, `result.isCorrect || inReviewPass` is always true (line 109), so `render(store.getState())` runs unconditionally — including when the answer was **incorrect**. That immediately swaps `main` to the next review exercise (dequeue-regardless-of-correctness already ran). The freshly computed `feedbackKey` on re-render is the id of the NEW current exercise, not the one just answered, so the banner-visibility check at line 132-135 (`feedback.exerciseId === feedbackKey || (feedback.isCorrect && !inReviewPass && ...)`) evaluates false in both branches for an incorrect review-pass answer: the ids don't match, and `feedback.isCorrect` is false so the OR-fallback also fails. The net effect is the child gets no visible "incorrect" feedback for a wrong review-pass answer — it silently jumps to the next question. This is inconsistent with the main-pass incorrect-answer behavior (line 111-121), which correctly preserves and shows the banner via the `else` branch, and inconsistent with the comment at line 105-108 which asserts the DOM "must be rebuilt" for review-pass answers without accounting for lost feedback visibility.
**Fix:** Either keep the review-pass exercise on screen briefly with the banner (mirroring the main-pass incorrect-answer path) before advancing, or explicitly render the feedback banner keyed by the just-answered exercise before/instead of tearing down to the next review item. At minimum this needs a design decision and a regression test — there is currently no test at all covering banner visibility for review-pass answers (correct or incorrect).

### WR-03: `errors` counter never resets, making `needs_review` re-entry overly aggressive after the first regression

**File:** `src/core/progress/topicStatusMachine.ts:31-36`, `src/core/progress/evaluateAttempt.ts:45`
**Issue:** `newErrors = prev.errors + (isCorrect ? 0 : 1)` accumulates for the lifetime of the topic and is never reset (not on entering `in_progress`, not on `mastered`, not ever). Once a topic has accumulated 2 total errors at any point in its history, `errorsAfterThisAttempt >= 2` in `nextTopicStatus` is permanently true for all future attempts. Combined with the check order (`if (!isCorrect && errorsAfterThisAttempt >= 2)` before the `needs_review -> in_progress` recovery branch), this means: after a topic has ever had 2 errors, a SINGLE isolated wrong answer at any later point — even after the topic reached `mastered` and the child has since answered many more questions correctly — immediately snaps the topic back to `needs_review`. This may be an intentional strict interpretation of "any regression is a review signal," but it is not called out anywhere in the D-06 comments, which only describe the "3 correct-in-a-row → mastered" advance rule and are silent on why errors are cumulative rather than windowed/decaying. Given this directly interacts with CR-02 above (a topic that easily re-enters `needs_review` combined with a review queue that can end up permanently empty for that topic), this compounds into a worse experience than either issue alone.
**Fix:** At minimum, document this as an intentional design choice in `topicStatusMachine.ts`'s header comment (it currently only documents pure-function guarantees, not the accumulation semantics). Consider whether `errors` should reset when a topic transitions to `mastered` or after a "cooldown" of N correct answers, matching the "review, not permanent scarlet letter" spirit implied by REWARD-01/02.

## Info

### IN-01: `weak_topic_closed` reward fires for topics that were never actually "weak"

**File:** `src/core/progress/topicStatusMachine.ts:22-27`
**Issue:** The mastery rule (`isCorrect && correctStreakAfterThisAttempt >= 3`) fires `entered_mastered` from ANY current status, including directly from `not_started` (3 correct-in-a-row on a topic's very first three attempts, with zero prior errors). `rewardEngine.ts`'s `weak_topic_closed` reason (+15, the largest single reward amount) and its doc comment ("weak_topic_closed +15 — fired directly off the FSM's entered_mastered signal") will therefore fire for a topic the child got right immediately, never struggled with, and which was never `needs_review`. The reward name/amount implies "you overcame a weak spot," which is misleading for this path. This is called out as an explicit, deliberate D-06 decision in the comments ("3 correct-in-a-row from ANY current status → mastered"), so it is not flagged as a bug, but the reward name and its large amount deserve a second look given it can be trivially farmed by a strong topic the child never struggled with.
**Fix:** Either rename the reward reason to something status-neutral (e.g. `topic_mastered`) or gate the `weak_topic_closed` amount specifically on transitions originating from `needs_review`, granting a smaller/different reward for `not_started`/`in_progress` → `mastered`.

### IN-02: `getCurrentExercise()` can return `null` while `isReviewPass()` still reports `true`, showing a premature "lesson complete" message

**File:** `src/core/lessonEngine.ts:37-64`
**Issue:** `getCurrentExerciseId()` returns `state.reviewQueue[0]` unconditionally when the queue is non-empty, without verifying that id still exists in `this.exercises`. `getCurrentExercise()` then does `this.exercises.find(...) ?? null`, which can be `null` even though `isReviewPass()` (queue length > 0) is `true`. `main.ts` uses `getCurrentExercise()` to decide whether to show the "Урок завершён!" message (line 139-158), so a stale/corrupted `reviewQueue` entry (e.g., from a manually edited or partially-migrated localStorage blob) would show the lesson-complete screen while `reviewQueue` is still non-empty, silently stranding the review pass. Low likelihood in normal operation since `reviewQueue` is only ever populated with real exerciseIds by `enqueueReviewItems`, but there is no defensive handling (e.g., skip-and-dequeue-invalid-ids) if this invariant is ever violated by a schema/lesson version mismatch.
**Fix:** Consider making `getCurrentExercise()` skip and self-heal past unknown ids (log + dequeue) rather than returning `null` and silently ending the lesson.

### IN-03: `crypto.randomUUID()` has no fallback

**File:** `src/core/rewards/rewardEngine.ts:51`
**Issue:** `makeEvent` calls `crypto.randomUUID()` directly with no feature check or fallback. This API requires a secure context (HTTPS or localhost) and is not available in all older/embedded WebViews. If unavailable, every reward-granting call throws, which — given `store.dispatch` has no try/catch around the reduce/evaluate pipeline — would propagate as an uncaught exception out of `handleAnswer`, breaking the lesson flow entirely (in tension with the project's stated "no single broken state, even if [X] unavailable" resilience goal, albeit that goal is specifically about LLM agents, not this).
**Fix:** Low priority given Vite's modern-browser target, but worth a defensive fallback (e.g., a small UUID polyfill or `Date.now()+Math.random()`-based id) if the deployed target needs to support non-secure-context or older WebView environments.

---

_Reviewed: 2026-07-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
