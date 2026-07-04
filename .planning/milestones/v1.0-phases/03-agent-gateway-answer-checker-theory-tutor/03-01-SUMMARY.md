---
phase: 03-agent-gateway-answer-checker-theory-tutor
plan: 01
subsystem: api
tags: [anthropic-sdk, zod, agent-gateway, structured-outputs, strict-tool-use, vite-env]

# Dependency graph
requires:
  - phase: 02-progress-review-rewards
    provides: evaluateAttempt() delta computation, single-dispatch-per-action invariant, exerciseStats/topicStats schema conventions this plan extends additively
provides:
  - Shared Agent Gateway (callAgent) — validate -> retry-once -> fallback, DI-injectable client, no instanceof narrowing in catch
  - Anthropic SDK client wired to the third-party LLM router (dangerouslyAllowBrowser, D-03 scoped tradeoff)
  - Answer Checker agent (callAnswerChecker) — first live agent built on the gateway
  - Async LessonEngine.handleAnswer/handleTheoryStep, async main.ts submit with a thinking cue
  - RELY-03 source/agentFailed logging on exercise_attempt (lastAttemptSource/lastAttemptAgentFailed)
affects: [03-02 (Theory Tutor — reuses callAgent unchanged), phase-4 (Reward Advisor, Progress Advisor, Parent Report Generator all reuse callAgent)]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk@^0.109.0"]
  patterns:
    - "Agent Gateway: one shared callAgent<T>() function per RELY-01/02/03 — validate (Zod) -> retry-once (D-06) -> fallback, broad catch with no instanceof narrowing (router-shape drift resolves to fallback, never an uncaught exception)"
    - "One Zod schema drives both directions of an agent contract: z.toJSONSchema() for the tool's input_schema AND .safeParse() on the tool_use.input response (RELY-01 defense in depth even with strict:true)"
    - "DI-injectable client seam (AgentClient interface) on both callAgent and per-agent wrappers — tests stub { messages: { create: vi.fn() } }, never hit real network"
    - "Async conversion pattern: engine methods become async, main.ts wraps the unsubscribe/resubscribe window around an await, disables the submit button before the await and re-enables in a finally (thinking cue)"

key-files:
  created:
    - src/core/agents/anthropicClient.ts
    - src/core/agents/callAgent.ts
    - src/core/agents/answerCheckerSchema.ts
    - src/core/agents/answerChecker.ts
    - src/vite-env.d.ts
    - tests/core/agents/callAgent.test.ts
    - tests/core/agents/answerChecker.test.ts
  modified:
    - src/core/answer-checking/checkTextInput.ts
    - src/core/state/store.ts
    - src/core/state/progressSchema.ts
    - src/core/lessonEngine.ts
    - src/main.ts
    - tests/core/lessonEngine.test.ts
    - tests/core/state/store.test.ts
    - tests/core/progress/evaluateAttempt.test.ts
    - tests/core/progress/reviewQueue.test.ts
    - tests/e2e/fullLessonTraversal.test.ts
    - tests/e2e/lessonWalkingSkeleton.test.ts
    - tests/e2e/reviewPassFeedback.test.ts
    - tests/e2e/reviewQueuePass.test.ts

key-decisions:
  - "callAgent's client parameter is typed as a narrow AgentClient DI seam (not the real SDK's Anthropic type) — avoids overload-resolution mismatches between z.toJSONSchema()'s dynamic InputSchema and the SDK's strict typed surface, while still accepting the real anthropicClient via a single cast at the call site"
  - "source/agentFailed ride on ExerciseStatSchema as lastAttemptSource/lastAttemptAgentFailed (most-recent-only, mirrors the existing lastAttemptCorrect convention) rather than a new parallel log — satisfies RELY-03 without violating the single-dispatch-per-action invariant"
  - "Wrong-answer test scenarios pre-dating this plan (Phase 2 progress/reward wiring, review-pass cursor, reviewQueuePass e2e) now route through callAnswerChecker on every incorrect text-input answer — mocked via a module-level vi.spyOn returning a fast fallback-shaped result in beforeEach, so those suites stay offline and fast without being about Answer Checker's own behavior"

patterns-established:
  - "Pattern: agent wrapper thin-delegates to callAgent with a schema, tool name/description, system prompt, and a fallback shaped like the schema's T — then maps callAgent's {source,failed,data} union onto the caller's own public result type (CheckResult here), never leaking callAgent's generic union upward"
  - "Pattern: DOM 'thinking cue' for async submit handlers — find the submit button via a stable CSS convention (.submit-row button), disable before await, re-enable in finally, independent of which of the 4 exercise-type renderers built the DOM"

