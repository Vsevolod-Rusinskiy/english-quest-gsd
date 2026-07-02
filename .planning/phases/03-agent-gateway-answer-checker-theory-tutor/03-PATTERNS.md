# Phase 3: Agent Gateway, Answer Checker & Theory Tutor - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 11 (new: 8, modified: 3)
**Analogs found:** 11 / 11 (all role-match or partial-match; no async precedent exists — first phase introducing network I/O)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/core/agents/callAgent.ts` (new) | service | request-response (async, network) | `src/core/answer-checking/checkTextInput.ts` | partial (pure-function shape only; no async analog exists) |
| `src/core/agents/anthropicClient.ts` (new) | config | — (client instantiation) | `src/core/state/persistence.ts` (module-level singleton wrapper pattern) | partial |
| `src/core/agents/answerChecker.ts` (new) | service | request-response | `src/core/answer-checking/checkTextInput.ts` | role-match (same conceptual slot, sync→async) |
| `src/core/agents/answerCheckerSchema.ts` (new) | model | transform (Zod schema) | `src/core/state/progressSchema.ts` | exact (Zod schema + `z.infer` export pattern) |
| `src/core/agents/theoryTutor.ts` (new) | service | request-response | `src/core/agents/answerChecker.ts` (sibling, same phase) | exact (same gateway wrapper shape) |
| `src/core/agents/theoryTutorSchema.ts` (new) | model | transform (Zod schema) | `src/core/lesson/lessonSchema.ts` (`ExplanationLevelSchema`/`TheorySchema`) | exact |
| `src/core/answer-checking/checkTextInput.ts` (modified) | utility | CRUD (result shape extension) | itself (extend existing `CheckResult`) | exact |
| `src/core/lessonEngine.ts` (modified) | controller/orchestrator | request-response (sync→async conversion) | itself (`handleAnswer`/`handleTheoryStep`) | exact |
| `src/core/state/store.ts` (modified) | store | event-driven (reducer) | itself (`Action` union + `reduce`) | exact |
| `src/core/state/progressSchema.ts` (modified) | model | transform (Zod schema) | itself (`CurrentPositionSchema`) | exact |
| `src/main.ts` (modified) | controller | event-driven (DOM handlers → async await) | itself (`onSubmit`/`onUnderstoodChoice` closures) | exact |
| `src/ui/screens/TheoryScreen.ts` (modified) | component | request-response (render agent/fallback text) | itself | exact |
| `.env` (modified — rename keys) | config | — | n/a | n/a |
| `src/vite-env.d.ts` (new) | config | — | Vite default template (no project analog) | none — standard Vite boilerplate |

## Pattern Assignments

### `src/core/agents/answerCheckerSchema.ts` / `theoryTutorSchema.ts` (model, transform)

**Analog:** `src/core/state/progressSchema.ts`

**Zod schema + `z.infer` export pattern** (`src/core/state/progressSchema.ts` lines 9-22, 48-65, 86-93):
```typescript
import * as z from "zod";

export const RewardReasonSchema = z.enum([
  "honest_attempt",
  "first_try_correct",
  "correct_after_hint",
  "fixed_mistake",
  "streak_bonus",
  "weak_topic_closed",
]);

export const RewardEventSchema = z.object({
  rewardEventId: z.string(),
  exerciseId: z.string().optional(),
  relatedTopic: z.string().optional(),
  reason: RewardReasonSchema,
  amount: z.number(),
  attemptNumber: z.number(),
  createdAt: z.string(), // ISO timestamp
});

