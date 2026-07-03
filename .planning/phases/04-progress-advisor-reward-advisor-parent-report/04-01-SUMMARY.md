---
phase: 04-progress-advisor-reward-advisor-parent-report
plan: 01
subsystem: agents
tags: [zod, agent-gateway, reward-engine, typescript, vitest]

# Dependency graph
requires:
  - phase: 03-agent-gateway-answer-checker-theory-tutor
    provides: callAgent() shared Agent Gateway (validate -> retry-once -> fallback), thin-wrapper agent pattern
  - phase: 02 (Progress/Review/Reward core)
    provides: computeRewardEvents()/rewardEngine.ts fixed-amount reward engine, evaluateAttempt() single-delta aggregator
provides:
  - Reward Advisor agent (schema + thin wrapper) reusing RewardReasonSchema, no duplicate enum
  - Live per-answer Reward Advisor call wired into LessonEngine.handleAnswer, gated on delta.rewardEvents.length > 0
  - Cross-check gate: agent's suggestedReasons filtered against delta.rewardEvents before praiseRu surfaces (REWARD-03)
  - handleAnswer's return type extended with transient praiseRu (never persisted, no new dispatch/action type)
affects: [04-02, 04-03, phase-5-ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin agent wrapper (schema.ts + wrapper.ts) mirroring answerChecker.ts's shape, reused for a 3rd agent"
    - "Core cross-check gate: agent proposes a suggestion, core intersects it against ground truth it already decided before trusting it (mirrors Answer Checker's confidence threshold, applied here as a Set intersection over reward reasons)"
    - "praiseRu as transient per-call return value (not dispatched/persisted) — same precedent as currentExplanation in main.ts"

key-files:
  created:
    - src/core/agents/rewardAdvisorSchema.ts
    - src/core/agents/rewardAdvisor.ts
    - tests/core/agents/rewardAdvisor.test.ts
  modified:
    - src/core/lessonEngine.ts
    - tests/core/lessonEngine.test.ts
    - tests/e2e/fullLessonTraversal.test.ts
    - tests/e2e/lessonWalkingSkeleton.test.ts
    - tests/e2e/reviewPassFeedback.test.ts
    - tests/e2e/reviewQueuePass.test.ts

key-decisions:
  - "praiseRu is returned directly from handleAnswer's resolved value, never dispatched through the store's exercise_attempt Action/reducer — no new schema field, no persistence, matching D-04/A3's transient-display-text framing"
  - "Cross-check gate discards any agent-suggested reason not present in delta.rewardEvents, treating it identically to an agent failure (praiseRu:undefined) — the core, not the agent, remains the sole source of truth for which rewards happened"

requirements-completed: [REWARD-03, REWARD-04]

coverage:
  - id: D1
    description: "Reward Advisor agent (schema + thin wrapper) proposes suggestedReasons/celebrationRu via the shared Agent Gateway, unfiltered internally"
    requirement: "REWARD-03"
    verification:
      - kind: unit
        ref: "tests/core/agents/rewardAdvisor.test.ts#agent success -> resolves to validated suggestedReasons/celebrationRu, source:'agent', unfiltered against rewardEvents"
        status: pass
      - kind: unit
        ref: "tests/core/agents/rewardAdvisor.test.ts#wrong-shape response ... is rejected by Zod into the same fallback shape; create called exactly twice"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reward Advisor unavailable (both attempts fail) resolves to the no-praise fallback shape, never throws"
    requirement: "REWARD-04"
    verification:
      - kind: unit
        ref: "tests/core/agents/rewardAdvisor.test.ts#agent failure (both attempts) -> resolves to {suggestedReasons: [], celebrationRu: undefined, source: 'core'}, never throws (REWARD-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "One Reward Advisor call per answer with reward events (never per event), no call when zero reward events fire"
    requirement: "REWARD-03"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#an answer producing multiple simultaneous reward events results in exactly ONE callRewardAdvisor call"
        status: pass
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#an answer producing zero reward events does NOT call callRewardAdvisor at all"
        status: pass
    human_judgment: false
  - id: D4
    description: "Core cross-check gate: agent-suggested reasons not present in this answer's actual rewardEvents are discarded (praiseRu undefined); a matching suggestion surfaces praiseRu"
    requirement: "REWARD-03"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#cross-check gate (REWARD-03): agent suggests a reason NOT present in this answer's actual rewardEvents -> resulting dispatch's praiseRu is undefined"
        status: pass
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#trusted match: agent suggests a reason that DOES match one of this answer's granted rewardEvents -> praiseRu equals the agent's celebrationRu"
        status: pass
    human_judgment: false
  - id: D5
    description: "Reward amounts/currentRewards/rewardHistory unaffected by Reward Advisor availability; single-dispatch invariant preserved (no new save()/action)"
    requirement: "REWARD-04"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#agent unavailable (REWARD-04): reward amounts/currentRewards total are unaffected, praiseRu is undefined"
        status: pass
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#single-dispatch invariant (Pitfall 3 precedent): an answer with reward events firing still results in exactly the same save() count as before this plan"
        status: pass
      - kind: e2e
        ref: "npm test (full suite, 27 files / 179 tests, including tests/e2e/*)"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-07-03
status: complete
---

# Phase 4 Plan 1: Reward Advisor Summary

**Reward Advisor agent (thin callAgent() wrapper reusing RewardReasonSchema) wired live into LessonEngine.handleAnswer, gated to one call per answer with a core-side cross-check that discards any praise text not matching an actually-granted reward reason.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-03T09:50:48+03:00
- **Completed:** 2026-07-03T10:00:46+03:00
- **Tasks:** 2
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments
- Reward Advisor schema + thin wrapper (`rewardAdvisorSchema.ts`, `rewardAdvisor.ts`) mirroring `answerChecker.ts`'s "propose, core validates" shape, reusing the existing `RewardReasonSchema` (no duplicate enum), never assigning `amount`
- Live per-answer wiring into `LessonEngine.handleAnswer`: exactly one call when `delta.rewardEvents.length > 0`, never per individual reward event (D-03)
- Core-side cross-check gate: agent's `suggestedReasons` intersected against `delta.rewardEvents` (the core's own already-decided grants) before `praiseRu` is ever surfaced — an ungranted suggestion is discarded identically to an agent failure (REWARD-03)
- `handleAnswer`'s return value extended with a transient `praiseRu` field (never dispatched through the reducer, never persisted to `ProgressStateSchema`) — no new action type, single-dispatch-per-answer invariant fully preserved
- REWARD-04 confirmed by test: reward amounts/`currentRewards`/`rewardHistory` are byte-identical to Phase 2's behavior regardless of Reward Advisor's availability

