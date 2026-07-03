---
phase: 04-progress-advisor-reward-advisor-parent-report
plan: 03
subsystem: agents
tags: [zod, agent-gateway, state-schema, session-orchestration, ui, typescript, vitest]

# Dependency graph
requires:
  - phase: 03-agent-gateway-answer-checker-theory-tutor
    provides: callAgent() shared Agent Gateway (validate -> retry-once -> fallback), thin-wrapper agent pattern
  - phase: 04-02 (Progress Advisor state-schema foundation)
    provides: callProgressAdvisor(), applyDifficultyGuardrails(), computeConfidenceScore(), wordStats/exerciseTypeStats/currentErrorStreak
provides:
  - "Parent Report Generator agent (schema + thin callAgent() wrapper) — callParentReportGenerator()"
  - "LessonEngine.handleSessionEnd(): sequential Progress Advisor -> guardrails -> Parent Report orchestration, one session_end dispatch"
  - "session_end Action variant on StateStore, writing studentProfile.{confidenceScore, difficultyMode, lastRecommendedFocus, motivationSignals}"
  - "SessionEndScreen.ts — combined child recommendation + parent report render"
  - "main.ts 'Показать итоги' button replacing the bare 'Урок завершён!' message"
affects: [phase-5-ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin agent wrapper (schema.ts + wrapper.ts) mirroring theoryTutor.ts's shape, reused for a 5th and final agent"
    - "Sequential dependent async calls (Progress Advisor -> guardrails -> Parent Report Generator), never Promise.all, per D-07"
    - "Single-dispatch-per-user-event invariant extended to a new session_end action, distinct from exercise_attempt"
    - "Explicit user-tap trigger (Показать итоги button) for a derived (non-click-driven) terminal state, avoiding render-time auto-firing side effects (RESEARCH.md Pitfall 6)"

key-files:
  created:
    - src/core/agents/parentReportGeneratorSchema.ts
    - src/core/agents/parentReportGenerator.ts
    - src/ui/screens/SessionEndScreen.ts
    - tests/core/agents/parentReportGenerator.test.ts
  modified:
    - src/core/state/store.ts
    - src/core/lessonEngine.ts
    - src/main.ts
    - tests/core/lessonEngine.test.ts
    - tests/e2e/fullLessonTraversal.test.ts

key-decisions:
  - "motivationSignals derived at session_end reduce-time from the session's final currentCorrectStreak/currentErrorStreak counters ('streak' when >=3, 'errors_in_a_row' when >=2) — a simple string-tag list per Plan 02's A4 discretion grant"
  - "fallbackRecommendedFocus computed inline in handleSessionEnd() as the topicStats entry with the lowest correct/attempts ratio (or a fixed generic string when topicStats is empty), matching Progress Advisor's documented PERSONAL-03 fallback-input contract"
  - "correctCount for the Parent Report snapshot counts exerciseStats entries whose lastAttemptCorrect is true (most-recent-attempt semantics), not a lifetime sum, consistent with lastAttemptCorrect's existing 'most recent, not lifetime' convention (CR-02)"
  - "sessionEndResult held as an in-memory, non-persisted main.ts variable (mirrors currentExplanation's precedent) — only confidenceScore/difficultyMode/lastRecommendedFocus/motivationSignals are durable studentProfile fields"
  - "Fixed a plan-authored test premise inconsistent with Plan 02's already-tested guardrail contract: 'no correct-streak signal present' cannot produce difficultyMode 'normal' from 'easy' (the insufficient-signal case correctly stays at 'easy', per difficultyGuardrails.test.ts) — the test was corrected to use a MET upward gate (correctStreak>=3) to prove the two-step easy->challenge jump is still capped to one step, never landing on 'challenge' directly"

requirements-completed: [PERSONAL-01, PERSONAL-02, PERSONAL-03, REPORT-01, REPORT-02]

coverage:
  - id: D1
    description: "Parent Report Generator agent (schema + thin callAgent() wrapper) resolves parentReportRu/headlineRu on agent success; on agent failure or wrong-shape response, resolves to a fully deterministic Russian template interpolating all 6 snapshot fields (exercisesCompleted, correctCount, strugglingTopics, reviewTopics, rublesEarned, recommendation), never agent-authored text"
    requirement: "REPORT-01"
    verification:
      - kind: unit
        ref: "tests/core/agents/parentReportGenerator.test.ts#callParentReportGenerator (REPORT-01, REPORT-02, RELY-01, RELY-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Parent Report Generator's REPORT-02 fallback contains every one of the 6 input snapshot fields (verified via string-contains assertions on numeric/text fields), and a wrong-shape agent response is rejected by Zod into the identical template fallback (create called exactly twice, confirming the one-retry-then-fallback gateway contract)"
    requirement: "REPORT-02"
    verification:
      - kind: unit
        ref: "tests/core/agents/parentReportGenerator.test.ts#agent failure (both attempts, REPORT-02) -> resolves to a TEMPLATE report deterministically interpolating all 6 snapshot fields, source:'core'"
        status: pass
      - kind: unit
        ref: "tests/core/agents/parentReportGenerator.test.ts#a wrong-shape agent response (headlineRu missing) is rejected by Zod into the same template fallback; create called exactly twice"
        status: pass
    human_judgment: false
  - id: D3
    description: "handleSessionEnd() calls callProgressAdvisor() FIRST and only calls callParentReportGenerator() after that promise fully resolves, passing the FINAL (already-resolved) recommendedFocus as the recommendation argument — proven via a shared call-order array and direct argument inspection, not just a happens-before assumption"
    requirement: "PERSONAL-01"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#D-07 (THE critical case): callParentReportGenerator is invoked with recommendation equal to Progress Advisor's ALREADY-RESOLVED recommendedFocus, and only after callProgressAdvisor's promise resolved"
        status: pass
    human_judgment: false
  - id: D4
    description: "applyDifficultyGuardrails() is the ONLY code path that decides the session_end dispatch's difficultyMode — a two-step easy->challenge suggestion from Progress Advisor is capped to one step (normal) even when the upward gate is met, never landing on 'challenge' directly"
    requirement: "PERSONAL-02"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#PERSONAL-02 guardrail applied, not bypassed: ... resulting difficultyMode is capped to 'normal' ..., NEVER 'challenge' directly"
        status: pass
    human_judgment: false
  - id: D5
    description: "Progress Advisor unavailable (fallback-shaped, source:'core') still produces a valid, non-crashing recommendedFocus/difficultyMode decision written to studentProfile; Parent Report Generator unavailable (fallback-shaped, source:'core') still produces non-empty deterministic template report text — the session-end flow never stalls or crashes on either agent's unavailability"
    requirement: "PERSONAL-03"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#PERSONAL-03: Progress Advisor unavailable (fallback-shaped, source:'core') still produces a valid recommendedFocus/difficultyMode decision, and progressAdvisorFailed is recorded"
        status: pass
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#REPORT-02: Parent Report Generator unavailable (fallback-shaped, source:'core') -> deterministic template text is used and parentReportFailed is recorded"
        status: pass
    human_judgment: false
  - id: D6
    description: "handleSessionEnd() results in exactly ONE additional localStorage.setItem call (single-dispatch invariant, no separate/parallel dispatch path for session-end data); confidenceScore is computed via computeConfidenceScore() and lands in [0,1] on the persisted studentProfile"
    requirement: "PERSONAL-01"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#single dispatch invariant: handleSessionEnd() results in exactly ONE additional localStorage.setItem call"
        status: pass
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#confidenceScore computed and persisted: matches computeConfidenceScore()'s formula applied to the session's actual exerciseStats/streaks"
        status: pass
    human_judgment: false
  - id: D7
    description: "The bare 'Урок завершён!' message no longer appears at lesson-complete; an explicit 'Показать итоги' button appears instead, and a dedicated engine-level e2e test drives a full real-lesson traversal through handleSessionEnd(), asserting a valid confidenceScore/difficultyMode and non-empty parentReportRu/recommendedFocus"
    requirement: "REPORT-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/fullLessonTraversal.test.ts#completes all 19 real exercises ... (asserts 'Показать итоги' present, 'Урок завершён!' absent)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/fullLessonTraversal.test.ts#session-end (Plan 04-03): a completed session's handleSessionEnd() produces a valid confidenceScore/difficultyMode and non-empty parentReportRu/recommendedFocus"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-07-03
status: complete
---

# Phase 4 Plan 3: Parent Report Generator + Session-End Orchestration Summary

**Parent Report Generator (5th and final agent) built as a thin `callAgent()` wrapper with a fully deterministic 6-field template fallback; `LessonEngine.handleSessionEnd()` sequentially resolves Progress Advisor -> guardrails -> Parent Report Generator into ONE `session_end` dispatch; the bare "Урок завершён!" message is replaced by an explicit "Показать итоги" button leading to a combined `SessionEndScreen`.**

## Performance

- **Duration:** 35 min
- **Completed:** 2026-07-03
- **Tasks:** 3
- **Files modified:** 8 (4 created, 4 modified — plus this SUMMARY.md)

## Accomplishments

- `parentReportGeneratorSchema.ts` + `parentReportGenerator.ts` — the 5th and final agent, mirroring `theoryTutor.ts`'s thin-wrapper shape exactly. On agent failure (after one retry) or wrong-shape response, the fallback is a fully deterministic Russian template string interpolating all 6 snapshot fields (`exercisesCompleted`, `correctCount`, `strugglingTopics`, `reviewTopics`, `rublesEarned`, `recommendation`) — no agent-authored text, no randomness (REPORT-02).
- `LessonEngine.handleSessionEnd()` — the session-end orchestrator. Computes a core-decided `fallbackRecommendedFocus` (weakest topic by correct/attempts ratio), awaits `callProgressAdvisor()` FIRST, applies `applyDifficultyGuardrails()` as the sole writer of `difficultyMode`, computes `confidenceScore` via `computeConfidenceScore()`, builds the Parent Report snapshot from live state, and ONLY THEN awaits `callParentReportGenerator()` with the FINAL (guardrail-resolved) recommendation — never `Promise.all`, never the raw agent suggestion (D-06/D-07). Exactly one `session_end` dispatch folds every result.
- New `session_end` Action variant on `StateStore`: writes `studentProfile.{confidenceScore, difficultyMode, lastRecommendedFocus, motivationSignals}` in the reduce branch; `motivationSignals` is derived from the session's final streak counters (`"streak"` when `currentCorrectStreak >= 3`, `"errors_in_a_row"` when `currentErrorStreak >= 2`). Transient fields (`motivationalMessageRu`, `parentReportRu`, `headlineRu`) are carried on the action but never persisted into `ProgressStateSchema` — `handleSessionEnd()` returns them directly to its caller (mirrors `TheoryStepResult`'s established precedent).
- `SessionEndScreen.ts` — combined child-facing recommendation/motivational text + parent-facing report, built with `createElement`/`textContent` only (never `innerHTML`, matching every existing UI file's convention).
- `main.ts`'s lesson-complete `else` branch now shows an explicit "Показать итоги" button (instead of the bare "Урок завершён!" message) whose click handler follows the exact same unsubscribe/thinking-cue/resubscribe shape as `onSubmit`/`onUnderstoodChoice`, then renders `SessionEndScreen` with the transient result.
- `fullLessonTraversal.test.ts` extended: the existing traversal test's final assertion now checks for the "Показать итоги" button (not the removed message text), and a new engine-level e2e test drives a full real-lesson traversal through `handleSessionEnd()`, asserting a valid `confidenceScore`/`difficultyMode` and non-empty `parentReportRu`/`recommendedFocus`.

## Task Commits

Each task was committed atomically (TDD: test -> feat per task):

1. **Task 1: Parent Report Generator schema + thin agent wrapper**
   - `9f8f26b` test(04-03): add failing tests for Parent Report Generator agent wrapper
   - `e56a0e5` feat(04-03): implement Parent Report Generator schema + thin agent wrapper
2. **Task 2: LessonEngine.handleSessionEnd() orchestration**
   - `720857a` test(04-03): add failing tests for handleSessionEnd() orchestration
   - `963baf3` test(04-03): fix guardrail test to use a met upward gate (correctStreak>=3)
   - `21d6662` feat(04-03): implement handleSessionEnd() sequential orchestration
3. **Task 3: SessionEndScreen + main.ts wiring**
   - `8b48904` feat(04-03): add SessionEndScreen + wire main.ts session-end flow

_Note: Task 3 had no separate failing-test commit — the new e2e test and the button-vs-message assertion change were authored alongside the implementation and verified together against the full suite; Task 1 and Task 2 followed the strict RED -> GREEN cycle._

**Plan metadata:** (this commit, follows Self-Check)

## Files Created/Modified

- `src/core/agents/parentReportGeneratorSchema.ts` - `ParentReportGeneratorResponseSchema` per SPEC.md §8.4 (parentReportRu, headlineRu)
- `src/core/agents/parentReportGenerator.ts` - Thin `callAgent()` wrapper; REPORT-02 template fallback interpolating all 6 snapshot fields
- `src/core/state/store.ts` - New `session_end` Action variant + reduce branch writing `studentProfile`'s 4 durable fields, `motivationSignals` derivation
- `src/core/lessonEngine.ts` - `handleSessionEnd()`: sequential Progress Advisor -> guardrails -> Parent Report Generator orchestration, one dispatch, `SessionEndResult` transient return type
- `src/ui/screens/SessionEndScreen.ts` - Combined child + parent render, `createElement`/`textContent` only
- `src/main.ts` - "Показать итоги" button replacing the bare completion message; unsubscribe/thinking-cue/resubscribe handler around `engine.handleSessionEnd()`
- `tests/core/agents/parentReportGenerator.test.ts` - New test file (agent success, REPORT-02 fallback, wrong-shape rejection)
- `tests/core/lessonEngine.test.ts` - New `handleSessionEnd()` describe block (6 behavior cases)
- `tests/e2e/fullLessonTraversal.test.ts` - Updated final assertion + new engine-level session-end e2e test

## Decisions Made

- `motivationSignals` derived at `session_end` reduce-time from the session's final streak counters, not threaded through from `handleSessionEnd()` as a separate computed value — keeps the reducer the single place deriving this durable field from durable state, per the store's established "reduce branch computes deltas" convention.
- `fallbackRecommendedFocus` is computed inline in `lessonEngine.ts` (not a new module) — small, single-use session-aggregation logic, matching the plan's explicit guidance to keep it local rather than extracting a helper.
- `correctCount` for the Parent Report snapshot uses `lastAttemptCorrect` (most-recent-attempt semantics, matching `CR-02`'s established convention) rather than a lifetime `correct` sum, since the report is about "how did the final state of each exercise turn out," not a cumulative retry count.
- Fixed an inconsistency between the plan's literal Task 2 Test 2 wording ("no correct-streak signal present... resulting difficultyMode is normal") and Plan 02's already-tested, correct guardrail semantics (`difficultyGuardrails.test.ts`'s "insufficient signal, no other change" case, which correctly stays at `easy`). The test was corrected to use a MET upward gate (`correctStreak: 3`) so it actually proves the intended invariant — a two-step `easy->challenge` jump is capped to one step (`normal`), never bypassing the guardrail to land on `challenge` directly — without asserting an impossible combination.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a test assertion inconsistent with the already-implemented, already-tested guardrail contract**
- **Found during:** Task 2 (writing the PERSONAL-02 guardrail-applied test)
- **Issue:** The plan's literal test description asked to assert `difficultyMode` becomes `"normal"` when Progress Advisor suggests `"challenge"` from `"easy"` with "no correct-streak signal present." Plan 02's `applyDifficultyGuardrails()` (already implemented and unit-tested) correctly returns `current` (`"easy"`) unchanged when the upward gate isn't met — the described combination ("no signal" + result "normal") is impossible given the existing, correct guardrail semantics.
- **Fix:** Changed the test's `currentCorrectStreak` from `0` to `3` (gate met) so the assertion demonstrates the actually-intended invariant: a two-step jump is capped to one step even when the gate is satisfied, never landing on the agent's raw two-step suggestion.
- **Files modified:** `tests/core/lessonEngine.test.ts`
- **Commit:** `963baf3`

## Issues Encountered

None beyond the test-premise fix documented above.

## User Setup Required

None - no external service configuration required. Parent Report Generator reuses the same `@anthropic-ai/sdk`-backed `callAgent()` gateway and `.env` configuration already established in Phase 3.

## Next Phase Readiness

- All 5 of the project's agents (Answer Checker, Theory Tutor, Reward Advisor, Progress Advisor, Parent Report Generator) are now live, each a thin `callAgent()` wrapper with a mandatory deterministic fallback.
- The full session lifecycle (theory -> exercises -> review pass -> session-end) is wired end-to-end; `handleSessionEnd()`'s sequential orchestration and the combined `SessionEndScreen` complete Phase 4's PERSONAL-01/02/03 and REPORT-01/02 requirements.
- Phase 5 (Kid-Friendly Visual Design) can now proceed against a fully finalized state shape and screen set — `SessionEndScreen.ts` intentionally has no visual polish this phase (plain semantic structure only), which is explicitly Phase 5's scope.
- No blockers identified.

---
*Phase: 04-progress-advisor-reward-advisor-parent-report*
*Completed: 2026-07-03*

## Self-Check: PASSED

All created files verified present on disk; all 6 task commit hashes verified present in git log.