requirements-completed: [CHECK-03, CHECK-04, RELY-01, RELY-02, RELY-03]

coverage:
  - id: D1
    description: "Agent Gateway validates every agent response with Zod before trusting it, even though strict:true is set on the tool definition (RELY-01)"
    requirement: "RELY-01"
    verification:
      - kind: unit
        ref: "tests/core/agents/callAgent.test.ts#schema-valid JSON but wrong shape / wrong enum both attempts (Zod safeParse fails) -> returns fallback, calling create exactly twice"
        status: pass
    human_judgment: false
  - id: D2
    description: "Agent failure (timeout, network error, malformed JSON, or Zod-invalid shape) retries exactly once then falls back to a deterministic result — the lesson never crashes or stalls (RELY-02, CHECK-04)"
    requirement: "RELY-02"
    verification:
      - kind: unit
        ref: "tests/core/agents/callAgent.test.ts#stubbed client throws a timeout-like error both attempts -> returns fallback (no throw escapes), calling create exactly twice"
        status: pass
      - kind: unit
        ref: "tests/core/agents/answerChecker.test.ts#agent failure (both attempts) -> resolves to the fallback shape { isCorrect: false, errorType: 'unknown', source: 'core' } and does NOT throw"
        status: pass
    human_judgment: false
  - id: D3
    description: "A non-exact-match text-input answer calls Answer Checker and the child receives a verdict plus typed errorType (CHECK-03)"
    requirement: "CHECK-03"
    verification:
      - kind: unit
        ref: "tests/core/agents/answerChecker.test.ts#ambiguous answer + agent success -> resolves to a validated CheckResult with errorType in the 11-value enum, confidence in [0,1], and a hintRu string"
        status: pass
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#Plan 03: Answer Checker wiring (CHECK-03, D-10) > non-exact-match text-input answer calls callAnswerChecker and folds its errorType/source into evaluateAttempt + dispatch"
        status: pass
    human_judgment: false
  - id: D4
    description: "Only text-input triggers Answer Checker — single-choice, matching, order-builder stay fully deterministic with no agent call (D-10)"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#Plan 03: Answer Checker wiring (CHECK-03, D-10) > non-text-input types (single-choice, order-builder) never call the agent (D-10)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every exercise_attempt records source (core/agent) and an agentFailed flag (RELY-03)"
    requirement: "RELY-03"
    verification:
      - kind: unit
        ref: "tests/core/state/store.test.ts#RELY-03: dispatching exercise_attempt with source:'agent' and agentFailed:true records both on exerciseStats; source:'core' records source:'core', agentFailed:false"
        status: pass
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#Plan 03: Answer Checker wiring (CHECK-03, D-10) > Answer Checker fallback (agent failed) dispatches source:'core', agentFailed:true"
        status: pass
    human_judgment: false
  - id: D6
    description: "handleAnswer/main.ts submit path is fully async, with a thinking cue and the existing render-timing invariant preserved, and the full pre-existing test suite (all e2e + core) stays green after the sync->async conversion"
    verification:
      - kind: unit
        ref: "npm test (152 tests, 25 files, all green)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Manual smoke test: with a real .env populated, npm run dev, answering a text-input near-miss renders a real Answer Checker verdict end-to-end against the live router"
    verification: []
    human_judgment: true
    rationale: "Requires a live network call to api.llmrouter.ru with a real API key — cannot be automated in CI/test sandbox; documented as a manual, non-automated verification step in the plan's <verification> section"

# Metrics
duration: 20min
completed: 2026-07-02
status: complete
---

# Phase 3 Plan 1: Agent Gateway & Answer Checker Summary

**Shared `callAgent()` trust-boundary gateway (validate -> retry-once -> fallback) on `@anthropic-ai/sdk` against a third-party LLM router, with Answer Checker as the first live agent wired into an now-async `handleAnswer` pipeline.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-02T19:54:00Z
- **Completed:** 2026-07-02T20:10:16Z
- **Tasks:** 3
- **Files modified:** 21 (7 created, 14 modified)