## Task Commits

Each task was committed atomically (TDD: test -> feat per task):

1. **Task 1: Reward Advisor schema + thin agent wrapper**
   - `ccc447a` test(04-01): add failing test for Reward Advisor agent wrapper
   - `e5c5cb6` feat(04-01): implement Reward Advisor schema + thin agent wrapper
2. **Task 2: Wire Reward Advisor into handleAnswer's single dispatch, cross-checking suggested reasons**
   - `ea45d01` test(04-01): add failing tests for Reward Advisor wiring in handleAnswer
   - `6a9c948` feat(04-01): wire Reward Advisor into handleAnswer's single dispatch

**Plan metadata:** (this commit, follows Self-Check)

_Note: both tasks followed the RED -> GREEN TDD cycle; no REFACTOR commits were needed._

## Files Created/Modified
- `src/core/agents/rewardAdvisorSchema.ts` - Zod contract (`suggestedReasons: RewardReason[]`, `celebrationRu: string`), reuses existing `RewardReasonSchema`
- `src/core/agents/rewardAdvisor.ts` - Thin `callAgent()` wrapper; unfiltered agent-success mapping, fixed no-praise fallback on failure
- `tests/core/agents/rewardAdvisor.test.ts` - 3 behavior cases: agent success, agent failure (fallback), wrong-shape rejection with exactly-2 retry assertion
- `src/core/lessonEngine.ts` - `handleAnswer` now awaits `callRewardAdvisor` (gated on reward events), cross-checks reasons, returns `{ ...result, praiseRu }`
- `tests/core/lessonEngine.test.ts` - New "Plan 04-01: Reward Advisor wiring" describe block, 6 behavior cases; default `rewardAdvisorSpy` stub added to shared `beforeEach`/`afterEach`
- `tests/e2e/fullLessonTraversal.test.ts`, `tests/e2e/lessonWalkingSkeleton.test.ts`, `tests/e2e/reviewPassFeedback.test.ts`, `tests/e2e/reviewQueuePass.test.ts` - Added `rewardAdvisorSpy` stubs (mirroring the existing `answerCheckerSpy`/`theoryTutorSpy` pattern) so these real-traversal e2e suites stay offline/fast

