---
phase: 03-agent-gateway-answer-checker-theory-tutor
reviewed: 2026-07-03T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - src/core/agents/answerChecker.ts
  - src/core/agents/answerCheckerSchema.ts
  - src/core/agents/anthropicClient.ts
  - src/core/agents/callAgent.ts
  - src/core/agents/theoryTutor.ts
  - src/core/agents/theoryTutorSchema.ts
  - src/core/answer-checking/checkTextInput.ts
  - src/core/lessonEngine.ts
  - src/core/state/initialState.ts
  - src/core/state/progressSchema.ts
  - src/core/state/store.ts
  - src/main.ts
  - src/ui/screens/TheoryScreen.ts
  - src/vite-env.d.ts
  - tests/core/agents/answerChecker.test.ts
  - tests/core/agents/callAgent.test.ts
  - tests/core/agents/theoryTutor.test.ts
  - tests/core/lessonEngine.test.ts
  - tests/core/progress/evaluateAttempt.test.ts
  - tests/core/progress/reviewQueue.test.ts
  - tests/core/state/persistence.test.ts
  - tests/core/state/progressSchema.test.ts
  - tests/core/state/store.test.ts
  - tests/e2e/fullLessonTraversal.test.ts
  - tests/e2e/lessonWalkingSkeleton.test.ts
  - tests/e2e/reviewPassFeedback.test.ts
  - tests/e2e/reviewQueuePass.test.ts
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-07-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

This phase wires an Agent Gateway (`callAgent`) plus two thin agent wrappers (Answer Checker, Theory Tutor) into the deterministic lesson engine, with a validate → retry-once → fallback contract enforced by Zod. The core architecture is sound and the fallback discipline (never fabricate, always resolve to a fixed shape) is followed correctly in the two happy/unhappy paths that are tested. However, several defects undermine the "must never leave the lesson broken" guarantee the phase is built around:

- The Agent Gateway silently returns wrong/attacker-influenced data when the model returns multiple `tool_use` blocks, and it can throw an unhandled `TypeError` (crashing `handleAnswer`/`handleTheoryStep`, and by extension the click handler) if the model omits a `tool_use` block entirely in a way the current code doesn't fully guard.
- `callAnswerChecker`'s "isCorrect: true from the agent" path is not defensively bounded against the agent overriding a determinstically-wrong answer with no core-side sanity check, which is a direct violation of the "agent proposes, core writes" boundary described in the CLAUDE.md architecture doc and the file's own comments.
- The retry-once logic in `callAgent` performs the two attempts fully sequentially with no test coverage of latency/timeout budget, and worse, the two attempts are indistinguishable from a security standpoint: a malformed tool_use on attempt 1 is silently retried with the exact same untrusted user content, so there is no additional validation improvement on retry beyond re-asking the same question — acceptable per spec, but the timeout math (2 x 8s = 16s asserted in comments) is never actually asserted in code or tests, so a regression that changes `TIMEOUT_MS` silently invalidates the comment's claim.

Additionally, there's a real type-safety hole (`TheoryScreen.onUnderstoodChoice` declared as returning `void` but invoked as an async function in `main.ts`, discarding a promise silently) and a swallowed-error condition in the gateway's retry catch blocks that could mask legitimate bugs (e.g., programming errors inside `attempt()` that have nothing to do with the network) as "fall back to core," making some classes of bugs invisible in production.

## Critical Issues

### CR-01: `callAgent` picks the first `tool_use` block without validating there's exactly one, allowing a spoofed/duplicated block to silently override the trusted one

