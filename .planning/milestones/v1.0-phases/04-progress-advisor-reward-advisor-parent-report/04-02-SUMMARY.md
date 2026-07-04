---
phase: 04-progress-advisor-reward-advisor-parent-report
plan: 02
subsystem: agents
tags: [zod, agent-gateway, state-schema, personalization, typescript, vitest]

# Dependency graph
requires:
  - phase: 03-agent-gateway-answer-checker-theory-tutor
    provides: callAgent() shared Agent Gateway (validate -> retry-once -> fallback), thin-wrapper agent pattern
  - phase: 04-01 (Reward Advisor)
    provides: confirms the thin-wrapper + cross-check pattern generalizes to a 3rd new agent this phase
  - phase: 02 (Progress/Review/Reward core)
    provides: evaluateAttempt() single-delta aggregator, topicImpact per-topic loop precedent (D-01),
      topicStatusMachine.ts's pure-function/table-driven-test style
provides:
  - "wordStats/exerciseTypeStats/currentErrorStreak fields on ProgressStateSchema, seeded in initialState()"
  - "StudentProfileSchema extended with confidenceScore/difficultyMode/lastRecommendedFocus/motivationSignals"
  - "evaluateAttempt() extended to loop exercise.targetWords into wordUpdates (mirrors topicImpact loop) and to
    update exerciseTypeStats[exercise.type]; also computes nextErrorStreak"
  - "computeConfidenceScore() — SPEC.md §12's exact formula, pure, unit-tested with clamp boundaries"
  - "applyDifficultyGuardrails() — the ONLY function permitted to decide difficultyMode's next value (PERSONAL-02)"
  - "Progress Advisor agent (schema + thin callAgent() wrapper) — callProgressAdvisor()"