## Decisions Made
- `praiseRu` returned directly from `handleAnswer`'s resolved value rather than threaded through the store's `exercise_attempt` Action/reducer — avoids a schema change entirely (no `.optional()` field added to `ProgressStateSchema`), consistent with D-04/A3 treating agent display text as transient, mirroring `currentExplanation`'s precedent in `main.ts`
- Cross-check implemented as a `Set` intersection (`grantedReasons.has(r)`) rather than a confidence threshold (unlike Answer Checker) — appropriate because Reward Advisor's contract is a set-membership proposal, not a probabilistic confidence score

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stubbed `callRewardAdvisor` in 4 e2e test suites that drive real correct answers**
- **Found during:** Task 2 verification (`npm test`, full suite including e2e)
- **Issue:** `handleAnswer` now awaits a live Reward Advisor call on every answer producing a reward event — this is virtually every correct/first answer in the lesson. The 4 e2e suites (`fullLessonTraversal.test.ts`, `lessonWalkingSkeleton.test.ts`, `reviewPassFeedback.test.ts`, `reviewQueuePass.test.ts`) drive many real answers through a real `LessonEngine` without a `client` DI stub, so each one now triggered the real Agent Gateway's network path (or, in `reviewQueuePass.test.ts`, the default 8s-timeout x2 retry path), causing multiple tests to time out at the default 5000ms Vitest limit.
- **Fix:** Added a `vi.spyOn(rewardAdvisorModule, "callRewardAdvisor").mockResolvedValue({...no-praise fallback...})` to each affected suite's `beforeEach`, mirroring the exact existing pattern already used for `callAnswerChecker`/`callTheoryTutor` stubs in the same files.
- **Files modified:** `tests/e2e/fullLessonTraversal.test.ts`, `tests/e2e/lessonWalkingSkeleton.test.ts`, `tests/e2e/reviewPassFeedback.test.ts`, `tests/e2e/reviewQueuePass.test.ts`
- **Verification:** `npm test` green (27 files / 179 tests), run 3x consecutively with no flakiness
- **Committed in:** `6a9c948` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed a latent e2e wait-condition race exposed by the new async gap**
- **Found during:** Task 2 verification (`npm test`)
- **Issue:** After stubbing `callRewardAdvisor` (deviation 1 above), `fullLessonTraversal.test.ts` and `reviewPassFeedback.test.ts` still intermittently failed with the DOM showing a stale exercise index. Root cause: `handleAnswer` now has one more `await` hop before its dispatch, widening the window between `submitButton.click()` and the render actually reflecting the new exercise. These tests waited on `vi.waitFor(() => expect(root.textContent).toContain("Верно!"))` — a bare substring check that can pass on the PREVIOUS render's still-present "Верно!" banner before the current submit's dispatch has actually landed, since the banner text itself doesn't change between two consecutive correct answers.
- **Fix:** Replaced the bare "Верно!" substring wait with a wait on the persisted `currentExerciseIndex` in `localStorage` (via `PROGRESS_KEY`) — an authoritative signal that `handleAnswer`'s dispatch(es) for THIS submit actually completed — followed by a synchronous "Верно!" assertion once the index confirms the render settled.
- **Files modified:** `tests/e2e/fullLessonTraversal.test.ts`, `tests/e2e/reviewPassFeedback.test.ts`
- **Verification:** Both suites pass individually and as part of the full suite; full suite run 3x consecutively with zero failures
- **Committed in:** `6a9c948` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking test-infrastructure gap, 1 test-only race-condition bug). Both are entirely test-file changes required to keep the plan's own `npm test` verification step green after adding a live per-answer agent call — no production code beyond the planned `lessonEngine.ts` change was affected.
**Impact on plan:** Necessary and in-scope; no scope creep. No production behavior changed beyond what Task 2 specified.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None - no external service configuration required. Reward Advisor reuses the same `@anthropic-ai/sdk`-backed `callAgent()` gateway and `.env` configuration already established in Phase 3.

## Next Phase Readiness
- Reward Advisor is fully live and tested; `praiseRu` is available on `handleAnswer`'s resolved value for Phase 5's UI to eventually render into the feedback banner (not wired to the DOM yet, per this plan's explicit scope — only the data path was required)
- Plans 04-02 (Progress Advisor) and 04-03 (Parent Report Generator) can proceed independently — Reward Advisor has no dependency relationship with either
- No blockers identified

---
*Phase: 04-progress-advisor-reward-advisor-parent-report*
*Completed: 2026-07-03*

## Self-Check: PASSED

All created files verified present on disk; all 4 task commit hashes (`ccc447a`, `e5c5cb6`, `ea45d01`, `6a9c948`) verified present in git log.