**File:** `src/core/agents/callAgent.ts:96`
**Issue:** `response.content.find((b) => b.type === "tool_use")` takes the *first* matching content block. The Anthropic API can, in principle (and definitely in a hand-rolled test stub or a future model behavior change), return multiple content blocks, including multiple `tool_use` blocks in one response (parallel tool use is default-on per the Claude API surface). If Claude — or a malformed/malicious proxy sitting behind `VITE_LLM_BASE_URL` (this app explicitly documents shipping the API key client-side and calling a router, per `anthropicClient.ts`'s own comments) — returns two `tool_use` blocks, only the first is validated and used; nothing detects or rejects the ambiguous-response case. Since the child's raw answer is forwarded to this same untrusted network hop (see `answerChecker.ts` comment about "untrusted DATA"), a compromised or misbehaving router response containing multiple tool_use blocks (e.g., one legitimate + one injected) is accepted without any additional scrutiny beyond schema shape — which a spoofed block can also satisfy.
**Fix:**
```ts
const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
if (toolUseBlocks.length !== 1) {
  throw new Error(
    `Agent response contained ${toolUseBlocks.length} tool_use blocks, expected exactly 1`,
  );
}
const parsed = opts.schema.safeParse(toolUseBlocks[0].input);
```

### CR-02: `callAnswerChecker` lets the agent unconditionally override a deterministic incorrect verdict to `isCorrect: true` with no core-side bound, violating the "agent proposes, core decides" architecture

**File:** `src/core/agents/answerChecker.ts:60-67`
**Issue:** The project's own architecture constraint (CLAUDE.md: "числа и запись состояния только у ядра, агент предлагает суждение/текст, никогда не пишет числа напрямую" — "numbers and state writes belong only to the core; the agent proposes judgment/text, never writes numbers directly") requires the deterministic core to own all state-affecting decisions. Here, `result.data.isCorrect` from the LLM response is passed straight through as the final verdict with zero validation against the exercise's `correctAnswers`/`acceptedAnswers` — e.g. there's no check like "if isCorrect is true, does childAnswer fuzzy-match something plausible" or a confidence floor gate (`confidence >= X`). A hallucinating or adversarially-prompted agent (the child's raw text is untrusted input forwarded into the same call) can mark any wrong answer "correct" outright, which both inflates the reward ledger (currentRewards, a persisted numeric value only the core is supposed to write) and corrupts topic mastery statistics — i.e., the agent is effectively writing state-affecting numbers indirectly through an unvalidated boolean, which is exactly the failure mode SPEC.md/CLAUDE.md's "agent never writes numbers directly" rule exists to prevent.
**Fix:** Add a floor check before trusting `isCorrect: true` from the agent, e.g.:
```ts
if (result.source === "agent") {
  const trustedCorrect = result.data.isCorrect && result.data.confidence >= 0.6;
  return {
    isCorrect: trustedCorrect,
    source: "agent",
    errorType: result.data.errorType,
    confidence: result.data.confidence,
    hintRu: result.data.hintRu,
  };
}
```
(Threshold value is a product decision, but *some* core-side gate must exist — currently there is none.)

### CR-03: `callAgent`'s broad `catch` swallows non-network/non-validation errors (e.g. programming bugs in the caller's schema construction), silently converting real defects into "core fallback" with no logging

**File:** `src/core/agents/callAgent.ts:104-119`
**Issue:** The outer and inner `try/catch` blocks catch *everything* thrown inside `attempt()`, including `z.toJSONSchema(...)` throwing on an invalid Zod schema, a TypeError from a bug in a future agent wrapper, or (per CR-01 above) a bug introduced in the block-selection logic — all of these silently degrade to `{ data: opts.fallback, source: "core", failed: true }` with **no logging whatsoever** (`RELY-03`'s own persisted `agentFailed` flag is the *only* signal, and it's indistinguishable from a genuine transient network failure). This means a shipped bug in the Answer Checker or Theory Tutor call construction (e.g., a schema typo) would present in production as "the agent is just always falling back," never surfacing as an actionable error anywhere — not console, not any error-reporting mechanism. Per the review skill's explicit callout, "accepting plausible-looking logic without tracing edge cases" and "empty catch blocks" are exactly this class of defect; this is a non-empty but effectively silent catch (no side effect distinguishing failure classes).
**Fix:** At minimum, log the caught error for diagnostic visibility without leaking to the UI:
```ts
} catch (err) {
  try {
    const data = await attempt();
    return { data, source: "agent", failed: false };
  } catch (retryErr) {
    console.error("Agent Gateway: both attempts failed", err, retryErr);
    return { data: opts.fallback, source: "core", failed: true };
  }
}
```

