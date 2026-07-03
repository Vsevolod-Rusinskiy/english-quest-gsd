---
phase: 04-progress-advisor-reward-advisor-parent-report
reviewed: 2026-07-03T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - src/core/agents/parentReportGenerator.ts
  - src/core/agents/parentReportGeneratorSchema.ts
  - src/core/agents/progressAdvisor.ts
  - src/core/agents/progressAdvisorSchema.ts
  - src/core/agents/rewardAdvisor.ts
  - src/core/agents/rewardAdvisorSchema.ts
  - src/core/lessonEngine.ts
  - src/core/personalization/confidenceScore.ts
  - src/core/personalization/difficultyGuardrails.ts
  - src/core/progress/evaluateAttempt.ts
  - src/core/state/initialState.ts
  - src/core/state/progressSchema.ts
  - src/core/state/store.ts
  - src/main.ts
  - src/ui/screens/SessionEndScreen.ts
  - tests/core/agents/parentReportGenerator.test.ts
  - tests/core/agents/progressAdvisor.test.ts
  - tests/core/agents/rewardAdvisor.test.ts
  - tests/core/lessonEngine.test.ts
  - tests/core/personalization/confidenceScore.test.ts
  - tests/core/personalization/difficultyGuardrails.test.ts
  - tests/core/progress/evaluateAttempt.test.ts
  - tests/core/state/persistence.test.ts
  - tests/core/state/progressSchema.test.ts
  - tests/core/state/store.test.ts
  - tests/e2e/fullLessonTraversal.test.ts
  - tests/e2e/lessonWalkingSkeleton.test.ts
  - tests/e2e/reviewPassFeedback.test.ts
  - tests/e2e/reviewQueuePass.test.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-07-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

This phase adds the last three agents (Progress Advisor, Reward Advisor, Parent Report Generator) as thin wrappers over the Phase-3 `callAgent()` gateway, plus the pure `confidenceScore`/`applyDifficultyGuardrails` functions and the `handleSessionEnd()` orchestrator that wires them all together.

The four items called out for special attention in the review brief all check out correctly:

1. **Reward Advisor cross-check gate (REWARD-03)** — `lessonEngine.ts:280-284` correctly filters `advisorResult.suggestedReasons` against `delta.rewardEvents` (the core's own granted reasons) before ever setting `praiseRu`, and additionally requires `source === "agent"`. An agent hallucinating an ungranted reason, or a pure-fallback response, both correctly resolve to `praiseRu: undefined`. Verified against `lessonEngine.test.ts`'s dedicated "cross-check gate" test.
2. **`difficultyMode` write path (PERSONAL-02)** — `applyDifficultyGuardrails()` is the only call site that produces a value assigned to `finalDifficulty`, which is the only value ever dispatched as `session_end.difficultyMode`. `store.ts`'s reducer only reads `action.difficultyMode`, never `advisorResult.suggestedDifficulty` directly. No raw-passthrough path exists.
3. **Sequential await, not a race** — `handleSessionEnd()` (`lessonEngine.ts:355-402`) does a single `await callProgressAdvisor(...)` before ever constructing the `callParentReportGenerator` input, and passes `advisorResult.recommendedFocus` (already resolved) as `recommendation`. `lessonEngine.test.ts`'s "D-07 (THE critical case)" test proves execution order (`progressAdvisor:start` → `progressAdvisor:end` → `parentReport:start`) with an artificial delay, which is a good regression guard against a future refactor accidentally introducing `Promise.all`.
4. **Never-fabricate discipline** — Reward Advisor and Parent Report Generator's fallbacks are fully mechanical (fixed empty/no-praise shape; deterministic Russian template interpolating exactly the 6 caller-supplied fields). Progress Advisor's fallback mostly follows this too (`suggestedDifficulty` = unchanged current mode, `recommendedFocus` = caller-supplied threshold value), with one exception flagged below (WR-01).

Beyond the four focus areas, I found a few real defects worth fixing (see WR-01..WR-04) and some maintainability nits (IN-01..IN-04). None are blockers — the architecture's core/agent boundary is intact and no path lets an agent write state directly or bypass a gate.

## Warnings

### WR-01: Progress Advisor's fallback fabricates a fixed motivational message instead of a neutral, input-derived one

**File:** `src/core/agents/progressAdvisor.ts:64`
**Issue:** The fallback object hardcodes `motivationalMessageRu: "Ты молодец, продолжай в том же духе!"` — a piece of agent-voice praise text that is not derived from any caller-supplied input. This is the one field in this phase's three fallback objects that doesn't follow the "re-serve caller-supplied data verbatim, never invent agent-style prose" discipline established by `theoryTutor.ts` (re-serves `fallbackLevel` text) and mirrored by Reward Advisor (`celebrationRu: undefined` on fallback) and Parent Report Generator (deterministic template built purely from the 6 input fields). It is low-risk in practice (a fixed, generic, always-true sentence), but it is architecturally inconsistent with the rest of the phase's explicit "never fabricate" framing, and if a future maintainer copies this pattern for a more specific/adaptive message, it would silently violate PERSONAL-03.
**Fix:** Either derive this string from a caller-supplied input (mirroring how `fallbackRecommendedFocus` works), or explicitly document in the file header why a single fixed, content-free motivational sentence is exempt from the "never fabricate" rule (since it carries no personalized claim, unlike a recommendation or report).
```typescript
// Option: accept a caller-supplied fallback message analogous to fallbackRecommendedFocus,
// OR add an explicit comment explaining why this literal is exempt:
// "Fixed, content-free encouragement — carries no personalized claim, so it does not
// violate PERSONAL-03's 'never fabricate a recommendation' rule."
```

### WR-02: `correctCount` in the parent report snapshot conflates "most recent attempt correct" with "session accuracy," understating the true correct-answer count

**File:** `src/core/lessonEngine.ts:385`
**Issue:** `correctCount = exerciseStatValues.filter((s) => s.lastAttemptCorrect).length` counts only exercises whose **most recent** attempt was correct. Per `progressSchema.ts`'s own CR-02 comment, `lastAttemptCorrect` is explicitly "the outcome of only the MOST RECENT attempt," distinct from the lifetime `correct` counter. This means the parent-facing report's "N заданий выполнено, M верно" line undercounts total correct attempts whenever any exercise was eventually answered correctly after an initial wrong attempt but a *later* attempt (e.g., a review-pass re-answer) happened to be wrong, or — more subtly — is simply not the same denominator a parent would intuitively expect ("how many were answered correctly" vs "how many are currently in a correct state"). For a typical session this usually coincides with the intuitive count, but it is not the same metric, and nothing in the code or tests documents that this is an intentional simplification vs an oversight.
**Fix:** Either sum `s.correct` across `exerciseStatValues` (true lifetime correct-attempt count) if that is the intended "correct count," or add a comment at this call site explaining that `lastAttemptCorrect` was deliberately chosen as a "final outcome" snapshot rather than a "total correct attempts" tally, so a future reader doesn't assume it's a bug-free proxy for the latter.
```typescript
// If "correct count" should mean "answered correctly at least once / currently correct":
const correctCount = exerciseStatValues.filter((s) => s.lastAttemptCorrect).length; // + a comment
// If it should mean "total correct attempts across the session":
const correctCount = exerciseStatValues.reduce((sum, s) => sum + s.correct, 0);
```

### WR-03: `RewardAdvisorResult.celebrationRu` cannot distinguish "agent explicitly said nothing" from "agent returned an empty string"

**File:** `src/core/agents/rewardAdvisor.ts:71-78`, `src/core/agents/rewardAdvisorSchema.ts:16`
**Issue:** `celebrationRu` is `z.string()` (required, non-optional) in the schema, so a real agent response with `celebrationRu: ""` passes validation and is returned as `source: "agent"` with `celebrationRu: ""`. In `lessonEngine.ts:282-284`, `praiseRu = advisorResult.celebrationRu` would then be set to the empty string whenever `trustedReasons.length > 0`, which is falsy-ish but not `undefined` — `SessionEndScreen`/`HandleAnswerResult` consumers checking `praiseRu ?? fallback` would treat `""` as "present" (since `??` only falls through on `null`/`undefined`), potentially rendering an empty celebration bubble. This is a real (if narrow) schema-shape gap: the wrapper's own comment at line 39-47 acknowledges the internal fallback's `celebrationRu: ""` is "purely to satisfy the schema shape internally," but the *agent's own* response is not guarded against the same degenerate value.
**Fix:** Add a runtime guard when mapping the agent-success branch, treating an empty/whitespace-only `celebrationRu` the same as "no praise":
```typescript
if (result.source === "agent") {
  return {
    suggestedReasons: result.data.suggestedReasons,
    celebrationRu: result.data.celebrationRu.trim().length > 0 ? result.data.celebrationRu : undefined,
    source: "agent",
  };
}
```

### WR-04: `strugglingTopics` in the parent report includes topics status `needs_review` regardless of session recency, potentially reporting a stale struggle from a much earlier session

**File:** `src/core/lessonEngine.ts:386-388`
**Issue:** `strugglingTopics` is computed as every topic in `state.topicStats` whose `status === "needs_review"`, with no bound on when that status was set. Per `topicStatusMachine.ts`'s own documented "any regression is a review signal" semantics (WR-03 comment there), a topic can remain `needs_review` indefinitely across many sessions if the FSM never re-crosses the mastery threshold. Combined with the fact that `topicStats` persists across sessions (this is cumulative state, not session-scoped), a parent report generated at the end of *this* session could list a topic as "struggling" purely because of errors accumulated in a *previous* session, with the child having answered nothing on that topic today. This isn't necessarily wrong product behavior, but nothing in the code/comments flags that `strugglingTopics`/`reviewTopics` are lifetime-cumulative rather than this-session-only, and a parent reading "Даётся сложнее: X" after a session where X was never touched could be confusing/misleading.
**Fix:** At minimum, document the intended scope (lifetime vs session) at this call site; if session-scoped is actually intended, track which topics were touched in the current session (e.g., via a session-start snapshot diff) and filter to those.

## Info

### IN-01: `applyDifficultyGuardrails`'s non-null assertion relies on `RANK`'s three keys never changing shape

**File:** `src/core/personalization/difficultyGuardrails.ts:60`, `68`
**Issue:** `(Object.keys(RANK) as DifficultyMode[]).find((mode) => RANK[mode] === nextRank)!` uses a non-null assertion. This is safe today because `RANK` is a fixed 3-entry map with contiguous ranks 0-2 and `nextRank` is always `currentRank ± 1` bounded by the same set, but the safety is implicit (not enforced by types) and would silently produce `undefined` cast to `DifficultyMode` if `RANK` or the difficulty enum were ever extended without updating this function in lockstep.
**Fix:** Replace with an explicit ordered array indexed by rank to remove the assertion entirely:
```typescript
const ORDER: DifficultyMode[] = ["easy", "normal", "challenge"];
// ...
return ORDER[nextRank];
```

### IN-02: `handleSessionEnd()` has grown to ~70 lines doing 9 distinct steps in one function

**File:** `src/core/lessonEngine.ts:332-427`
**Issue:** The function is well-commented with numbered steps but mixes fallback-focus computation, two sequential agent calls, a pure guardrail application, a pure confidence-score computation, and parent-report-snapshot assembly all in one method. This is a maintainability/readability concern (cyclomatic complexity is low since it's linear, but the function does a lot), not a correctness bug.
**Fix:** Consider extracting the "compute parent report snapshot fields" block (lines 384-390) and the "compute fallbackRecommendedFocus" block (lines 340-351) into small named helper functions/pure functions, so `handleSessionEnd()` reads as an orchestration of named steps rather than inline computation.

### IN-03: `ProgressAdvisorInput`/`RewardAdvisorInput` pass full `Record<string, ...>` stat maps to the agent with no size cap

**File:** `src/core/agents/progressAdvisor.ts:49-54`, `src/core/agents/rewardAdvisor.ts:50-55`
**Issue:** `topicStats`/`wordStats`/`exerciseTypeStats`/`rewardHistory` are serialized in full via `JSON.stringify` with no truncation. For this project's single fixed lesson (19 exercises, bounded word/topic counts) this is not a practical problem today, but there is no defensive cap if `rewardHistory` (which only ever grows) becomes large across many sessions, which could eventually push the request past reasonable token budgets. Out of scope for this phase's correctness review (performance is explicitly out of v1 scope per the review brief) but worth a forward-looking note since `rewardHistory` is unbounded, unlike the other per-session stat maps.
**Fix:** No action required now; consider a cap (e.g., last N reward events) if `rewardHistory` growth becomes a real concern in a later phase.

### IN-04: Magic numbers `0.05`/`0.1` in `confidenceScore.ts` are documented only in a comment, not named constants

**File:** `src/core/personalization/confidenceScore.ts:18-21`
**Issue:** The SPEC.md §12 formula coefficients (`0.05` per streak point, `0.1` per error) are inlined directly in the return expression. The file-header comment does state the formula, so this is a minor nit, but named constants would make the formula self-documenting at the call site and easier to grep/tune independently of the header comment staying in sync.
**Fix:**
```typescript
const STREAK_BONUS_PER_POINT = 0.05;
const ERROR_PENALTY_PER_POINT = 0.1;

export function computeConfidenceScore(inputs: ConfidenceInputs): number {
  const { correctRatio, streak, errorsInARow } = inputs;
  return clamp(
    correctRatio + STREAK_BONUS_PER_POINT * streak - ERROR_PENALTY_PER_POINT * errorsInARow,
    0,
    1,
  );
}
```

---

_Reviewed: 2026-07-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