## Accomplishments
- Built the single shared Agent Gateway (`callAgent<T>()`) that every one of the project's 5 agents will use: forced strict tool use, Zod `safeParse()` before trusting any response (even with `strict:true`), exactly one immediate retry on ANY failure class (transport error or Zod-invalid), broad catch with no `instanceof` narrowing so router-shape drift resolves to fallback instead of an uncaught exception
- Shipped Answer Checker as the first live agent on that gateway: an ambiguous (non-exact-match) `text-input` answer now gets a typed `errorType` (11-value SPEC §8.1 enum), `confidence`, and a Russian `hintRu`, with a fixed deterministic fallback (`errorType: "unknown"`) when the agent is unavailable
- Converted `LessonEngine.handleAnswer`/`handleTheoryStep` and `main.ts`'s submit closure to async, preserving the existing unsubscribe/resubscribe render-timing invariant and adding a "thinking" cue (submit button disabled during the in-flight call, re-enabled in a `finally`)
- Extended `exercise_attempt`/`ExerciseStatSchema` with `source`/`agentFailed` (RELY-03) riding on the same single-dispatch invariant Phase 1/2 established — no new action type, no second dispatch
- Fixed async-conversion fallout across the entire pre-existing test suite (4 e2e files + `lessonEngine.test.ts` + progress/reviewQueue fixtures) so the full suite (152 tests) stays green

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 — install SDK, env typing, failing gateway/answer-checker tests** - `0e12525` (test)
2. **Task 2: Agent Gateway + Answer Checker — validate -> retry-once -> fallback (GREEN)** - `3643038` (feat)
3. **Task 3: Wire Answer Checker into the lesson — async handleAnswer, RELY-03 logging, async main.ts** - `ca302b7` (feat)

_Note: Task 1/2 followed the plan's TDD gate (RED tests written and confirmed failing for the right reason in Task 1, then made GREEN in Task 2)._

## Files Created/Modified
- `src/core/agents/anthropicClient.ts` - Module-level Anthropic client against the router baseURL (D-03 scoped tradeoff documented inline)
- `src/core/agents/callAgent.ts` - Shared gateway: validate -> retry-once -> fallback, DI-injectable `AgentClient`
- `src/core/agents/answerCheckerSchema.ts` - `AnswerCheckerErrorTypeSchema` (11-value enum) + `AnswerCheckerResponseSchema`
- `src/core/agents/answerChecker.ts` - `callAnswerChecker()` thin wrapper mapping gateway results to `CheckResult`
- `src/vite-env.d.ts` - Typed `import.meta.env.VITE_LLM_BASE_URL` / `VITE_LLM_API_KEY`
- `src/core/answer-checking/checkTextInput.ts` - Extended `CheckResult` with `source:"core"|"agent"`, optional `errorType`/`confidence`/`hintRu`
- `src/core/state/store.ts` - `exercise_attempt` action gains `source`/`agentFailed`
- `src/core/state/progressSchema.ts` - `ExerciseStatSchema` gains `lastAttemptSource`/`lastAttemptAgentFailed`
- `src/core/lessonEngine.ts` - `handleAnswer`/`handleTheoryStep` now async; text-input branch awaits `callAnswerChecker` on exact-match failure
- `src/main.ts` - Async submit closure with thinking cue, surfaces agent `hintRu` into the feedback banner
- `tests/core/agents/callAgent.test.ts`, `tests/core/agents/answerChecker.test.ts` - New, DI-stubbed, offline
- `tests/core/lessonEngine.test.ts` - Async conversion + new Answer Checker wiring tests
- `tests/core/state/store.test.ts`, `tests/core/progress/evaluateAttempt.test.ts`, `tests/core/progress/reviewQueue.test.ts` - Schema-extension fixture fixes
- `tests/e2e/fullLessonTraversal.test.ts`, `tests/e2e/lessonWalkingSkeleton.test.ts`, `tests/e2e/reviewPassFeedback.test.ts`, `tests/e2e/reviewQueuePass.test.ts` - `vi.waitFor()` around post-submit DOM assertions, `callAnswerChecker` mocked where wrong answers are submitted