## Warnings

### WR-01: `TheoryScreen.onUnderstoodChoice` is typed as returning `void` but `main.ts` passes an `async` function, silently discarding the returned Promise and defeating type-checking of the await chain

**File:** `src/ui/screens/TheoryScreen.ts:14`, `src/main.ts:77-101`
**Issue:** `TheoryScreenOptions.onUnderstoodChoice: (understood: boolean) => void` declares a synchronous, non-awaitable callback. `main.ts` passes `async (understood) => { ... await engine.handleTheoryStep(understood); ... }`, which returns `Promise<void>`, structurally compatible with `() => void` in TypeScript (a known unsoundness: functions returning `Promise<void>` satisfy a `void`-returning type). Because `TheoryScreen.ts`'s call site (`understoodButton.addEventListener("click", () => onUnderstoodChoice(true))`) does not await or catch the returned promise, any unhandled rejection thrown by `handleTheoryStep` (e.g., a bug thrown before the `try/finally` in `main.ts`, or a rejection from `store.dispatch` itself) becomes an unhandled promise rejection with no test coverage catching this failure mode, and would not be surfaced to the user or caught by any error boundary (there is none in this vanilla-DOM app).
**Fix:** Widen the type to make the async contract explicit and enforce it at the type level:
```ts
onUnderstoodChoice: (understood: boolean) => void | Promise<void>;
```
And in the button handler in `TheoryScreen.ts`, explicitly ignore/void it if fire-and-forget is intended: `understoodButton.addEventListener("click", () => { void onUnderstoodChoice(true); });`

### WR-02: `callAgent`'s per-attempt timeout (8s) x 2 attempts (16s worst case) is only documented in comments, never asserted by any test — a regression changing `TIMEOUT_MS` or retry count would go undetected

**File:** `src/core/agents/callAgent.ts:61`, `src/main.ts:82-83, 125-126`
**Issue:** Both `main.ts` call sites cite "up to 16s worst case (D-07's 8s timeout x2)" in comments to justify disabling buttons during the await. No test in `tests/core/agents/callAgent.test.ts` or elsewhere asserts `TIMEOUT_MS` value or that `options.timeout` is actually passed to `client.messages.create`. If a future change silently increases `TIMEOUT_MS` (or the retry policy expands from 1 retry to N), the UI's "disable button, worst case 16s" reasoning silently becomes stale documentation with no test failure to catch it.
**Fix:** Add an assertion in `callAgent.test.ts` that `create` is invoked with `{ timeout: 8000, maxRetries: 0 }`:
```ts
expect(create).toHaveBeenCalledWith(expect.anything(), { timeout: 8000, maxRetries: 0 });
```

### WR-03: `AGENT_FALLBACK` in `answerChecker.ts` synthesizes `confidence: 0` and `hintRu: ""` purely to satisfy the generic `callAgent<T>` fallback typing, but these placeholder values are also what gets validated by the *retry* path's schema check if `attempt()` throws mid-flight — not a real bug today, but a latent trap for future maintainers

**File:** `src/core/agents/answerChecker.ts:34-39`
**Issue:** This is flagged as a maintainability risk rather than an active bug: `AGENT_FALLBACK` is a schema-shaped dummy object used only for `callAgent`'s generic `fallback: T` parameter, and the comment correctly notes `callAnswerChecker` "deliberately drops them" when mapping to `CheckResult`. However, nothing in the type system enforces that these fields stay unused downstream — a future refactor of `callAnswerChecker`'s mapping logic could accidentally read `result.data.confidence` off a fallback-sourced result (which would silently read `0` as if it were a genuine agent confidence score) since `AgentFallbackResult<T>.data` has the exact same shape as `AgentCallResult<T>.data`. There's no type-level distinction preventing conflation of "confidence: 0 because agent said so" vs "confidence: 0 because this is filler."
**Fix:** Consider a comment-only mitigation (already partially present) or, more robustly, don't synthesize a value for fields that have no real fallback meaning — e.g. use a distinguishable sentinel or restructure `callAgent`'s generic contract so the fallback's "extra" fields are typed `Partial<T>` merged with defaults only at the wrapper level, making misuse a type error rather than a runtime foot-gun.

