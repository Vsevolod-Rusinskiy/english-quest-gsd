---
phase: 01-deterministic-core-lesson-rendering-persistence
plan: 02
subsystem: core
tags: [typescript, vitest, zod, deterministic-checkers, answer-checking]

# Dependency graph
requires:
  - phase: 01-01
    provides: "lessonSchema.ts (ChoiceIdCheckSchema/OrderedTokensCheckSchema/PairIdsCheckSchema already defined), checkTextInput.ts CheckResult convention, real Lesson-1A.json"
provides:
  - "checkSingleChoice(exercise, selectedOptionId) — deterministic option-id equality checker"
  - "checkMatching(exercise, userPairs) — deterministic pair-id set-equality checker, verified against real ex019"
  - "checkOrderBuilder(exercise, sequence) — deterministic ordered-token equality checker"
  - "tests/fixtures/single-choice.fixture.json and order-builder.fixture.json — hand-authored, schema-valid fixtures closing Pitfall 1"
affects: [01-03, phase-2-progress-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Checker return-shape convention from Plan 01-01 reused verbatim: { isCorrect: boolean, source: 'core' }, imported as CheckResult type"
    - "checkMatching pair comparison via leftId->rightId Map equality (order-independent, size + per-key check), not array/JSON-string comparison"

key-files:
  created:
    - src/core/answer-checking/checkSingleChoice.ts
    - src/core/answer-checking/checkMatching.ts
    - src/core/answer-checking/checkOrderBuilder.ts
    - tests/fixtures/single-choice.fixture.json
    - tests/fixtures/order-builder.fixture.json
    - tests/core/answer-checking/checkSingleChoice.test.ts
    - tests/core/answer-checking/checkMatching.test.ts
    - tests/core/answer-checking/checkOrderBuilder.test.ts
  modified: []

key-decisions:
  - "Fixtures reuse the full BaseExerciseFields set from lessonSchema.ts (sourceRef, hint, targetWords, targetGrammar, topicImpact) rather than a minimal subset, so they exercise the real schema path identically to production lesson data, not a relaxed test-only shape"
  - "checkMatching normalizes both sides into a Map<leftId, rightId> and compares Map.size plus a per-key equality check — this single comparison naturally rejects wrong-pair, missing-pair, AND extra-pair cases without three separate code branches"

patterns-established: []

requirements-completed: [EXERCISE-02, EXERCISE-03, EXERCISE-04, CHECK-02]

coverage:
  - id: D1
    description: "single-choice answers are graded by deterministic option-id comparison, no agent call"
    requirement: "EXERCISE-02, CHECK-02"
    verification:
      - kind: unit
        ref: "tests/core/answer-checking/checkSingleChoice.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "matching answers are graded by deterministic pair-id set comparison against the real 8-pair ex019 exercise, no agent call"
    requirement: "EXERCISE-03, CHECK-02"
    verification:
      - kind: unit
        ref: "tests/core/answer-checking/checkMatching.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "order-builder answers are graded by deterministic ordered-token comparison, no agent call"
    requirement: "EXERCISE-04, CHECK-02"
    verification:
      - kind: unit
        ref: "tests/core/answer-checking/checkOrderBuilder.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "single-choice and order-builder fixtures (data-less exercise types) validate against their Zod schemas, closing Pitfall 1"
    verification:
      - kind: unit
        ref: "tests/core/answer-checking/checkSingleChoice.test.ts#single-choice.fixture.json validates against SingleChoiceExerciseSchema"
        status: pass
      - kind: unit
        ref: "tests/core/answer-checking/checkOrderBuilder.test.ts#order-builder.fixture.json validates against OrderBuilderExerciseSchema"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-07-02
status: complete
---

# Phase 1 Plan 02: Deterministic Answer-Checking for single-choice, matching, order-builder Summary

**Three pure deterministic checkers (option-id, pair-id-set, ordered-token equality) closing out CHECK-02 for all four exercise types, plus hand-authored Zod-valid fixtures for the two types Lesson-1A.json has zero real examples of.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-02T09:59:46Z
- **Completed:** 2026-07-02T10:05:13Z
- **Tasks:** 2 automated tasks complete
- **Files modified:** 8 (3 checkers + 2 fixtures + 3 test files)

## Accomplishments

- Closed Pitfall 1: hand-authored `single-choice.fixture.json` and `order-builder.fixture.json`, each carrying the full `BaseExerciseFields` set from Plan 01's schema, both verified to pass `SingleChoiceExerciseSchema.safeParse` / `OrderBuilderExerciseSchema.safeParse` in the test files themselves
- Implemented `checkSingleChoice` — pure `selectedOptionId === exercise.answerCheck.correctOptionId` equality, `source: "core"`
- Implemented `checkOrderBuilder` — pure `sequence.join(" ") === correctOrder.join(" ")` equality per RESEARCH.md Pattern 3, `source: "core"`
- Implemented `checkMatching` — pure `leftId->rightId` Map-equality comparison, verified against the **real** 8-pair `ex019` restaurant matching exercise from `Lesson-1A.json` (picture-1..8 → knife/fork/napkin/glass/prawns/fried-eggs/strawberries/salt-and-pepper), covering full-correct, swapped-pair, missing-pair, extra-pair, and shuffled-order-still-passes cases
- All three checkers follow the exact `{ isCorrect: boolean, source: "core" }` convention established by Plan 01's `checkTextInput`, importing `CheckResult` rather than redefining it
- Full test suite green: 47 tests across 11 files (up from 33/8 after Plan 01); `npx tsc --noEmit` clean; grep confirms zero `fetch`/`@anthropic` references anywhere in `src/core/answer-checking/`

## Task Commits

Each task was committed atomically (TDD RED→GREEN per task):

1. **Task 1: Hand-author fixtures + single-choice and order-builder checkers**
   - `2af0939` (test) — RED: fixtures + failing tests for both checkers
   - `1954cba` (feat) — GREEN: `checkSingleChoice.ts` + `checkOrderBuilder.ts` implemented
2. **Task 2: matching checker (pair-id set comparison against real ex019)**
   - `51313af` (test) — RED: failing test against real `ex019` from `Lesson-1A.json`
   - `f751d7c` (feat) — GREEN: `checkMatching.ts` implemented

**Plan metadata:** (this commit, created after this SUMMARY)

_Note: both tasks are `tdd="true"` and each produced its own RED→GREEN commit pair; no `refactor` commit was needed for either._

## Files Created/Modified

- `src/core/answer-checking/checkSingleChoice.ts` - deterministic single-choice option-id checker
- `src/core/answer-checking/checkMatching.ts` - deterministic matching pair-id-set checker
- `src/core/answer-checking/checkOrderBuilder.ts` - deterministic order-builder ordered-token checker
- `tests/fixtures/single-choice.fixture.json` - hand-authored, schema-valid single-choice exercise (Pitfall 1)
- `tests/fixtures/order-builder.fixture.json` - hand-authored, schema-valid order-builder exercise (Pitfall 1)
- `tests/core/answer-checking/checkSingleChoice.test.ts` - schema-validation + correct/incorrect/unrecognized-id cases
- `tests/core/answer-checking/checkMatching.test.ts` - real-ex019-backed correct/swapped/missing/extra/shuffled cases
- `tests/core/answer-checking/checkOrderBuilder.test.ts` - schema-validation + correct/wrong-order/missing-token/extra-token cases

## Decisions Made

- Fixtures were authored with the complete `BaseExerciseFields` set (not a minimal test-only subset) so they exercise the identical schema path production `Lesson-1A.json` content would — this is the concrete, testable answer to the plan's `[ASSUMED]` schema shapes from Plan 01/RESEARCH.md, not a shortcut around them
- `checkMatching` uses a single `Map`-based equality check (`size` match + per-key value match) rather than three separate branches for wrong/missing/extra-pair — this is simpler and structurally guarantees all three failure modes are caught by one code path, reducing the chance of an asymmetric bug (e.g., catching missing pairs but not extra ones)

## Deviations from Plan

None — plan executed exactly as written. Both checkers matched the `[ASSUMED]` schema shapes from Plan 01's `lessonSchema.ts` (`ChoiceIdCheckSchema`/`OrderedTokensCheckSchema`) exactly, so no schema corrections were needed this time (unlike Plan 01's `explanationLevels.level` deviation).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Zero agents, zero API keys, zero backend in Phase 1.