## Decisions Made
- `AgentClient`'s `create` method is typed with `params: any, options?: any` (narrow DI seam) rather than the real SDK's strict overloaded signature — avoids TypeScript overload-resolution failures between `z.toJSONSchema()`'s dynamically-shaped `InputSchema` and the SDK's typed `MessageCreateParams`; the real `anthropicClient` is cast to this interface once at the gateway's entry point, and the cast is documented as deliberate, not accidental
- `source`/`agentFailed` are recorded as "most recent attempt only" fields on `ExerciseStatSchema` (`lastAttemptSource`, `lastAttemptAgentFailed`), following the exact precedent of the pre-existing `lastAttemptCorrect` field, rather than introducing a new parallel event log — satisfies RELY-03 while preserving the single-dispatch-per-action invariant
- Pre-existing test scenarios that submit a deliberately wrong text-input answer (Phase 2's progress/reward and review-pass-cursor tests, the `reviewQueuePass` e2e suite) now transparently route through `callAnswerChecker` — rather than leaving them to hit the real network (which times out in the sandbox), a module-level `vi.spyOn(...).mockResolvedValue(fallback-shape)` was added in each affected `describe`'s `beforeEach`, keeping those suites fast, offline, and focused on what they were originally testing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Async-conversion test fallout beyond the plan's named files**
- **Found during:** Task 3
- **Issue:** Making `handleAnswer`/`handleTheoryStep` async and extending `ExerciseStatSchema` broke type-checking and caused test timeouts in files not explicitly named in Task 3's `<files>` list: `tests/core/progress/evaluateAttempt.test.ts` and `tests/core/progress/reviewQueue.test.ts` (hand-constructed `exerciseStats` fixtures missing the new required fields), and every pre-existing test that submits a wrong text-input answer without mocking `callAnswerChecker` (which now silently tries the real, unreachable network path, hitting Vitest's 5s test timeout)
- **Fix:** Added `lastAttemptSource`/`lastAttemptAgentFailed` to the affected fixture objects; added module-level `vi.spyOn(answerCheckerModule, "callAnswerChecker").mockResolvedValue(...)` in `lessonEngine.test.ts` and `reviewQueuePass.test.ts` `beforeEach` blocks
- **Files modified:** tests/core/progress/evaluateAttempt.test.ts, tests/core/progress/reviewQueue.test.ts, tests/core/lessonEngine.test.ts, tests/e2e/reviewQueuePass.test.ts, tests/e2e/reviewPassFeedback.test.ts
- **Verification:** `npm test` — 152/152 tests pass, no timeouts
- **Committed in:** ca302b7 (Task 3 commit)

**2. [Rule 1 - Bug] TypeScript overload-resolution failure between z.toJSONSchema() output and the Anthropic SDK's strict `messages.create` typing**
- **Found during:** Task 2
- **Issue:** Assigning the real `anthropicClient` (typed as the full SDK `Anthropic` instance) to `callAgent`'s generic client variable caused `.create()`'s overloaded signature to reject the dynamically-generated `input_schema` (from `z.toJSONSchema()`) and made `response.content.find(...)` ambiguous across the SDK's overloaded `find` signatures
- **Fix:** Introduced a narrow `AgentClient` DI interface (loosely-typed `create(params, options)`) that both the real client and test stubs are treated as; cast `anthropicClient` to `AgentClient` once at the point of use, documented inline as deliberate
- **Files modified:** src/core/agents/callAgent.ts
- **Verification:** `npx tsc --noEmit -p .` passes with zero errors
- **Committed in:** 3643038 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking test-timeout fallout, 1 blocking TypeScript overload bug)
**Impact on plan:** Both fixes were required for the plan's own stated verification gate ("Full existing suite stays green after the sync→async conversion") — no scope creep, no architectural changes.

## Issues Encountered
- ESLint could not run (`npx eslint src/core/agents/`) — the project has a legacy `.eslintrc.cjs` but ESLint 9 requires flat config (`eslint.config.js`). This is a pre-existing project configuration gap unrelated to this plan's files; out of scope per the deviation rules' scope boundary (no plan task touches ESLint config). Not blocking — `npx tsc --noEmit -p .` (the project's actual type-safety gate) passes clean.

## User Setup Required

None - `.env` with `VITE_LLM_BASE_URL`/`VITE_LLM_API_KEY` was already confirmed present and correctly named by the user before this plan executed (per discuss-phase D-03/D-04). No further manual configuration required for local `npm run dev`.

## Next Phase Readiness
- The Agent Gateway (`callAgent`) is fully general-purpose and ready for Plan 02 (Theory Tutor) and Phase 4's three remaining agents to reuse unchanged — no agent-specific logic leaked into the shared module
- `CheckResult`'s extended shape and the `exercise_attempt` action's `source`/`agentFailed` fields are stable contracts Plan 02 can build on directly
- D-03's scoped deployment tradeoff (`dangerouslyAllowBrowser: true`, key bundled at build time) remains local-dev/demo-only — `dist/` must not be deployed publicly without a proxy swap, unchanged from STATE.md's existing Blocker
- One manual, non-automated verification remains open per the plan's own `<verification>` section: with a real `.env` populated, `npm run dev` and a live text-input near-miss should render a genuine Answer Checker verdict against the router — not exercised in this automated session, flagged as `human_judgment: true` in the coverage block above for the verifier to route to UAT

---
*Phase: 03-agent-gateway-answer-checker-theory-tutor*
*Completed: 2026-07-02*

## Self-Check: PASSED

All created files verified present on disk; all 3 task commit hashes (0e12525, 3643038, ca302b7) verified present in git log.