### WR-04: `checkTextInput.ts`'s `CheckResult` interface makes `errorType`/`confidence`/`hintRu` optional, but nothing enforces they're absent on `source: "core"` or present on `source: "agent"` — a discriminated union would catch this at compile time

**File:** `src/core/answer-checking/checkTextInput.ts:13-19`
**Issue:** `CheckResult` is a flat interface with `source: "core" | "agent"` and three unrelated optional fields, rather than a discriminated union (`{ source: "core" } | { source: "agent"; errorType: ...; confidence: number; hintRu: string }`). This means `evaluateAttempt.ts`, `lessonEngine.ts`, and `main.ts` (e.g. `result.hintRu ?? (...)` in `main.ts:150-151`) must all defensively handle `undefined` for fields that are logically guaranteed present/absent based on `source`, and TypeScript cannot catch a future bug where an `agent`-sourced result is missing `hintRu` or a `core`-sourced result accidentally sets `confidence`.
**Fix:** Convert to a discriminated union:
```ts
export type CheckResult =
  | { isCorrect: boolean; source: "core" }
  | { isCorrect: boolean; source: "agent"; errorType: AnswerCheckerErrorType; confidence: number; hintRu: string };
```

### WR-05: `handleTheoryStep`'s round-1 core-only branch silently falls back to `""` for both `textRu` and `exampleRu` if `explanationLevels[1]` is missing from the lesson JSON, with no error signal that lesson content is malformed

**File:** `src/core/lessonEngine.ts:104, 111-114`
**Issue:** `const simpleLevel = explanationLevels[1];` followed by `simpleLevel?.textRu ?? ""` means a lesson JSON that's missing the "simple" explanation level (e.g. a data-entry mistake in `Lesson-1A.json`, or a malformed lesson loaded via the schema which — per `lessonLoader.ts`, not reviewed here — may not require a minimum array length) results in the child silently seeing an *empty* explanation with no rule text at all on "не понятно" round 1, and no error surfaces anywhere (console, thrown exception, or otherwise). This degrades silently to a confusing blank UI rather than failing loudly or falling back to `explanationLevels[0]`.
**Fix:** Fall back to a non-empty level or throw/log if the array is shorter than expected:
```ts
const simpleLevel = explanationLevels[1] ?? explanationLevels[0];
if (!simpleLevel) {
  console.error("Lesson theory.explanationLevels is empty — cannot render simplify round 1");
}
```

### WR-06: `TheoryTutorResponseSchema.level` is typed as a bare `z.string()` with no enum constraint, unlike `AnswerCheckerErrorTypeSchema`'s strict enum — any string from the agent is accepted and silently discarded downstream anyway

**File:** `src/core/agents/theoryTutorSchema.ts:13`
**Issue:** The schema comment states "Field naming ... mirrors the pre-written ExplanationLevelSchema's textRu/exampleRp spirit," but `level` and `canSimplifyMore` are validated and then never read anywhere in `theoryTutor.ts` or `lessonEngine.ts` — `callTheoryTutor`'s success-path return only extracts `explanationRu`/`exampleRu` (theoryTutor.ts:72-76). This means the tool schema requests two fields from the LLM (`level`, `canSimplifyMore`) that consume tokens and add tool-call surface area but influence zero application behavior, and because `level` has no enum, a garbage string still validates and is silently thrown away — indicating either dead schema fields or a missing feature (the round-sequencing logic in `lessonEngine.ts` already hardcodes `maxSimplifyRounds` from lesson JSON rather than consulting the agent's own `canSimplifyMore` signal, which seems like the intended use for that field).
**Fix:** Either wire `canSimplifyMore`/`level` into the round-sequencing decision (if that was the intent), or remove the unused fields from the schema/tool contract to reduce surface area and confusion for future maintainers.

