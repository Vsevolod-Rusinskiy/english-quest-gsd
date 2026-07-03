---
phase: 03-agent-gateway-answer-checker-theory-tutor
plan: 02
subsystem: api
tags: [theory-tutor, agent-gateway-reuse, zod, state-schema, async-ui]

# Dependency graph
requires:
  - phase: 03-agent-gateway-answer-checker-theory-tutor
    plan: 01
    provides: Shared Agent Gateway (callAgent) - validate -> retry-once -> fallback, DI-injectable client; async LessonEngine conversion pattern; async main.ts thinking-cue pattern
provides:
  - Theory Tutor agent (callTheoryTutor) - second live agent built on the unchanged Plan 01 gateway, proving genuine reusability
  - D-11 round-sequencing state machine in LessonEngine.handleTheoryStep (round 1 core-only, rounds 2-3 agent-backed, soft transition at maxSimplifyRounds)
  - simplifyRoundCount persisted in CurrentPositionSchema (survives reload mid-simplify-loop)
  - Round-aware TheoryScreen rendering agent/fallback/pre-written explanation text
  - Async main.ts theory handler with thinking cue, transient explanation text
affects: [phase-4 (Reward Advisor, Progress Advisor, Parent Report Generator all reuse callAgent unchanged)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second agent on the same gateway: callTheoryTutor mirrors callAnswerChecker's thin-wrapper shape exactly (schema, tool name/description, system prompt, fallback) - zero changes needed to callAgent.ts itself, proving D-05's shared-gateway design"
    - "Re-serve-not-fabricate fallback: Theory Tutor's fallback branch returns the caller-supplied fallbackLevel verbatim (never synthesizes new 'simpler' text) - the one Theory-Tutor-specific deviation from Answer Checker's fixed-shape fallback"
    - "Engine-computed reducer fields: theory_step's reduce case now writes engine-decided theoryUnderstood/simplifyRoundCount (not reducer-hardcoded), same additive-extension discipline as exercise_attempt's source/agentFailed in Plan 01"
    - "Transient vs. persisted split: simplifyRoundCount persists in state (survives reload); the actual explanation TEXT stays in-memory only in main.ts (mirrors the existing feedback variable pattern) - regenerating agent text on reload is acceptable per RESEARCH.md Open Question 2"

key-files:
  created:
    - src/core/agents/theoryTutorSchema.ts
    - src/core/agents/theoryTutor.ts
    - tests/core/agents/theoryTutor.test.ts
  modified:
    - src/core/state/progressSchema.ts
    - src/core/state/initialState.ts
    - src/core/state/store.ts
    - src/core/lessonEngine.ts
    - src/ui/screens/TheoryScreen.ts
    - src/main.ts
    - tests/core/state/progressSchema.test.ts
    - tests/core/lessonEngine.test.ts
    - tests/core/state/persistence.test.ts
    - tests/e2e/lessonWalkingSkeleton.test.ts
    - tests/e2e/fullLessonTraversal.test.ts
    - tests/e2e/reviewPassFeedback.test.ts
    - tests/e2e/reviewQueuePass.test.ts

key-decisions:
  - "handleTheoryStep's return type changed from Promise<void> to Promise<TheoryStepResult> ({ explanation }) so main.ts can render the round-appropriate agent/fallback text without persisting agent-authored copy in state - additive from the caller's perspective (only main.ts reads the new field, existing tests calling handleTheoryStep without inspecting the return value are unaffected)"
  - "theory_step action's theoryUnderstood/simplifyRoundCount fields are now engine-computed and dispatched explicitly rather than the reducer hardcoding theoryUnderstood:true - required because the Phase-1 stub's always-advance behavior is exactly what D-11 replaces"

patterns-established:
  - "A second, differently-shaped agent contract (explanationRu/exampleRu/level/canSimplifyMore vs. isCorrect/errorType/confidence/hintRu) proves callAgent<T>() is genuinely generic, not accidentally coupled to Answer Checker's shape - validates D-05 ahead of Phase 4's 3 remaining agents"

requirements-completed: [THEORY-03, RELY-01, RELY-02, RELY-03]

coverage:
  - id: D1
    description: "Tapping 'Не понятно' the first time shows the pre-written explanationLevels[1] with NO agent call (round 1 = core-only, D-11)"
    requirement: "THEORY-03"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#Plan 02: Theory Tutor round sequencing > round 1 (simplifyRoundCount 0 -> 1) > does NOT call the agent; count becomes 1; theoryUnderstood stays false"
        status: pass
      - kind: unit
        ref: "tests/e2e/lessonWalkingSkeleton.test.ts#Theory Tutor simplify loop > round 1 'Не понятно' shows the pre-written simple level, stays on theory, no agent call"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tapping 'Не понятно' a 2nd and 3rd time calls Theory Tutor via the shared gateway for a further-simplified explanation"
    requirement: "THEORY-03"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#round 2 (simplifyRoundCount 1 -> 2) > calls callTheoryTutor; count becomes 2 / round 3 (simplifyRoundCount 2 -> 3) > calls callTheoryTutor; soft transition"
        status: pass
      - kind: unit
        ref: "tests/e2e/lessonWalkingSkeleton.test.ts#rounds 2-3 call the (mocked) Theory Tutor and show its returned text, then soft-transition to the first exercise at the cap"
        status: pass
    human_judgment: false
  - id: D3
    description: "On Theory Tutor failure (after one retry) the fallback re-serves explanationLevels[1] - never fabricates new theory text"
    requirement: "RELY-02"
    verification:
      - kind: unit
        ref: "tests/core/agents/theoryTutor.test.ts#agent failure (both attempts) -> resolves to the fallback that re-serves the provided explanationLevels[1] text (NOT fabricated text), source:'core', does NOT throw"
        status: pass
      - kind: unit
        ref: "tests/core/agents/theoryTutor.test.ts#a wrong-shape agent response (missing explanationRu / wrong type) is rejected by Zod into the fallback"
        status: pass
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#agent-failure round (Theory Tutor fallback) > the round still counts, source:'core'/agentFailed:true, lesson never stalls"
        status: pass
    human_judgment: false
  - id: D4
    description: "Agent theory output validated by the shared Zod function before display (RELY-01) - same gateway as Answer Checker, zero changes to callAgent.ts"
    requirement: "RELY-01"
    verification:
      - kind: unit
        ref: "tests/core/agents/theoryTutor.test.ts#agent success -> resolves to a validated response with explanationRu (string), exampleRu (string), level, canSimplifyMore (boolean), source:'agent'"
        status: pass
    human_judgment: false
  - id: D5
    description: "After maxSimplifyRounds (3) total rounds the lesson soft-transitions to the first exercise regardless of the last answer"
    requirement: "THEORY-03"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#round 3 (simplifyRoundCount 2 -> 3, = maxSimplifyRounds) > soft transition sets theoryUnderstood true"
        status: pass
      - kind: unit
        ref: "tests/e2e/lessonWalkingSkeleton.test.ts#rounds 2-3 ... soft-transition to the first exercise at the cap"
        status: pass
    human_judgment: false
  - id: D6
    description: "Tapping 'Понятно' at any point exits immediately to practice, no agent call"
    requirement: "THEORY-03"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#'Понятно' at any round (e.g. mid-simplify at round 2) exits immediately, no agent call"
        status: pass
      - kind: unit
        ref: "tests/e2e/lessonWalkingSkeleton.test.ts#'Понятно' at any point renders the first exercise immediately"
        status: pass
    human_judgment: false
  - id: D7
    description: "simplifyRoundCount persists in state so a reload mid-simplify-loop does not silently reset the round to 1"
    requirement: "THEORY-03"
    verification:
      - kind: unit
        ref: "tests/core/state/progressSchema.test.ts#CurrentPositionSchema: simplifyRoundCount > accepts a currentPosition with simplifyRoundCount: 2 and round-trips it / rejects a currentPosition missing simplifyRoundCount"
        status: pass
    human_judgment: false
  - id: D8
    description: "Every theory-step agent-call event records source ('core'/'agent') and a failure flag (RELY-03)"
    requirement: "RELY-03"
    verification:
      - kind: unit
        ref: "src/core/state/store.ts theory_step action extended additively with source/agentFailed, engine-computed and dispatched per call"
        status: pass
    human_judgment: false
  - id: D9
    description: "Full existing test suite (all e2e + core) stays green after the theory-loop and async-conversion fallout"
    verification:
      - kind: unit
        ref: "npm test (166 tests, 26 files, all green)"
        status: pass
    human_judgment: false
  - id: D10
    description: "Manual smoke test: with a real .env populated, npm run dev, tapping 'Не понятно' 2-3 times renders a real Theory Tutor explanation"
    verification: []
    human_judgment: true
    rationale: "Requires a live network call to api.llmrouter.ru with a real API key - cannot be automated in CI/test sandbox; documented as a manual, non-automated verification step in the plan's <verification> section"

# Metrics
duration: 22min
completed: 2026-07-03
status: complete
---

# Phase 3 Plan 2: Theory Tutor Summary

**Second live agent (Theory Tutor) built on the unchanged Plan 01 gateway - a confused child tapping "Не понятно" now gets round 1 pre-written simplification, rounds 2-3 an agent-generated explanation, and a soft transition to practice at the 3-round cap, with the round count durably persisted and the fallback always re-serving (never fabricating) theory text.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-03T04:24:00Z
- **Completed:** 2026-07-03T04:46:18Z
- **Tasks:** 3
- **Files modified:** 16 (3 created, 13 modified)

## Accomplishments
- Added `TheoryTutorResponseSchema` + `callTheoryTutor()` thin wrapper on top of the exact same `callAgent<T>()` gateway Plan 01 built - zero changes to `callAgent.ts` itself, proving the shared-gateway design (D-05) generalizes to a second, differently-shaped agent contract
- Implemented D-11's full round-sequencing state machine in `LessonEngine.handleTheoryStep`: round 1 is core-only (no agent call, pre-written `explanationLevels[1]`), rounds 2-3 await `callTheoryTutor` via the gateway, and reaching `maxSimplifyRounds` (3) soft-transitions to practice regardless of the last answer
- Added required `simplifyRoundCount` to `CurrentPositionSchema` (resets via `load()` like `reviewPassIndex` if missing from a legacy blob) so a page reload mid-simplify-loop does not silently reset the round back to 1
- Extended `theory_step` to carry engine-computed `theoryUnderstood`/`simplifyRoundCount`/`source`/`agentFailed` - replacing the Phase 1 stub's reducer-hardcoded `theoryUnderstood: true`
- Wired the whole loop end-to-end through the UI: round-aware `TheoryScreen` (renders agent/fallback/pre-written text via `createElement`/`textContent`, no `innerHTML`) and an async `main.ts` theory handler with a thinking cue (both theory buttons disabled during in-flight agent rounds)
- Fixed async-conversion fallout across 3 pre-existing e2e test files whose "Понятно" click needed an awaited settle before continuing their traversal

## Task Commits

Each task was committed atomically:

1. **Task 1: simplifyRoundCount schema field + Theory Tutor schema/wrapper (RED->GREEN)** - `990d13d` (test)
2. **Task 2: D-11 round sequencing in async handleTheoryStep + theory_step action + source/failure logging (GREEN)** - `f7acf93` (feat)
3. **Task 3: Round-aware TheoryScreen + async main.ts theory handler with thinking cue** - `8e68c39` (feat)

_Note: Task 1 followed the plan's TDD gate (RED tests written and confirmed failing for the right reason before implementation), then Tasks 2-3 made the round-sequencing and UI wiring GREEN incrementally._

## Files Created/Modified
- `src/core/agents/theoryTutorSchema.ts` - `TheoryTutorResponseSchema` (explanationRu/exampleRu/level/canSimplifyMore)
- `src/core/agents/theoryTutor.ts` - `callTheoryTutor()` thin wrapper; re-serves fallbackLevel verbatim on agent failure, never fabricates
- `src/core/state/progressSchema.ts` - `CurrentPositionSchema` gains required `simplifyRoundCount`
- `src/core/state/initialState.ts` - seeds `simplifyRoundCount: 0`
- `src/core/state/store.ts` - `theory_step` action extended with `simplifyRoundCount`/`source`/`agentFailed`; reduce writes engine-decided values
- `src/core/lessonEngine.ts` - `handleTheoryStep` implements D-11's full round sequencing, returns `{ explanation }`
- `src/ui/screens/TheoryScreen.ts` - `TheoryScreenOptions` gains `currentExplanation`, renders round-aware text
- `src/main.ts` - async `onUnderstoodChoice` with thinking cue + transient explanation text
- `tests/core/agents/theoryTutor.test.ts` - new, DI-stubbed, offline (success/fallback/wrong-shape cases)
- `tests/core/state/progressSchema.test.ts` - `simplifyRoundCount` required-field and round-trip cases
- `tests/core/lessonEngine.test.ts` - round-sequencing coverage replacing the Phase-1-stub theory assertions
- `tests/core/state/persistence.test.ts` - fixture fixes for the extended `theory_step` action shape
- `tests/e2e/lessonWalkingSkeleton.test.ts` - full DOM-driven theory loop (round 1 -> rounds 2-3 -> soft transition) + "Понятно" exit
- `tests/e2e/fullLessonTraversal.test.ts`, `tests/e2e/reviewPassFeedback.test.ts` - awaited settle after the "Понятно" click before continuing
- `tests/e2e/reviewQueuePass.test.ts` - fixture fix for the new required `simplifyRoundCount` field

## Decisions Made
- `handleTheoryStep`'s return type changed from `Promise<void>` to `Promise<TheoryStepResult>` (`{ explanation }`) so `main.ts` can render the round-appropriate agent/fallback text without persisting agent-authored copy in state - additive change, existing callers that don't inspect the return value are unaffected
- `theory_step`'s `theoryUnderstood`/`simplifyRoundCount` fields are now engine-computed and dispatched explicitly (the reducer honors them) rather than the reducer hardcoding `theoryUnderstood: true` - required because D-11 fundamentally replaces the Phase 1 stub's always-advance behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Async-conversion test fallout beyond the plan's named files**
- **Found during:** Task 3
- **Issue:** Making `onUnderstoodChoice` async (awaiting `handleTheoryStep`) broke 3 pre-existing e2e tests not explicitly named in Task 3's `<files>` list: `tests/e2e/fullLessonTraversal.test.ts` and `tests/e2e/reviewPassFeedback.test.ts` clicked "Понятно" and asserted the next screen synchronously, and `tests/e2e/lessonWalkingSkeleton.test.ts`'s two Task-1-era tests had the same issue. A separate nested-`describe` test-isolation bug also surfaced: the new "Theory Tutor simplify loop" describe block's `vi.spyOn` on `callTheoryTutor` had no matching `mockRestore()`, leaking mock call-history state into the next test in file order.
- **Fix:** Added `await vi.waitFor(() => expect(root.textContent).toContain(...))` after each "Понятно" click before continuing; added the missing `afterEach(() => theoryTutorSpy.mockRestore())` in the new nested describe.
- **Files modified:** tests/e2e/lessonWalkingSkeleton.test.ts, tests/e2e/fullLessonTraversal.test.ts, tests/e2e/reviewPassFeedback.test.ts
- **Verification:** `npm test` - 166/166 tests pass, no order-dependent failures
- **Committed in:** 8e68c39 (Task 3 commit)

**2. [Rule 3 - Blocking] Required simplifyRoundCount field broke existing typed currentPosition fixtures**
- **Found during:** Task 1
- **Issue:** Adding `simplifyRoundCount` as a required (non-optional) field to `CurrentPositionSchema`/`CurrentPosition` broke TypeScript compilation for every pre-existing test that constructs a `currentPosition` object literal without it: `tests/core/lessonEngine.test.ts`, `tests/core/state/persistence.test.ts`, `tests/e2e/reviewQueuePass.test.ts`.
- **Fix:** Added `simplifyRoundCount: 0` to each affected fixture literal.
- **Files modified:** tests/core/lessonEngine.test.ts, tests/core/state/persistence.test.ts, tests/e2e/reviewQueuePass.test.ts
- **Verification:** `npx tsc --noEmit -p .` passes with zero errors
- **Committed in:** 990d13d (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking test/typecheck fallout from the schema extension and async conversion, no architectural changes, no scope creep)
**Impact on plan:** Both fixes were required for the plan's own stated verification gate ("Full suite green"). No deviation altered the D-11 round-sequencing design or the gateway's shape.

## Issues Encountered
None beyond the documented deviations above. ESLint's pre-existing flat-config gap (noted in 03-01-SUMMARY.md) remains unrelated to this plan's files and was not re-investigated.

## User Setup Required
None - reuses the same `.env` (`VITE_LLM_BASE_URL`/`VITE_LLM_API_KEY`) Plan 01 already confirmed present and correctly named. No further manual configuration required for local `npm run dev`.

## Next Phase Readiness
- Both Phase 3 agents (Answer Checker, Theory Tutor) are now live on the identical `callAgent()` gateway with zero gateway-level changes between them - strong evidence Phase 4's 3 remaining agents (Reward Advisor, Progress Advisor, Parent Report Generator) can reuse it unchanged
- `simplifyRoundCount` and the extended `theory_step` action are stable contracts; the transient/persisted split (round count persists, explanation text stays in-memory) is now an established pattern any future phase can follow for similar agent-generated content
- One manual, non-automated verification remains open per the plan's own `<verification>` section: with a real `.env` populated, `npm run dev` and tapping "Не понятно" 2-3 times should render a genuine Theory Tutor explanation against the router - not exercised in this automated session, flagged as `human_judgment: true` in the coverage block above for the verifier to route to UAT
- Phase 3 is now fully complete (both plans done) - ready for `/gsd-verify-work` or phase transition

---
*Phase: 03-agent-gateway-answer-checker-theory-tutor*
*Completed: 2026-07-03*

## Self-Check: PASSED

All created files verified present on disk; all 3 task commit hashes (990d13d, f7acf93, 8e68c39) verified present in git log.