export type RewardReason = z.infer<typeof RewardReasonSchema>;
export type RewardEvent = z.infer<typeof RewardEventSchema>;
```

**Apply this exact shape to:**
- `AnswerCheckerErrorTypeSchema` (z.enum of the 11 SPEC §8.1 error-type literals, mirroring `RewardReasonSchema`'s enum-then-object pattern) + `AnswerCheckerResponseSchema` (mirrors `RewardEventSchema`'s object-of-typed-fields pattern).
- `TheoryTutorResponseSchema` — cross-reference `ExplanationLevelSchema` (`src/core/lesson/lessonSchema.ts` lines 99-103) for the `textRu`/`exampleRu` field naming convention already established in the lesson data shape; keep field names consistent (`explanationRu`/`exampleRu`, not new naming) so `TheoryScreen.ts` can treat agent output and pre-written levels uniformly.

**Comment-style precedent** (why fields are required not optional) — `progressSchema.ts` lines 1-6, 26-36: every schema file in this project opens with a comment block explaining WHY each field is required/optional and what breaks if a legacy blob is missing it. Follow this same documentation-in-schema convention for the two new agent schemas (e.g., document why `confidence`/`hintRu` are always present in the *validated* shape even though the fallback constructs them synthetically).

---

### `src/core/agents/callAgent.ts` (service, request-response — NEW pattern, no direct sync analog)

**Analog:** `src/core/answer-checking/checkTextInput.ts` (pure-function input→typed-result shape) — structurally informs the *contract* (typed input, typed result with a `source` discriminant), but this is the **first async/network file in the codebase**; there is no existing retry/timeout/fallback precedent to copy control flow from. Follow RESEARCH.md's Pattern 4 code example directly (already vetted against official Anthropic SDK docs) rather than searching further for a stronger analog.

**`CheckResult`-style discriminated shape to mirror** (`src/core/answer-checking/checkTextInput.ts` lines 1-17):
```typescript
// Deterministic text-input exact-match (CHECK-01, EXERCISE-01).
// Pure function: NO network, NO agent, NO fuzzy matching.
import type { TextInputExercise } from "../lesson/lessonSchema";
import { normalize } from "./normalize";

export interface CheckResult {
  isCorrect: boolean;
  source: "core";
}

export function checkTextInput(exercise: TextInputExercise, rawAnswer: string): CheckResult {
  const normalizedAnswer = normalize(rawAnswer);
  const isCorrect = exercise.answerCheck.acceptedAnswers.some(
    (accepted) => normalize(accepted) === normalizedAnswer,
  );
  return { isCorrect, source: "core" };
}
```
**What to copy:** the top-of-file comment convention (states the SPEC req IDs and explicitly what the function does NOT do — "NO network, NO agent" here becomes "NO untrusted write — Zod-validates before returning `source: 'agent'`"), the plain exported function (not a class) taking typed input and returning a typed discriminated result, and the `source` field discriminant pattern extended to `"agent" | "core"` per D-05/D-08.

**Core async gateway logic — use RESEARCH.md's Pattern 4 verbatim as the base** (already-vetted, cite in the file header as grounded in D-05/D-06/D-07):
```typescript
export interface AgentCallResult<T> {
  data: T;
  source: "agent";
  failed: false;
}
export interface AgentFallbackResult<T> {
  data: T;
  source: "core";
  failed: true;
}

export async function callAgent<T>(opts: {
  schema: z.ZodType<T>;
  toolName: string;
  toolDescription: string;
  systemPrompt: string;
  userContent: string;
  fallback: T;
}): Promise<AgentCallResult<T> | AgentFallbackResult<T>> {
  const attempt = async (): Promise<T> => {
    const response = await anthropicClient.messages.create(
      { /* model, tools, tool_choice, forced strict schema */ },
      { timeout: 8000, maxRetries: 0 }, // D-07
    );
    const block = response.content.find((b) => b.type === "tool_use");
    const parsed = opts.schema.safeParse(block?.input);
    if (!parsed.success) throw new Error(`Agent response failed schema validation: ${parsed.error.message}`);
    return parsed.data;
  };
  try {
    const data = await attempt();
    return { data, source: "agent", failed: false };
  } catch {
    try {
      const data = await attempt();
      return { data, source: "agent", failed: false };
    } catch {
      return { data: opts.fallback, source: "core", failed: true };
    }
  }
}
```
**Critical:** catch broadly (no `instanceof` narrowing) per RESEARCH.md Pitfall 4 — router response-shape drift must not escape as an uncaught exception.

---

### `src/core/agents/anthropicClient.ts` (config — module-level singleton)

**Analog:** `src/core/state/persistence.ts` (module-level, side-effecting singleton wrapper around a browser API — `localStorage` there, `fetch`/SDK client here)

```bash
```

<snippet not read in full — pattern is: export a single module-level instance, no class needed, comment documenting the scoped security tradeoff (mirrors persistence.ts's D-03 "save() called only here" comment style)>

**Apply:** one `export const anthropicClient = new Anthropic({...})` at module scope (RESEARCH.md Pattern 3), with a comment block equivalent in weight to `store.ts` line 1-2's "save() is called ONLY here" — document that `dangerouslyAllowBrowser: true` is D-03's explicit scoped tradeoff, not an oversight.

---

### `src/core/agents/answerChecker.ts` / `theoryTutor.ts` (service, request-response)

**Analog:** `src/core/answer-checking/checkSingleChoice.ts` (thin wrapper delegating to a shared result type) — structurally these are the "thin per-agent wrapper calling the shared gateway" the same way `checkSingleChoice` is a thin wrapper producing the shared `CheckResult`:

```typescript
// Deterministic single-choice option-id comparison (CHECK-02, EXERCISE-02).
import type { SingleChoiceExercise } from "../lesson/lessonSchema";
import type { CheckResult } from "./checkTextInput";