## Info

### IN-01: `callAgent.ts`'s `AgentContentBlock` interface's `[key: string]: unknown` index signature combined with `type: string` makes the type effectively `any`-shaped for anything beyond `.type`, weakening compile-time safety for the block lookup

**File:** `src/core/agents/callAgent.ts:16-23`
**Issue:** This is a deliberate, documented DI seam per the comment ("a narrow DI seam ... must accept both vi.fn() mocks and the real SDK method"), so it's Info rather than a Warning — but worth flagging that the permissive typing here is precisely what enabled CR-01 above (no static signal that `.find()` picking "first tool_use" might be wrong when multiple exist) to go unnoticed.
**Fix:** No action required beyond the CR-01 fix; noting for completeness since fixing CR-01 makes this shape safer in practice.

### IN-02: Magic number `0.7`/`0.82` confidence values appear only in test fixtures, not in any core logic threshold — confirms CR-02's missing confidence gate has zero existing precedent to build on

**File:** `tests/core/agents/answerChecker.test.ts:34, 287`
**Issue:** Both tests pass `confidence: 0.82` / `0.7` for a "success" case but assert nothing about a confidence *threshold* mattering to the `isCorrect` outcome — reinforcing that there is currently no product-level definition of "how confident is confident enough" anywhere in code or tests. Not a bug per se, but confirms CR-02 isn't just a missing code path — it's an entirely unspecified requirement.
**Fix:** N/A — informational, tracked via CR-02.

### IN-03: `lessonEngine.ts`'s `handleAnswer` matching/order-builder input validation duplicates near-identical runtime type guards inline (3 separate `if` blocks with slightly different shapes) rather than extracting a shared payload-validation helper

**File:** `src/core/lessonEngine.ts:171-213`
**Issue:** Each of the four exercise-type branches (`text-input`, `single-choice`, `matching`, `order-builder`) repeats a very similar "throw if the payload doesn't structurally match" pattern with copy-pasted style but no shared helper, increasing the chance a future addition of a 5th exercise type omits or subtly varies the validation (e.g. the `matching` check tests `!("leftId" in p)` but not `"rightId" in p"`, which is a narrower check than what `order-builder`/`text-input` do for their respective shapes). Not incorrect today (all current tests pass), but a code-quality/duplication concern flagged for maintainability, not a functional bug.
**Fix:** Extract a small type-guard function per exercise-answer shape (e.g. `isMatchingPairArray(x): x is MatchingPair[]`) shared between `handleAnswer` and any future callers, and make the `matching` check symmetric (`"leftId" in p && "rightId" in p`).

### IN-04: `AGENT_FALLBACK`/theory `fallback` object literal duplication between `answerChecker.ts` and `theoryTutor.ts` — both wrappers hand-roll a near-identical "synthesize a fallback matching T" pattern with no shared abstraction

**File:** `src/core/agents/answerChecker.ts:34-39`, `src/core/agents/theoryTutor.ts:54-59`
**Issue:** Both agent wrappers independently implement the same "build a schema-shaped placeholder object purely to satisfy `callAgent`'s generic `fallback: T` parameter, then map/discard fields afterward" pattern. This is exactly the kind of duplication that, if a third agent wrapper is added in a future phase (Progress Advisor, Reward Advisor, Parent Report Generator per the project's "5 agents" architecture), risks being copy-pasted a third time with subtly different discard logic. Not urgent since only 2 of 5 planned agents exist, but worth flagging now while the pattern is small.
**Fix:** Consider a small shared helper or documented convention doc (not urgent at 2 instances) once a 3rd agent wrapper is added in a later phase.

---

_Reviewed: 2026-07-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