## Next Phase Readiness

- All four exercise types (`text-input`, `single-choice`, `matching`, `order-builder`) now have complete, tested, deterministic checkers under `src/core/answer-checking/` — CHECK-02 is fully satisfied at the core layer
- Plan 01-03 can now wire the three remaining exercise-type **renderers** (`single-choice`, `matching`, `order-builder` UI components) and connect `LessonEngine.handleAnswer`'s switch arms to these checkers, replacing the honest "not yet wired (Plan 03)" throws documented in `01-01-SUMMARY.md`'s Known Stubs section
- No new stubs introduced by this plan — it is core-only (no UI, no `LessonEngine` wiring), so `ExerciseScreen.ts`'s placeholder rendering and `lessonEngine.ts`'s throw-on-unimplemented-types remain exactly as Plan 01 left them, unchanged and still accurately documented as Plan 03's responsibility

## Known Stubs

None introduced by this plan. (Plan 01-01's pre-existing stubs — `ExerciseScreen.ts` placeholder rendering and `LessonEngine.handleAnswer`'s throw for `matching`/`single-choice`/`order-builder` — are unaffected; this plan only added core checker functions, no UI/engine wiring.)

## Threat Flags

None — this plan introduced zero new external-facing surface. All three checkers operate purely on already-Zod-validated exercise objects (validated at load in Plan 01) and produce a boolean verdict with no I/O, matching the plan's own `<threat_model>` disposition (T-01-05: accept, T-01-06: mitigate via strict deterministic comparison — verified by the incorrect-case test assertions in each checker's test file).

---
*Phase: 01-deterministic-core-lesson-rendering-persistence*
*Completed: 2026-07-02*