export function checkSingleChoice(
  exercise: SingleChoiceExercise,
  selectedOptionId: string,
): CheckResult {
  const isCorrect = selectedOptionId === exercise.answerCheck.correctOptionId;
  return { isCorrect, source: "core" };
}
```
**Apply:** `callAnswerChecker(input): Promise<AnswerCheckerResponse | AgentFallbackResult<...>>` and `callTheoryTutor(input): Promise<...>` follow this same "import shared type, thin function, single responsibility" shape — but async, calling `callAgent()` with the agent-specific schema/prompt/fallback per RESEARCH.md's Recommended Project Structure.

---

### `src/core/answer-checking/checkTextInput.ts` (modified — extend `CheckResult`)

**Analog:** itself. Current contract (lines 6-9):
```typescript
export interface CheckResult {
  isCorrect: boolean;
  source: "core";
}
```
**Extend to** (per D-09, informed by `AnswerCheckerResponseSchema`'s shape):
```typescript
export interface CheckResult {
  isCorrect: boolean;
  source: "core" | "agent";
  errorType?: AnswerCheckerErrorType;   // only populated on ambiguous/agent path
  confidence?: number;
  hintRu?: string;
}
```
Keep `checkTextInput()` itself synchronous and unchanged in its own exact-match logic — the extension point is in `lessonEngine.ts`'s caller, which now branches on `isCorrect === false` to invoke `callAnswerChecker` (D-09), not inside `checkTextInput` itself.

---

### `src/core/lessonEngine.ts` (modified — sync → async conversion)

**Analog:** itself (`handleAnswer` lines 72-148, `handleTheoryStep` lines 68-70).

**Current sync signature to convert:**
```typescript
handleTheoryStep(_understood: boolean): void {
  this.store.dispatch({ type: "theory_step", understood: true });
}

handleAnswer(exerciseId: string, answer: AnswerPayload): CheckResult {
  // ... switch over exercise.type, synchronous checker calls ...
  const state = this.store.getState();
  const delta = evaluateAttempt(state, exercise, result, priorAttempts, this.exercises);
  const wasReviewPass = this.isReviewPass() && this.getCurrentExerciseId() === exerciseId;
  this.store.dispatch({ type: "exercise_attempt", /* ... */ });
  if (result.isCorrect && !wasReviewPass) {
    this.store.dispatch({ type: "advance_position" });
  }
  return result;
}
```
**Pattern to preserve exactly:** the "compute full delta via `evaluateAttempt`, then ONE `dispatch` call" invariant (comment at lines 117-120) — the new `await callAnswerChecker(...)` call must happen **before** `evaluateAttempt` runs (so `evaluateAttempt` still receives a complete, final `CheckResult`), not interleaved with dispatch. Convert both methods to `async`/`Promise<CheckResult>` and `Promise<void>` respectively; the exhaustive switch/error-throwing style (lines 82-115) is unchanged — only the `text-input` branch gains a conditional `await` when the deterministic pass returns `isCorrect: false`.

**Theory round-counter integration point** — `isReviewPass()`/`getCurrentExerciseId()` (lines 37-58) show the established style for reading `state.currentPosition.*` fields and branching; apply the same style to read the new `simplifyRoundCount` field in `handleTheoryStep`.

---

### `src/core/state/store.ts` (modified — extend `Action` union)

**Analog:** itself (`Action` type lines 6-27, `reduce` lines 56-108).

**Existing extension precedent to copy exactly** (`exercise_attempt` action comment, lines 8-26):
```typescript
| {
    type: "exercise_attempt";
    exerciseId: string;
    isCorrect: boolean;
    // Phase 2 (PROGRESS-01/02/03, REWARD-01/02): the FULL evaluateAttempt()
    // delta folds into this SAME action so one dispatch = one save = one
    // render per answer (Pitfall 3) — no topic_status_updated / review_queue_
    // updated / reward_granted action types.
    topicUpdates: Record<string, TopicStat>;
    reviewQueueAdditions: string[];
    rewardEvents: RewardEvent[];
    nextCorrectStreak: number;
    reviewDequeueId?: string;
  }