affects: [04-03, phase-5-ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sparse Record<string, Stat> convention extended to wordStats/exerciseTypeStats, matching topicStats exactly (RESEARCH.md Pitfall 5)"
    - "Session-global streak counter pattern (currentCorrectStreak) mirrored for the opposite direction (currentErrorStreak)"
    - "Pure guardrail/transition function (mirrors topicStatusMachine.ts's nextTopicStatus shape) as the sole writer of a state field, agent suggestion as one input only"
    - "Thin agent wrapper (schema.ts + wrapper.ts) mirroring theoryTutor.ts's shape, reused for a 4th agent"

key-files:
  created:
    - src/core/personalization/confidenceScore.ts
    - src/core/personalization/difficultyGuardrails.ts
    - src/core/agents/progressAdvisorSchema.ts
    - src/core/agents/progressAdvisor.ts
    - tests/core/personalization/confidenceScore.test.ts
    - tests/core/personalization/difficultyGuardrails.test.ts
    - tests/core/agents/progressAdvisor.test.ts
  modified:
    - src/core/state/progressSchema.ts
    - src/core/state/initialState.ts
    - src/core/progress/evaluateAttempt.ts
    - src/core/state/store.ts
    - src/core/lessonEngine.ts
    - tests/core/state/progressSchema.test.ts
    - tests/core/state/persistence.test.ts
    - tests/core/state/store.test.ts
    - tests/core/progress/evaluateAttempt.test.ts

key-decisions:
  - "wordStats/exerciseTypeStats are sparse Record<string, Stat> (matching topicStats), not fully-keyed by Exercise['type'] — per RESEARCH.md Pitfall 5's lower-risk recommendation"
  - "motivationSignals stored as a simple string-tag array (z.array(z.string())), not a richer structured object — per CONTEXT.md A4's explicit discretion grant"
  - "lastRecommendedFocus is a nullable string (short label, not prose) — null before any session-end recommendation exists"
  - "Two-step difficulty jump (easy<->challenge) advances ONE step toward the suggestion when the gate is met, rather than making no change at all — documented explicitly in difficultyGuardrails.ts's doc comment as the chosen interpretation of SPEC.md's 'no direct jump' rule"
  - "wordUpdates/exerciseTypeUpdates/nextErrorStreak fold into the EXISTING exercise_attempt dispatch (no new action type), preserving the single-dispatch-per-answer invariant established in Phase 1-3"

requirements-completed: [PERSONAL-01, PERSONAL-02, PERSONAL-03]

coverage:
  - id: D1
    description: "ProgressStateSchema extended with wordStats/exerciseTypeStats/currentErrorStreak and extended studentProfile fields, all required (no .optional()); legacy Phase-3-shaped blobs reset to initialState() on load rather than partially validating"
    requirement: "PERSONAL-01"
    verification:
      - kind: unit
        ref: "tests/core/state/progressSchema.test.ts#WordStatSchema/ExerciseTypeStatSchema/DifficultyModeSchema/StudentProfileSchema extensions"
        status: pass
      - kind: unit
        ref: "tests/core/state/persistence.test.ts#returns initialState() for a pre-Phase-4-shaped blob missing wordStats/exerciseTypeStats/currentErrorStreak/new studentProfile fields (RESEARCH.md Pitfall 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "evaluateAttempt() loops ALL exercise.targetWords entries (never targetWords[0] only) into a wordUpdates accumulator, verified against the REAL 8-word eq-1a-ex019 matching exercise and the REAL 1-word eq-1a-ex010 text-input exercise; also updates exerciseTypeStats[exercise.type] and computes nextErrorStreak"
    requirement: "PERSONAL-01"
    verification:
      - kind: unit
        ref: "tests/core/progress/evaluateAttempt.test.ts#Pitfall 4 (THE critical case): the real 8-word eq-1a-ex019 matching exercise updates wordUpdates for ALL 8 targetWords, never just targetWords[0]"
        status: pass
      - kind: unit
        ref: "tests/core/progress/evaluateAttempt.test.ts#evaluateAttempt wordStats, single-word case: the real 1-word eq-1a-ex010 exercise produces exactly one wordUpdates entry"
        status: pass
      - kind: unit
        ref: "tests/core/progress/evaluateAttempt.test.ts#evaluateAttempt exerciseTypeStats: a text-input exercise attempt increments exerciseTypeUpdates"
        status: pass
      - kind: unit
        ref: "tests/core/progress/evaluateAttempt.test.ts#accumulator-first-fallback-to-state discipline (D-12): a duplicate word within one exercise's targetWords accumulates both increments"
        status: pass
      - kind: unit
        ref: "tests/core/progress/evaluateAttempt.test.ts#evaluateAttempt returns nextErrorStreak: increments on incorrect, resets to 0 on correct"
        status: pass
    human_judgment: false
  - id: D3
    description: "computeConfidenceScore() implements SPEC.md §12's exact formula (clamp(correctRatio + 0.05*streak - 0.1*errorsInARow, 0, 1)), pure, table-driven tested with clamp-to-0 and clamp-to-1 boundary cases"
    requirement: "PERSONAL-01"
    verification:
      - kind: unit
        ref: "tests/core/personalization/confidenceScore.test.ts#computeConfidenceScore (SPEC.md §12 formula)"
        status: pass
    human_judgment: false
  - id: D4
    description: "applyDifficultyGuardrails() blocks every prohibited transition (two-step jumps in both directions, insufficient-signal one-step moves) and allows every permitted one (up on 3-correct-streak, down on 2-recent-errors); the agent's suggestion is NEVER returned verbatim without passing through the gate"
    requirement: "PERSONAL-02"
    verification:
      - kind: unit
        ref: "tests/core/personalization/difficultyGuardrails.test.ts#applyDifficultyGuardrails (PERSONAL-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Progress Advisor agent (schema + thin callAgent() wrapper) resolves recommendedFocus/suggestedDifficulty/reviewSuggestions/motivationalMessageRu/sessionAdvice on agent success; on agent failure or wrong-shape response, resolves to a fallback derived purely from caller-supplied threshold inputs (PERSONAL-03) with suggestedDifficulty equal to currentDifficultyMode unchanged; never imports or calls applyDifficultyGuardrails"
    requirement: "PERSONAL-03"
    verification:
      - kind: unit
        ref: "tests/core/agents/progressAdvisor.test.ts#callProgressAdvisor (PERSONAL-01, PERSONAL-03, RELY-01, RELY-02)"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-07-03
status: complete
---

# Phase 4 Plan 2: Progress Advisor State-Schema Foundation Summary

**wordStats/exerciseTypeStats/currentErrorStreak schema extension, confidenceScore + difficultyGuardrails pure functions, and a thin Progress Advisor agent wrapper — all built and tested in isolation, no session-end orchestration wiring yet (Plan 03's scope).**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-03T07:03:16Z (per STATE.md's prior session marker; this plan's own work started immediately after 04-01)
- **Completed:** 2026-07-03T07:12:45Z
- **Tasks:** 3
- **Files modified:** 16 (7 created, 9 modified)

## Accomplishments
- `ProgressStateSchema` extended with `wordStats`/`exerciseTypeStats`/`currentErrorStreak` (sparse records, matching `topicStats`'s established convention) and `StudentProfileSchema` extended with `confidenceScore`/`difficultyMode`/`lastRecommendedFocus`/`motivationSignals` — all required fields, no `.optional()`, so a legacy Phase-3-shaped blob resets to `initialState()` on load rather than partially validating
- `evaluateAttempt()` extended to loop `exercise.targetWords` into a `wordUpdates` accumulator using the EXACT accumulator-first-fallback-to-state discipline already proven for `topicImpact` (D-01/D-12) — verified against the REAL 8-word `eq-1a-ex019` matching exercise (all 8 words updated, never just `targetWords[0]`) and the REAL 1-word `eq-1a-ex010` text-input exercise
- `evaluateAttempt()` also updates `exerciseTypeStats[exercise.type]` and computes a new session-global `nextErrorStreak` (mirrors `nextCorrectStreak`'s exact shape/reset semantics but tracks consecutive incorrect answers) — both fold into the SAME existing `exercise_attempt` dispatch via `store.ts`'s extended Action, preserving the single-dispatch-per-answer invariant
- `computeConfidenceScore()` implements SPEC.md §12's exact formula (`clamp(correctRatio + 0.05*streak - 0.1*errorsInARow, 0, 1)`), pure, table-driven tested including clamp-to-0 and clamp-to-1 boundary cases
- `applyDifficultyGuardrails()` is the sole writer of `difficultyMode`'s next value (PERSONAL-02): blocks every two-step jump (`easy<->challenge`, capped to one step per call), gates upward movement on a 3-correct-streak and downward on 2-recent-errors, and returns `current` unchanged when the relevant gate isn't met — the agent's suggestion is never returned verbatim without passing through this gate
- Progress Advisor agent (`progressAdvisorSchema.ts` + `progressAdvisor.ts`) built as a thin `callAgent()` wrapper mirroring `theoryTutor.ts`'s shape: agent success resolves the validated recommendation; agent failure (after retry) resolves to a threshold-only fallback derived purely from caller-supplied inputs (PERSONAL-03), with `suggestedDifficulty` always equal to the caller's `currentDifficultyMode` so the guardrail function correctly no-ops on fallback; the wrapper never imports or calls `applyDifficultyGuardrails` itself, keeping the two concerns in separate modules

## Task Commits

Each task was committed atomically (TDD: test -> feat per task):

1. **Task 1: Extend ProgressStateSchema/initialState with wordStats, exerciseTypeStats, currentErrorStreak, studentProfile fields; extend evaluateAttempt's per-word/per-type loops**
   - `592ab1d` test(04-02): add failing tests for wordStats/exerciseTypeStats/currentErrorStreak schema extension
   - `205af02` feat(04-02): extend ProgressStateSchema with wordStats/exerciseTypeStats/currentErrorStreak/studentProfile fields
2. **Task 2: confidenceScore + difficultyGuardrails pure functions**
   - `2c8945f` test(04-02): add failing tests for confidenceScore + difficultyGuardrails pure functions
   - `4107b89` feat(04-02): implement confidenceScore + difficultyGuardrails pure functions
3. **Task 3: Progress Advisor schema + thin agent wrapper**
   - `922918e` test(04-02): add failing tests for Progress Advisor agent wrapper
   - `395cfe8` feat(04-02): implement Progress Advisor schema + thin agent wrapper

**Plan metadata:** (this commit, follows Self-Check)

_Note: all three tasks followed the RED -> GREEN TDD cycle; no REFACTOR commits were needed._

## Files Created/Modified
- `src/core/state/progressSchema.ts` - `WordStatSchema`/`ExerciseTypeStatSchema`/`DifficultyModeSchema` added; `StudentProfileSchema` extended; `ProgressStateSchema` extended with `wordStats`/`exerciseTypeStats`/`currentErrorStreak`
- `src/core/state/initialState.ts` - Seeds all new fields with sensible defaults
- `src/core/progress/evaluateAttempt.ts` - Extended `EvaluateAttemptResult` with `wordUpdates`/`exerciseTypeUpdates`/`nextErrorStreak`; new per-word loop mirroring the `topicImpact` loop exactly
- `src/core/state/store.ts` - `exercise_attempt` Action extended with `wordUpdates`/`exerciseTypeUpdates`/`nextErrorStreak`; `reduce()` branch spreads them into state
- `src/core/lessonEngine.ts` - `handleAnswer`'s dispatch call passes the new `evaluateAttempt` fields through
- `src/core/personalization/confidenceScore.ts` - SPEC.md §12's exact formula, pure
- `src/core/personalization/difficultyGuardrails.ts` - Sole writer of `difficultyMode`'s next value; exhaustive doc-comment on the two-step-jump interpretation
- `src/core/agents/progressAdvisorSchema.ts` - `ProgressAdvisorResponseSchema` per SPEC.md §8.2, reusing `DifficultyModeSchema`
- `src/core/agents/progressAdvisor.ts` - Thin `callAgent()` wrapper; threshold-only fallback (PERSONAL-03)
- `tests/core/state/progressSchema.test.ts`, `tests/core/state/persistence.test.ts`, `tests/core/state/store.test.ts`, `tests/core/progress/evaluateAttempt.test.ts` - Extended with new schema/persistence/aggregator test cases
- `tests/core/personalization/confidenceScore.test.ts`, `tests/core/personalization/difficultyGuardrails.test.ts`, `tests/core/agents/progressAdvisor.test.ts` - New test files

## Decisions Made
- `wordStats`/`exerciseTypeStats` are sparse `Record<string, Stat>` (matching `topicStats`'s established shape), not fully-keyed by `Exercise["type"]` — lower risk per RESEARCH.md Pitfall 5, requires zero change to `initialState()`'s seeding discipline
- `motivationSignals` is a simple `z.array(z.string())` tag array, not a richer structured object — per CONTEXT.md A4's explicit discretion grant, lowest-risk shape for this MVP scope
- `lastRecommendedFocus` is `z.string().nullable()` — a short topic/focus label, not prose, consistent with SPEC.md §12's field list not including report-text fields
- Two-step difficulty jumps (`easy<->challenge`) advance ONE step toward the suggestion when the relevant gate is met (not "no change at all") — documented explicitly in `difficultyGuardrails.ts`'s doc comment as the chosen interpretation of SPEC.md's "no direct jump" rule, since PERSONAL-02's guardrail runs once per session-end call (D-10) and a genuinely-warranted trend should be rate-limited, not silently discarded
- `wordUpdates`/`exerciseTypeUpdates`/`nextErrorStreak` fold into the EXISTING `exercise_attempt` dispatch rather than a new action type, preserving the single-dispatch-per-answer invariant established in Phase 1-3

## Deviations from Plan

None - plan executed exactly as written. All 3 tasks' behavior cases, verification commands, and done criteria were met without needing Rule 1-4 auto-fixes.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Progress Advisor reuses the same `@anthropic-ai/sdk`-backed `callAgent()` gateway and `.env` configuration already established in Phase 3.

## Next Phase Readiness
- `callProgressAdvisor()` and `applyDifficultyGuardrails()` are both fully built, tested, and ready for Plan 03 to consume in `LessonEngine.handleSessionEnd()`'s sequential Progress Advisor -> Parent Report Generator call chain
- `wordStats`/`exerciseTypeStats`/`currentErrorStreak` are live and accumulating on every `handleAnswer` call, ready to feed both Progress Advisor's input and the `confidenceScore` formula at session end
- No blockers identified; Plan 03 (Parent Report Generator + session-end orchestration) can proceed

---
*Phase: 04-progress-advisor-reward-advisor-parent-report*
*Completed: 2026-07-03*