```
**Apply this exact "extend one action type with new optional fields, document why in a phase-tagged comment" pattern to:**
- `exercise_attempt`: add `source: "core" | "agent"` and `agentFailed: boolean` fields (RELY-03) — same additive style as `reviewDequeueId?` was added in Phase 2.
- `theory_step`: extend beyond the current `{ type: "theory_step"; understood: boolean }` (line 7) to carry whatever the round logic needs to persist — likely a `simplifyRoundCount` delta and `source`/`agentFailed` mirroring the exercise_attempt fields, OR a new `theory_simplify` action type if the existing `theory_step` action's single boolean shape doesn't cleanly extend (planner's call — but if reused, follow the exact additive-field convention shown above, not a full type replacement).

**Reducer pattern to copy** (`theory_step` case, lines 58-62):
```typescript
case "theory_step":
  return {
    ...state,
    currentPosition: { ...state.currentPosition, theoryUnderstood: true },
  };
```
Extend this spread-style immutable update to also write `simplifyRoundCount` into `currentPosition`.

---

### `src/core/state/progressSchema.ts` (modified — add `simplifyRoundCount`)

**Analog:** itself (`CurrentPositionSchema`, lines 24-36).

```typescript
export const CurrentPositionSchema = z.object({
  theoryUnderstood: z.boolean(),
  currentExerciseIndex: z.number(),
  // Review-pass cursor (PROGRESS-04, D-02, Open Question 1). Required (not
  // optional/default) so a Phase-1/Plan-02-shaped legacy blob missing it
  // resets via load() rather than resuming into an undefined cursor...
  reviewPassIndex: z.number(),
});
```
**Apply:** add `simplifyRoundCount: z.number()` as a **required** field (not optional/default), following the exact same comment-driven rationale as `reviewPassIndex` — a legacy blob missing it should reset via `load()`, per this file's established schema-versioning discipline (RESEARCH.md Open Question 2's recommendation, consistent with this codebase's existing convention, not a new one).

---

### `src/main.ts` (modified — async DOM handlers, "thinking" state)

**Analog:** itself (`onSubmit` closure, lines 92-155; the unsubscribe/resubscribe comment at lines 93-98).

**Current sync pattern that must become async:**
```typescript
onSubmit: (answer) => {
  // handleAnswer's dispatch(es) are synchronous and would trigger the
  // subscribed render() before `feedback` below is set (dispatch fires
  // mid-call, before handleAnswer returns). Unsubscribe for the
  // duration of this call so at most ONE explicit, fully-informed render
  // happens after `feedback` is captured.
  unsubscribeRender();
  const result = engine.handleAnswer(exercise.exerciseId, answer);
  unsubscribeRender = store.subscribe(render);
  // ...
}
```
**Apply:** change the closure to `async (answer) => { ... }`, `await engine.handleAnswer(...)`, keep the unsubscribe-before/resubscribe-after structure exactly as-is (the reasoning in the comment still holds, now spanning an async gap instead of a sync one) — this is the single call site RESEARCH.md Pitfall 2 flags as needing the `await` + a "thinking" UI cue (disable submit button immediately on click, before the `await`, re-enable in a `finally`). Same treatment applies to `onUnderstoodChoice` (line 71) for `handleTheoryStep`.

---

### `src/ui/screens/TheoryScreen.ts` (modified — render round-aware explanation text)

**Analog:** itself (lines 20-25, hardcoded `explanationLevels[0]`).

```typescript
const firstLevel = theory.explanationLevels[0];
if (firstLevel) {
  const example = document.createElement("p");
  example.textContent = firstLevel.exampleRu;
  container.appendChild(example);
}
```
**Apply:** the `createElement`/`textContent`-only convention (no `innerHTML`, matches every other UI file in the codebase) extends directly to rendering whichever explanation text `main.ts` passes in (pre-written level, agent-returned text, or fallback-re-served level) — add an options field (e.g., `currentExplanation: { textRu: string; exampleRu: string } | null`) alongside the existing `theory`/`onUnderstoodChoice` options, following the same flat-options-object shape already used by `TheoryScreenOptions` (lines 5-8).

---

## Shared Patterns

### Zod schema + `z.infer` type export (every schema file, all phases)
**Source:** `src/core/state/progressSchema.ts`, `src/core/lesson/lessonSchema.ts`
**Apply to:** `answerCheckerSchema.ts`, `theoryTutorSchema.ts` — one `z.object`/`z.enum` per shape, immediately followed by `export type X = z.infer<typeof XSchema>`, grouped at the bottom of the file (see `progressSchema.ts` lines 86-93's export block).

### Single-dispatch-per-action invariant (Phase 1 D-03, Phase 2 Pitfall 3)
**Source:** `src/core/state/store.ts` (`dispatch()` lines 48-54), `src/core/lessonEngine.ts` (lines 117-120's comment)
**Apply to:** `lessonEngine.ts`'s `handleAnswer`/`handleTheoryStep` — agent-call outcomes (`source`, `failed`) must fold into the SAME `exercise_attempt`/`theory_step` dispatch, never a second dispatch call. This is the most safety-critical pattern to carry forward exactly as-is; violating it breaks the "one dispatch = one save = one render" guarantee documented in `store.ts`'s file header.

### Top-of-file req-ID + behavior comment
**Source:** every existing core file (e.g., `checkTextInput.ts` line 1, `lessonEngine.ts` lines 1-3)
**Apply to:** all new agent files — open with a comment citing the SPEC/CONTEXT req IDs implemented (CHECK-03/04, THEORY-03, RELY-01/02/03) and one explicit sentence on what the file does NOT do (mirrors `checkTextInput.ts`'s "Pure function: NO network, NO agent, NO fuzzy matching" — the agent files' equivalent is "NEVER writes state directly; only proposes a value the core validates").

### `createElement`/`textContent` only, zero `innerHTML`
**Source:** all `src/ui/**` files (confirmed in `TheoryScreen.ts`, `main.ts`)
**Apply to:** `TheoryScreen.ts`'s new agent/fallback-text rendering branch — no exception for agent-authored text, since it is still untrusted-until-validated content (defense against any future markup injection risk, consistent with RELY-01's validation boundary).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/core/agents/callAgent.ts` | service | request-response (async, network, retry/timeout) | No async/network code exists anywhere in the codebase yet — this is the first phase crossing that boundary. Use RESEARCH.md's Pattern 4 (already sourced from official Anthropic SDK docs) as the primary reference instead of a codebase analog. |
| `src/core/agents/anthropicClient.ts` | config | — | No prior external-service client instantiation exists; closest structural analog (`persistence.ts`'s module-level `localStorage` wrapper) is a browser-storage API, not a network client — informs *style* (module-level singleton, security-tradeoff comment) but not the SDK-specific instantiation code, which should follow RESEARCH.md Pattern 3 verbatim. |
| `src/vite-env.d.ts` | config | — | No existing Vite env-typing file in the project; this is standard Vite boilerplate (`/// <reference types="vite/client" />` + `ImportMetaEnv` interface), not a codebase pattern to extract. |

## Metadata

**Analog search scope:** `src/core/**`, `src/main.ts`, `src/ui/screens/**`, `tests/core/**` (for test-file convention confirmation)
**Files scanned:** 24 source files, 1 test file (`checkTextInput.test.ts`) read for test-structure convention
**Pattern extraction date:** 2026-07-02
