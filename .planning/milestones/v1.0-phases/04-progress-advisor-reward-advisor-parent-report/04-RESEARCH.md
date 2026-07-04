# Phase 4: Progress Advisor, Reward Advisor & Parent Report - Research

**Researched:** 2026-07-03
**Domain:** Extending an existing hybrid deterministic-core/LLM-agent TypeScript app with 3 more single-shot agents (Progress Advisor, Reward Advisor, Parent Report Generator), state-schema extension, and sequential end-of-session agent orchestration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Reward Advisor Timing & Scope**
- **D-01:** Reward Advisor is called **live, per exercise answer** (not once at session end) — the same real-time pattern as Answer Checker in Phase 3, not a session-end batch summary.
- **D-02:** It is called on **every** answer that produces at least one reward event, including `honest_attempt` (+1₽ for any attempt) — not gated to "significant" reasons only (first_try_correct/streak_bonus/weak_topic_closed). This means potentially one live agent call per exercise submission across the whole lesson (up to 19+ calls in a full session).
- **D-03:** When a single answer produces **multiple** reward events at once (e.g. `honest_attempt` + `first_try_correct` + `streak_bonus` all firing together), this is **one Reward Advisor call per answer**, not one call per individual reward event — the full list of that answer's reward events is passed to the agent together, and it returns one combined praise phrase. Mirrors SPEC.md §8.3's per-attempt input framing ("результат проверки, номер попытки, история, серия").
- **D-04:** The agent's praise text renders in the **same feedback banner** used for correct/incorrect verdicts — no new UI element. If the agent call fails (after retry), the banner shows the existing correct/incorrect message with no praise line (fixed reward amounts are unaffected either way — Reward Advisor never touches amounts, per REWARD-03/04).

**Session-End Scenario**
- **D-05:** The current bare "Урок завершён!" message is **replaced** by one combined end-of-session screen (not appended alongside it) — child and parent both see the same single screen: Progress Advisor's recommendation/motivational text plus the Parent Report, together.
- **D-06:** Progress Advisor and Parent Report Generator are **two separate agent calls** through the same shared `callAgent()`, not merged into one combined JSON contract — preserves SPEC.md §6/§8's "5 independent agent-functions" boundary even though they're presented on the same screen.
- **D-07:** Call order is **sequential, not parallel**: Progress Advisor resolves first (agent success or fallback — either way it produces a final core-decided `recommendedFocus`/`suggestedDifficulty`), and only then is Parent Report Generator called, receiving that final recommendation as part of its input snapshot. This directly implements SPEC.md §8.4's stated input ("снимок урока + рекомендация") — Parent Report is NOT independent of Progress Advisor's outcome.
- **D-08:** The child/parent sees a brief **thinking-screen** while both sequential calls run (mirrors Phase 3's disabled-buttons + thinking-cue pattern) — worst case ~32s (two agents × up to 16s each with one retry) is treated as acceptable given the session-end nature (not a mid-lesson blocking wait).

**difficultyMode Scope (MVP has only 1 lesson, no easy/challenge content variants)**
- **D-09:** `difficultyMode` is **computed and stored only** this phase — it does NOT change anything observable within a single lesson session (there is no easy/challenge content to switch to in `Lesson-1A.json`). It is surfaced in the end-of-session recommendation/report as an informational value ("next session should be at X difficulty"), honoring SPEC.md §12's guardrails (no easy→challenge jump, up only after 3-correct streak, down only after 2 errors) in the computation itself, even though there's no in-session behavior to gate.
- **D-10:** SPEC.md's "меняется только между уроками" (changes only between lessons) guardrail is honored literally: `difficultyMode` is computed **once, at session end**, not recalculated live after every answer within the session — consistent with there being exactly one lesson in this MVP (the guardrail is a no-op observable effect here, but the computation still happens correctly for whenever a second lesson exists).

**wordStats**
- **D-11:** A dedicated `wordStats` (separate from `topicStats`/`exerciseTypeStats`) IS built for Progress Advisor's input, per SPEC.md §8.2's explicit input contract — even though only 10 of 19 real exercises have non-empty `targetWords` (each currently exactly 1 word).
- **D-12:** Update rule mirrors Phase 2's D-01 pattern for `topicImpact`: loop over **all** entries in `targetWords[]` for an exercise and apply the same correct/incorrect signal to each word's counters. Degenerates to a single update per attempt in today's real data (never more than 1 word), but the implementation must not assume length ≤ 1 — schema allows more, matching Phase 2's precedent decision for `topicImpact`.

### Claude's Discretion

- Exact TypeScript shape/module layout for `wordStats`, `exerciseTypeStats`, `StudentProfileSchema` extensions (`confidenceScore`, `difficultyMode`, `lastRecommendedFocus`, `motivationSignals`) — left to planner/executor, following Phase 1/2's established Zod-schema-per-shape pattern. `confidenceScore`'s exact formula is already fixed by SPEC.md §12 (`clamp(correctRatio + 0.05*streak - 0.1*errorsInARow, 0, 1)`) — no product decision needed, just correct implementation.
- Whether the end-of-session screen is a distinct render branch in `main.ts`/a new UI module, or extends the existing `else` branch that currently renders "Урок завершён!" — implementation detail, not a product decision (D-05 only fixes that it's ONE combined screen, not the visual structure).
- `exerciseTypeStats` shape (per-type attempts/correct, keyed by `text-input`/`single-choice`/`matching`/`order-builder`) — straightforward extension of the existing `exerciseStats`-per-exercise pattern, no gray area surfaced during discussion.

### Deferred Ideas (OUT OF SCOPE)

- Full easy/normal/challenge content variants (alternate exercise sets) — would make `difficultyMode` visibly actionable within a session, but requires new lesson content authoring, which is out of this MVP's scope (D-09).
- REPORT-03 (cross-lesson trend from `lessonHistory`) — explicitly not a Phase 4 requirement; `lessonHistory` stays untyped (`z.array(z.unknown())`) for this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERSONAL-01 | Агент Progress Advisor даёт рекомендацию следующего фокуса, сложности (easy/normal/challenge) и совет по завершению сессии на основе `topicStats`/`wordStats`/`exerciseTypeStats` | Pattern 1 (thin agent wrapper) + Pattern 2 (sequential session-end calls) provide the exact call shape; `wordStats`/`exerciseTypeStats` schema additions specified in Recommended Project Structure |
| PERSONAL-02 | Ядро применяет защитные правила смены сложности (не прыгать easy→challenge напрямую, менять только между уроками, вверх после 3 правильных подряд, вниз после 2 ошибок) независимо от совета агента | `applyDifficultyGuardrails()` pure function design (Don't Hand-Roll table + Pitfall 2's test-matrix guidance) — agent's `suggestedDifficulty` is one input, never a direct write |
| PERSONAL-03 | При недоступности Progress Advisor ядро использует только пороговые правила без персонализации | `callAgent()`'s existing fallback mechanism (unchanged, reused) — Pattern 1 shows the fallback-mapping shape; Validation Architecture's PERSONAL-03 test row |
| REWARD-03 | Агент Reward Advisor предлагает причины начисления и текст похвалы; ядро проверяет предложение и начисляет сумму само | Pattern 3 (live per-answer call) + Pitfall 3 (cross-checking suggested reasons against granted `rewardEvents`) |
| REWARD-04 | При недоступности Reward Advisor ядро само применяет reward-правила без текста похвалы от агента | Pattern 3's `advisorResult.source === "agent"` gate — praise text (`praiseRu`) stays `undefined` on fallback, `computeRewardEvents()` amounts unaffected either way |
| REPORT-01 | После урока родитель видит короткий отчёт: сколько пройдено, сколько верно, что даётся трудно, что повторить, сколько рублей, одна рекомендация | Pattern 2's `callParentReportGenerator` input snapshot construction; Validation Architecture REPORT-01 test row |
| REPORT-02 | Отчёт формируется агентом Parent Report Generator; при недоступности агента используется шаблонный отчёт из тех же полей | Pattern 1 (thin wrapper + fallback) applied to Parent Report Generator; Validation Architecture REPORT-02 test row |
</phase_requirements>

## Summary

This phase is almost entirely an **extension of existing, working patterns** from Phase 2 (reward engine, topic FSM, per-topic loop) and Phase 3 (Agent Gateway, thin-wrapper agents, async-handler-with-thinking-cue UI pattern). No new libraries, no new architecture, no new external dependency. `callAgent<T>()` (`src/core/agents/callAgent.ts`) is already fully generic and reused unchanged by all 3 new agents. The only genuinely new mechanics are: (1) a **live per-answer agent call** (Reward Advisor) that must slot into `LessonEngine.handleAnswer` without breaking the single-dispatch-per-action invariant; (2) **two sequential dependent agent calls** at session end (Progress Advisor -> Parent Report Generator) that must resolve before one combined screen renders; and (3) **state schema growth** (`wordStats`, `exerciseTypeStats`, and 4 new `StudentProfileSchema` fields) following the exact Zod-schema-required-fields-reset-on-mismatch discipline already established in `progressSchema.ts`/`persistence.ts`.

All three new agents are thin wrappers with the shape: build `userContent` JSON -> `callAgent({schema, toolName, toolDescription, systemPrompt, userContent, fallback})` -> map `result.source` to the public return shape. The core NEVER trusts agent output for state-changing numbers (confidenceScore, difficultyMode, reward amounts) — only for display text (praise, motivational message, report prose) and for *suggestions* that the core re-validates against fixed guardrails before acting (difficultyMode transitions, which reward reasons are actually granted).

**Primary recommendation:** Build all 3 agents as thin `callAgent()` wrappers mirroring `answerChecker.ts`/`theoryTutor.ts` exactly (schema file + wrapper file per agent). Compute `confidenceScore`/`difficultyMode` transitions as a pure core function (`progressAdvisorGuardrails.ts` or similar) that runs regardless of whether the agent succeeds, and only lets the agent's `suggestedDifficulty` influence the OUTCOME via the guardrail function's own logic — never by directly assigning the agent's raw suggestion to state. Reward Advisor's live call happens in `LessonEngine.handleAnswer` immediately after `evaluateAttempt()`/`computeRewardEvents()` produce `delta.rewardEvents`, is awaited before the existing single `exercise_attempt` dispatch, and only adds a `praiseRu` string onto that dispatch — never a new dispatch, never touching `amount`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `confidenceScore` computation (fixed formula) | Core (`src/core/progress/` or new `src/core/personalization/`) | — | SPEC §12 gives the exact formula; this is arithmetic, never agent-owned |
| `difficultyMode` transition + guardrails | Core | Agent (Progress Advisor) suggests | Agent proposes `suggestedDifficulty`; core's guardrail function is the only writer, per PERSONAL-02 |
| Progress Advisor call (recommendedFocus/sessionAdvice/motivationalMessageRu) | Agent (via `callAgent`) | Core fallback | Single-shot JSON call, session-end only |
| Reward Advisor call (praise text only) | Agent (via `callAgent`) | Core (amounts, dedup, limits) | Core (`rewardEngine.ts`) already fixed the numbers; agent adds text on top |
| Parent Report Generator call (parentReportRu/headlineRu) | Agent (via `callAgent`) | Core fallback (template) | Depends on Progress Advisor's FINAL (core-decided) recommendation as input |
| `wordStats`/`exerciseTypeStats` counters | Core (`evaluateAttempt.ts` extension) | — | Pure counter bookkeeping, same tier as existing `topicStats` |
| End-of-session combined screen (render) | Browser/Client (`main.ts`, new UI module) | — | Pure rendering of core-decided + agent-decided-and-validated data |
| Sequencing of the 2 session-end agent calls | Core (`LessonEngine`, e.g. `handleSessionEnd()`) | Browser (awaits the promise, shows thinking-cue) | D-07: must be sequential; orchestration logic belongs in the engine, not in `main.ts` |

## Standard Stack

### Core
No new libraries required. This phase is 100% additive TypeScript modules on top of the existing stack.

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `^0.109.1` installed; `0.110.0` current on npm [VERIFIED: npm registry] | Underlying client `callAgent()` already wraps | Unchanged from Phase 3 — no upgrade needed for this phase's scope; a minor bump to 0.110.0 is optional housekeeping, not required |
| `zod` | `^4.4.0` installed; `4.4.3` current on npm [VERIFIED: npm registry] | New schemas: `wordStats`, `exerciseTypeStats`, `StudentProfileSchema` extension, 3 new agent-response schemas | Same pattern as every prior phase — no version bump needed |
| `vitest` | `^4.1.0` installed | Unit/integration tests for the 3 new agent wrappers, guardrail function, `wordStats`/`exerciseTypeStats` counters | Unchanged from Phase 1-3 |

**Installation:** None — no new packages. `npm install` is a no-op for this phase.

### Supporting
No new supporting libraries. Continue using: `crypto.randomUUID()` (already used in `rewardEngine.ts` for `rewardEventId`), native `Date.toISOString()`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain sequential `await` chain for Progress Advisor -> Parent Report | `Promise.all` (parallel) | Rejected by D-07 explicitly — Parent Report needs Progress Advisor's FINAL core-decided recommendation as input, so parallel execution is structurally wrong here, not just slower |
| One combined "session-end" agent contract merging Progress Advisor + Parent Report | Two separate `callAgent()` calls | Rejected by D-06 — violates the "5 independent agent-functions" architectural boundary that is itself part of the thesis's grading criteria |

## Package Legitimacy Audit

No new external packages are introduced by this phase. All work uses already-installed, already-audited dependencies (`@anthropic-ai/sdk`, `zod`, `vitest`) from Phase 1-3.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@anthropic-ai/sdk` | npm | Actively maintained, official Anthropic org | High | github.com/anthropics/anthropic-sdk-typescript | OK | Already approved (Phase 3) |
| `zod` | npm | Mature, official | Very high | github.com/colinhacks/zod | OK | Already approved (Phase 1) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Per-answer flow (existing, extended by Reward Advisor):
  Child submits answer
        |
        v
  LessonEngine.handleAnswer()
        |
        +--> deterministic checker (text/single-choice/matching/order-builder)
        |         |
        |         +--(text-input ambiguous)--> Answer Checker agent (Phase 3, unchanged)
        v
  evaluateAttempt() [pure] --> topicUpdates, reviewQueueAdditions, rewardEvents[], nextCorrectStreak
        |                                            |
        |                                            v
        |                              *** NEW: Reward Advisor call ***
        |                              (only if rewardEvents.length > 0)
        |                              input: rewardEvents[], attemptNumber, streak
        |                              output: praiseRu (text only, core keeps amounts)
        v
  ONE exercise_attempt dispatch (existing shape + praiseRu field)
        |
        v
  StateStore.reduce() --> save() --> render() [feedback banner shows praiseRu if present]


Session-end flow (all new):
  Last exercise/review item answered, engine detects lesson complete
        |
        v
  *** NEW: LessonEngine.handleSessionEnd() ***
        |
        +--> compute confidenceScore (pure, SPEC §12 formula)
        |
        +--> compute wordStats/exerciseTypeStats snapshot (already accumulated per-answer)
        |
        v
  1) await callProgressAdvisor(topicStats, wordStats, exerciseTypeStats, ...)
        |         |
        |         v
        |    apply difficultyMode guardrails (PURE core function) using
        |    agent's suggestedDifficulty as ONE input, never as the direct write
        |         |
        |         v
        |    FINAL recommendedFocus/suggestedDifficulty/sessionAdvice (core-decided)
        |
        v
  2) await callParentReportGenerator(lessonSnapshot + FINAL recommendation from step 1)
        |
        v
  ONE combined dispatch (e.g. "session_end") writing:
    studentProfile.{confidenceScore, difficultyMode, lastRecommendedFocus, motivationSignals}
    + transient (or persisted, planner's call) report/recommendation text
        |
        v
  main.ts: replace "Урок завершён!" else-branch with combined screen
  (child recommendation + parent report), single render after both calls resolve
```

### Recommended Project Structure
```
src/core/
├── agents/
│   ├── progressAdvisor.ts          # NEW — thin wrapper, mirrors answerChecker.ts
│   ├── progressAdvisorSchema.ts    # NEW — Zod schema for agent response
│   ├── rewardAdvisor.ts            # NEW — thin wrapper, mirrors theoryTutor.ts
│   ├── rewardAdvisorSchema.ts      # NEW
│   ├── parentReportGenerator.ts    # NEW
│   ├── parentReportGeneratorSchema.ts # NEW
│   ├── callAgent.ts                 # UNCHANGED (reused)
│   ├── answerChecker.ts             # UNCHANGED
│   └── theoryTutor.ts               # UNCHANGED
├── personalization/                 # NEW module (or fold into progress/, planner's discretion)
│   ├── confidenceScore.ts           # NEW — pure formula (SPEC §12)
│   └── difficultyGuardrails.ts      # NEW — pure guardrail transition function (PERSONAL-02)
├── progress/
│   ├── evaluateAttempt.ts           # EXTENDED — also produce wordStats/exerciseTypeStats deltas
│   ├── topicStatusMachine.ts        # UNCHANGED
│   └── reviewQueue.ts               # UNCHANGED
├── rewards/
│   └── rewardEngine.ts              # UNCHANGED (amounts/limits untouched)
├── state/
│   ├── progressSchema.ts            # EXTENDED — wordStats, exerciseTypeStats, StudentProfileSchema fields
│   ├── initialState.ts              # EXTENDED — seed new fields
│   └── store.ts                     # EXTENDED — new action variant(s) for session-end + reward praise
└── lessonEngine.ts                  # EXTENDED — handleSessionEnd(), Reward Advisor hook in handleAnswer

src/ui/screens/
└── SessionEndScreen.ts               # NEW — combined child recommendation + parent report screen
```

### Pattern 1: Thin Agent Wrapper (mirror exactly)
**What:** Every new agent is a schema file (Zod contract) + a wrapper file (`callAgent()` invocation + fallback mapping).
**When to use:** All 3 new agents — Progress Advisor, Reward Advisor, Parent Report Generator.
**Example (from existing codebase, `src/core/agents/theoryTutor.ts`):**
```typescript
// Pattern to replicate for progressAdvisor.ts / rewardAdvisor.ts / parentReportGenerator.ts
export async function callX(input: XInput): Promise<XResult> {
  const userContent = JSON.stringify({ /* untrusted DATA fields only, never instructions */ });

  const fallback: XResponse = { /* schema-shaped synthetic fallback value */ };

  const result = await callAgent({
    schema: XResponseSchema,
    toolName: "report_x",
    toolDescription: "...",
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    fallback,
    client: input.client, // DI seam for tests
  });

  if (result.source === "agent") {
    return { /* map result.data fields */, source: "agent" };
  }
  return { /* fallback-shaped public return */, source: "core" };
}
```

### Pattern 2: Sequential Dependent Async Calls (Answers Technical Question 1)
**What:** Progress Advisor MUST resolve (agent success or fallback — either way, produces the FINAL core-decided recommendation) before Parent Report Generator is called, because Parent Report's input snapshot includes that recommendation (D-07, SPEC §8.4).
**When to use:** Session-end flow only.
**Example:**
```typescript
// In LessonEngine, a new method — NOT in main.ts. Orchestration belongs in
// the engine (mirrors handleAnswer/handleTheoryStep being engine methods,
// not inline in main.ts's onSubmit handler).
async handleSessionEnd(): Promise<SessionEndResult> {
  const state = this.store.getState();

  // Step 1: Progress Advisor (agent) -> guardrails (core) -> FINAL recommendation.
  const advisorResult = await callProgressAdvisor({
    topicStats: state.topicStats,
    wordStats: state.wordStats,
    exerciseTypeStats: state.exerciseTypeStats,
    currentDifficultyMode: state.studentProfile.difficultyMode,
  });
  const finalDifficulty = applyDifficultyGuardrails(
    state.studentProfile.difficultyMode,
    advisorResult.suggestedDifficulty, // agent's raw suggestion, ONE input only
    { correctStreak: state.currentCorrectStreak, recentErrors: /* derive from topicStats/exerciseStats */ },
  );
  const confidenceScore = computeConfidenceScore(state); // pure, SPEC §12 formula

  // Step 2: Parent Report Generator — receives the FINAL (core-decided) recommendation,
  // never the agent's raw suggestion (D-07's literal reading of SPEC §8.4's
  // "снимок урока + рекомендация").
  const reportResult = await callParentReportGenerator({
    exercisesCompleted: Object.keys(state.exerciseStats).length,
    correctCount: /* derive */,
    strugglingTopics: /* topicStats entries with status needs_review */,
    reviewTopics: state.reviewQueue,
    rublesEarned: state.currentRewards,
    recommendation: advisorResult.recommendedFocus, // FINAL, not raw
  });

  // ONE dispatch folds both results (mirrors the single-dispatch invariant
  // from exercise_attempt/theory_step — no two dispatches for one user-visible event).
  this.store.dispatch({
    type: "session_end",
    confidenceScore,
    difficultyMode: finalDifficulty,
    recommendedFocus: advisorResult.recommendedFocus,
    motivationalMessageRu: advisorResult.motivationalMessageRu,
    parentReportRu: reportResult.parentReportRu,
    headlineRu: reportResult.headlineRu,
    progressAdvisorSource: advisorResult.source,
    progressAdvisorFailed: advisorResult.source === "core",
    parentReportSource: reportResult.source,
    parentReportFailed: reportResult.source === "core",
  });

  return { /* whatever main.ts needs to render */ };
}
```
**UI side (mirrors Phase 3's thinking-cue pattern exactly):**
```typescript
// main.ts — in the lesson-complete else-branch, D-05/D-08
onSessionEnd: async () => {
  // Disable interaction before the await, thinking-cue shown, unsubscribe/
  // resubscribe around the async gap — EXACT same shape as onSubmit in
  // main.ts today (lines ~121-148).
  unsubscribeRender();
  try {
    await engine.handleSessionEnd();
  } finally {
    unsubscribeRender = store.subscribe(render);
  }
  render(store.getState());
}
```

### Pattern 3: Live Per-Answer Agent Call Without Breaking Single-Dispatch (Answers Technical Question 2)
**What:** Reward Advisor is called after `evaluateAttempt()` produces `rewardEvents[]` but BEFORE the existing single `exercise_attempt` dispatch — its result (a `praiseRu` string) is folded INTO that same dispatch, not a second dispatch.
**When to use:** `LessonEngine.handleAnswer`, only when `delta.rewardEvents.length > 0` (D-02: every answer that produces at least one reward event, including `honest_attempt`).
**Example:**
```typescript
// Inside LessonEngine.handleAnswer, AFTER evaluateAttempt() returns `delta`,
// BEFORE the existing store.dispatch({type: "exercise_attempt", ...}) call:
let praiseRu: string | undefined;
let rewardAdvisorSource: "core" | "agent" = "core";
let rewardAdvisorFailed = false;

if (delta.rewardEvents.length > 0) {
  // D-03: ONE call for the whole answer's reward events, not one call per event.
  const advisorResult = await callRewardAdvisor({
    rewardEvents: delta.rewardEvents, // full list from this one answer
    attemptNumber: priorAttempts + 1,
    rewardHistory: state.rewardHistory,
    currentCorrectStreak: state.currentCorrectStreak,
  });
  // Core validates: only use praise text if it corresponds to a reward
  // reason the core ALREADY decided to grant (REWARD-03's "core checks the
  // proposal" requirement) — reject any suggestedReasons not present in
  // delta.rewardEvents.map(e => e.reason).
  const grantedReasons = new Set(delta.rewardEvents.map((e) => e.reason));
  const trustedReasons = advisorResult.suggestedReasons?.filter((r) => grantedReasons.has(r)) ?? [];
  if (advisorResult.source === "agent" && trustedReasons.length > 0) {
    praiseRu = advisorResult.celebrationRu;
  }
  rewardAdvisorSource = advisorResult.source;
  rewardAdvisorFailed = advisorResult.source === "core";
}

// Existing dispatch, now carrying an additional optional field:
this.store.dispatch({
  type: "exercise_attempt",
  // ...all existing fields unchanged...
  praiseRu, // NEW optional field — undefined when no reward events or agent/validation failed
});
```
**Why this preserves the single-dispatch invariant:** exactly like `agentAttempted`/`agentFailed` already computed synchronously before the existing dispatch for Answer Checker (lines 169-240 of `lessonEngine.ts`), the new Reward Advisor await happens BEFORE the dispatch call, not as a second dispatch after it. This mirrors the EXACT shape already proven twice (Answer Checker in `handleAnswer`, Theory Tutor in `handleTheoryStep`) — no new orchestration model needed.

### Anti-Patterns to Avoid
- **Trusting `suggestedReasons`/`suggestedDifficulty` as the final value:** REWARD-03/PERSONAL-02 explicitly require the core to cross-check every agent suggestion against what it already independently decided (granted reward reasons; guardrail-computed difficulty). Never assign an agent field directly onto `studentProfile.difficultyMode` or use `suggestedReasons` to decide whether a reward is granted — that inverts "agent proposes, core writes."
- **One call per reward event instead of one call per answer (D-03):** would multiply live network calls unnecessarily (a single answer with 3 simultaneous reward events would otherwise trigger 3 agent calls) and contradicts SPEC §8.3's per-attempt framing.
- **Calling Progress Advisor and Parent Report Generator in parallel (`Promise.all`):** breaks D-07's data dependency — Parent Report's `recommendation` field must be the FINAL core-decided value, which does not exist until Progress Advisor's call (agent or fallback) has fully resolved.
- **A second/parallel dispatch path for session-end data:** violates the established "one save/render per user-visible event" discipline (Pitfall 3 from Phase 1-3) — fold everything (confidenceScore, difficultyMode, recommendation, report text) into ONE `session_end`-shaped dispatch.
- **Merging Progress Advisor + Parent Report Generator into one combined JSON contract for efficiency:** explicitly rejected by D-06 — breaks the "5 independent agent-functions" architectural boundary.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent call + retry + fallback + validation | A second/custom retry wrapper for the 3 new agents | The EXISTING `callAgent<T>()` from Phase 3, unchanged | It already implements validate -> retry-once -> fallback (RELY-01/02) and is proven by 2 prior agents; reimplementing risks subtle divergence (e.g. different timeout, different retry count) |
| JSON Schema for tool input | Hand-written JSON Schema literals per agent | `z.toJSONSchema(YourResponseSchema)` — already how `callAgent` derives `input_schema` | One Zod schema is both the runtime validator AND the JSON-schema source, per the established Pattern 1 from Phase 3 |
| Difficulty-mode state machine | An ad hoc if/else chain scattered across `lessonEngine.ts` | A single pure function `applyDifficultyGuardrails(current, suggested, signals)` returning the next mode, unit-tested in isolation (mirrors `nextTopicStatus()`'s existing pattern in `topicStatusMachine.ts`) | Keeps the guardrail logic testable and auditable in one place, exactly like the topic-status FSM; PERSONAL-02's correctness is easiest to verify (and grade) as one small pure function with its own test file |
| `confidenceScore` formula | Reimplementing `clamp` inline in multiple places | One small exported `clamp(value, min, max)` helper (or inline once in `confidenceScore.ts`) reused wherever needed | SPEC §12 fixes the exact formula (`clamp(correctRatio + 0.05*streak - 0.1*errorsInARow, 0, 1)`) — a single pure function makes this independently unit-testable against known input/output pairs |

**Key insight:** Every "don't hand-roll" item in this phase is really "don't deviate from the pattern the codebase already established in Phase 1-3." There is no external library gap here — the risk in this phase is architectural drift (a second retry mechanism, a second dispatch path, an agent value bypassing the guardrail), not missing tooling.

## Runtime State Inventory

Not applicable — this phase is not a rename/refactor/migration phase. It is additive schema/feature work on a project with a single `localStorage` key and no external services, OS-registered state, or build artifacts tied to renamed identifiers. Skipped per the trigger condition in the research protocol.

## Common Pitfalls

### Pitfall 1: Schema growth breaking existing saved progress
**What goes wrong:** Adding required (non-optional) fields to `StudentProfileSchema`/`ProgressStateSchema` (`confidenceScore`, `difficultyMode`, `lastRecommendedFocus`, `motivationSignals`, `wordStats`, `exerciseTypeStats`) means any `localStorage` blob saved before this phase's schema change will fail `StoredBlobSchema.safeParse()` in `persistence.ts`.
**Why it happens:** `persistence.ts`'s `load()` already handles this correctly (`safeParse` failure -> `initialState(currentLessonId)`), but only IF the new fields are added as REQUIRED to match every other field's established discipline. If a developer instead makes them `.optional()` "to be safe," partial/stale state can silently persist without the new personalization fields ever initializing.
**How to avoid:** Follow the exact established discipline in `progressSchema.ts`'s comments: "All new fields are required (no defaults) so a legacy blob missing them resets via load()." Add the new fields as required, and update `initialState.ts` to seed sensible defaults (e.g., `confidenceScore: 0`, `difficultyMode: "normal"`, `lastRecommendedFocus: null`/`""`, `motivationSignals: []`, `wordStats: {}`, `exerciseTypeStats: {}`).
**Warning signs:** Existing tests in `tests/core/state/persistence.test.ts` and `tests/core/state/progressSchema.test.ts` should be extended to assert a pre-Phase-4-shaped blob resets to fresh state rather than partially validating.

### Pitfall 2: `difficultyMode` guardrail edge cases (no easy/challenge content exists)
**What goes wrong:** Because D-09/D-10 explicitly state there is no observable in-session effect of `difficultyMode` in this MVP (only 1 lesson, no content variants), it is tempting to under-test the guardrail function ("it doesn't do anything visible anyway"). But PERSONAL-02 is a REQUIRED, graded criterion regardless of whether the effect is visible.
**Why it happens:** The guardrail's correctness (no easy->challenge jump, up only after 3-correct-streak, down only after 2 errors, changes only between lessons/at session-end) is exactly the kind of rule that "looks right" on the happy path but has subtle edge cases (e.g., what happens when the agent suggests `easy` while current mode is already `easy`? What if `currentCorrectStreak` at session-end is exactly 3 but achieved across DIFFERENT topics, not a true global session streak?).
**How to avoid:** Write the guardrail as a small pure function with an exhaustive unit-test matrix (mirrors `topicStatusMachine.test.ts`'s existing table-style test structure) covering: same-mode no-op, one-step-up allowed, one-step-down allowed, two-step jump blocked in both directions, and the "no signal / insufficient streak or errors" no-change case.
**Warning signs:** A guardrail implementation that directly returns the agent's `suggestedDifficulty` in any code path without checking the current mode first.

### Pitfall 3: Reward Advisor's suggested reasons not matching core-granted reasons
**What goes wrong:** REWARD-03 requires "ядро проверяет предложение" (core validates the suggestion) — if the Reward Advisor agent hallucinates or suggests a `reason` value that isn't actually one of the reasons `computeRewardEvents()` granted for THIS answer (e.g. it suggests `streak_bonus` when no streak fired), naively using its `celebrationRu` text would present praise for something that didn't happen.
**Why it happens:** The agent only sees `delta.rewardEvents` as read-only input context but is not itself a source of truth — a strict-tool-use JSON contract constrains the VALUE SET (Zod enum) but not whether the specific suggested reason actually applies to this specific answer.
**How to avoid:** Cross-check `advisorResult.suggestedReasons` (or equivalent field) against `delta.rewardEvents.map(e => e.reason)` before using `celebrationRu` — if there's no overlap, treat it the same as an agent failure (no praise line shown, banner just shows the deterministic correct/incorrect verdict), per D-04.
**Warning signs:** Missing test case for "agent suggests a reason that wasn't actually granted this answer -> praise text is discarded."

### Pitfall 4: `wordStats` update loop assuming exactly 1 word (violates D-12)
**What goes wrong:** Since 10/19 real exercises have exactly 1 `targetWords` entry and the 1 remaining `matching` exercise (`eq-1a-ex019`) has 8, an implementation that reads `targetWords[0]` only (instead of looping over the full array) will silently work for 9 exercises, subtly break for the 8-word matching exercise, and pass a naive manual test that only exercises `text-input` items.
**Why it happens:** Mirrors the EXACT same Phase 2 pitfall already documented for `topicImpact` (D-01) — the fix is proven and already implemented there; the same discipline must be copy-pasted to `wordStats`, not re-derived.
**How to avoid:** Loop `for (const word of exercise.targetWords)` exactly like `evaluateAttempt.ts`'s existing `for (const topic of exercise.topicImpact)` loop — same accumulator-first-fallback-to-state pattern (read from the in-progress `wordUpdates` accumulator first, fall back to `state.wordStats[word]` only on first iteration) to correctly handle any (currently theoretical, but schema-legal) duplicate word within one exercise's `targetWords`.
**Warning signs:** A test fixture with 2+ `targetWords` entries (the real `eq-1a-ex019` matching exercise, which DOES exist with 8 words) not being exercised in `wordStats` tests.

### Pitfall 5: `exerciseTypeStats` keying scheme choice
**What goes wrong:** Exercise `type` is a Zod discriminated-union literal (`"text-input" | "matching" | "single-choice" | "order-builder"`) — a naive `Record<string, ExerciseTypeStat>` keyed by this string is fine, but if the key type is declared as `Record<Exercise["type"], ExerciseTypeStat>` (all 4 keys required) instead of `Record<string, ExerciseTypeStat>` (sparse, like `topicStats`/`wordStats`), then `initialState()` MUST seed all 4 keys upfront or every downstream `.correct`/`.attempts` read on an unseen type will be `undefined`, unlike the established sparse-record pattern used for `topicStats`/`exerciseStats` (looked up with `?? DEFAULT_STAT` fallback).
**Why it happens:** `exerciseTypeStats` is naturally bounded to exactly 4 known values (unlike `topicStats`/`wordStats`, which are open-ended strings from lesson content) — this makes both a sparse-record-with-fallback AND a fully-seeded-record equally reasonable design choices, but they require DIFFERENT code at the read site (fallback-on-read vs. assume-always-present).
**How to avoid:** Pick ONE approach consistently. Sparse (`z.record(z.string(), ExerciseTypeStatSchema)` + `?? DEFAULT_EXERCISE_TYPE_STAT` fallback on read, same as `topicStats`) is the lower-risk choice because it requires zero change to `initialState()`'s seeding discipline and matches every other stats record in the codebase. This is left as Claude's Discretion per CONTEXT.md, but the RESEARCH recommendation is: sparse record, matching `topicStats`'s established shape, not a fully-keyed object.
**Warning signs:** A `Record<Exercise["type"], ...>` type declaration combined with a `?? DEFAULT` fallback read — this combination is redundant/contradictory (if all 4 keys are guaranteed present, the fallback is dead code; if not guaranteed, the type is a lie).

### Pitfall 6: Session-end UI hookup point ambiguity
**What goes wrong:** The trigger for `handleSessionEnd()` must fire EXACTLY ONCE, at the exact moment `main.ts`'s existing `else` branch (lesson-complete: `!exercise` after `getCurrentExercise()` returns null, per the current lesson-complete condition at line ~225) is reached — not on every re-render of that branch (which would fire the session-end agent calls repeatedly on any subsequent render, e.g. window resize triggering no render but a hypothetical future re-render path could).
**Why it happens:** Unlike `handleTheoryStep`/`handleAnswer`, which are triggered by explicit button clicks, the lesson-complete state is DERIVED (a rendering condition), not an explicit user action — there's no natural "onClick" to hang the async call off of without an explicit trigger.
**How to avoid:** Two established options exist in the codebase's own conventions: (a) a "Показать итоги" (show results) button the child taps at the lesson-complete screen, which THEN triggers `handleSessionEnd()` exactly once — consistent with the existing pattern of all async engine calls being gated behind an explicit button tap (theory buttons, submit button); OR (b) a state flag (e.g. `sessionEndTriggered: boolean` in memory, not persisted) checked before firing, guarding against double-invocation if the render function itself is called more than once for the same terminal state. Given D-08 already frames this as "a brief thinking-screen... mirrors Phase 3's disabled-buttons + thinking-cue pattern," option (a) — an explicit button — is the more consistent choice and avoids needing a new guard flag at all.
**Warning signs:** `handleSessionEnd()` invoked directly inside the `render()` function body (which runs on every `store.subscribe` callback) rather than behind an explicit user action.

## Code Examples

### Confidence Score (SPEC §12 formula, pure function)
```typescript
// src/core/personalization/confidenceScore.ts
// Source: SPEC.md §12 — "confidenceScore — простая формула ядра:
// clamp(correctRatio + 0.05*streak - 0.1*errorsInARow, 0, 1)"
export interface ConfidenceInputs {
  correctRatio: number;   // e.g. total correct / total attempts across the session
  streak: number;         // currentCorrectStreak at session end
  errorsInARow: number;   // consecutive incorrect answers immediately preceding session end
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeConfidenceScore(inputs: ConfidenceInputs): number {
  const { correctRatio, streak, errorsInARow } = inputs;
  return clamp(correctRatio + 0.05 * streak - 0.1 * errorsInARow, 0, 1);
}
```

### wordStats loop (mirrors topicImpact loop exactly, per D-12)
```typescript
// src/core/progress/evaluateAttempt.ts — extension pattern
// Source: existing topicImpact loop in this file (D-01 precedent), applied
// to targetWords per D-12.
const wordUpdates: Record<string, WordStat> = {};
for (const word of exercise.targetWords) {
  const prev = wordUpdates[word] ?? state.wordStats[word] ?? DEFAULT_WORD_STAT;
  wordUpdates[word] = {
    attempts: prev.attempts + 1,
    correct: prev.correct + (isCorrect ? 1 : 0),
    errors: prev.errors + (isCorrect ? 0 : 1),
  };
}
// Degenerates to a single update for 10/19 exercises (1 word each), loops
// 8 times for eq-1a-ex019 (the matching exercise) — never assume length <= 1.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — no prior implementation of Progress Advisor/Reward Advisor/Parent Report exists in this codebase | This phase builds all 3 from scratch, reusing Phase 3's gateway | Phase 4 (this phase) | First live implementation of "session-end sequential agent chaining" and "live per-answer non-blocking-of-amounts agent call" in this codebase |

**Deprecated/outdated:** Not applicable — no existing implementation to deprecate.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `errorsInARow` in the confidenceScore formula maps to "consecutive incorrect answers immediately preceding session end" (a session-global streak-of-misses counter that does not currently exist in the schema, distinct from per-topic `errors` which is a lifetime-accumulating count per `topicStatusMachine.ts`'s WR-03 note) | Code Examples / confidenceScore | If the planner instead reuses an existing counter (e.g. per-topic `errors`) that has different accumulation semantics (never resets, per WR-03), `confidenceScore` could produce a value that does not match SPEC's intent of "recent" errors-in-a-row; SPEC.md does not define this term precisely enough to derive it purely from existing state — recommend confirming with the user/CONTEXT before implementation whether a NEW session-global "consecutive incorrect" counter (mirroring `currentCorrectStreak`'s existing session-global pattern, but tracking misses instead) needs to be added to the schema |
| A2 | `correctRatio` maps to session-wide `totalCorrect / totalAttempts` across `exerciseStats`, not a per-topic or per-recent-window ratio | Code Examples / confidenceScore | If the intended ratio is windowed (e.g. last N attempts) rather than lifetime-session, the confidenceScore would over- or under-weight recent performance; low risk since SPEC's wording ("correctRatio") most naturally reads as a simple lifetime ratio, consistent with existing `exerciseStats` aggregation, but not explicitly pinned down in SPEC §12 |
| A3 | The end-of-session screen's report/recommendation text (`parentReportRu`, `motivationalMessageRu`, etc.) is treated as TRANSIENT (held in memory like `currentExplanation` in `main.ts`, not persisted to `localStorage`) — only `confidenceScore`/`difficultyMode`/`lastRecommendedFocus`/`motivationSignals` are persisted `studentProfile` fields per SPEC §12's explicit field list | Architecture Patterns Pattern 2 | If the planner instead persists the full report text into `localStorage`, a page reload after session-end would need to re-render the SAME report without re-calling the agents — this is a reasonable alternative design not explicitly ruled out by CONTEXT.md, but SPEC §12's `studentProfile` field list does NOT include report/recommendation TEXT fields, only `lastRecommendedFocus` (implying a short label/topic string, not full prose) — recommend the planner treat this as an open implementation decision, defaulting to transient-in-memory (matching the `currentExplanation` precedent) unless the user's intent is confirmed otherwise |
| A4 | `motivationSignals` (SPEC §12: "серия, использованные подсказки, исправления после подсказки, ошибки подряд, длинная сессия") is stored as a structured object/array of named signal values, not free text — exact shape left to planner per CONTEXT.md's explicit "Claude's Discretion" grant | Recommended Project Structure | Low risk — CONTEXT.md already defers this to planner/executor discretion explicitly, so no confirmation needed before planning, only before/during implementation |

## Open Questions (RESOLVED)

1. **RESOLVED — What is the precise session-scope definition of `errorsInARow` for the confidenceScore formula?**
   - What we know: SPEC §12 gives the formula verbatim; the schema currently has NO existing counter that directly represents "consecutive incorrect answers, session-global, resettable on any correct answer" (the closest existing counters — per-topic `errors` — accumulate for the topic's LIFETIME per `topicStatusMachine.ts`'s documented WR-03 semantics, and `currentCorrectStreak` tracks the OPPOSITE direction, resetting to 0 on any wrong answer).
   - What's unclear: Whether the planner should add a new schema field (e.g. `currentErrorStreak`, mirroring `currentCorrectStreak`'s existing session-global pattern but for misses) or derive it read-only from `exerciseStats`/`topicStats` at session-end time without a new persisted field.
   - Recommendation: Add a new session-global `currentErrorStreak` counter (mirrors `currentCorrectStreak`'s exact shape/reset behavior) computed alongside it in `computeRewardEvents()`/`evaluateAttempt()` — this keeps the confidenceScore formula trivially correct and testable, avoids ambiguity, and is a small, low-risk, precedent-following addition. Flag to the user/planner for confirmation since it is a new field not explicitly named in CONTEXT.md's Decisions.

2. **RESOLVED (no action needed) — Does the session-end combined screen replace `main.ts`'s bare "Урок завершён!" for BOTH the main-pass-complete-with-non-empty-reviewQueue transition AND the fully-complete (reviewQueue empty) state, or only the latter?**
   - What we know: D-05 says the bare message is "replaced" by the combined screen; `getCurrentExercise()` already returns `null` only when BOTH the main sequence is done AND `reviewQueue` is empty (confirmed in `lessonEngine.ts`'s `getCurrentExerciseId()`), so the `else` branch in `main.ts` is ALREADY gated correctly (never shows prematurely while review items remain).
   - What's unclear: Nothing substantial — this is well-defined by existing code. Listed here only to confirm the planner doesn't need to re-derive the lesson-complete condition; it already exists and is correct.
   - Recommendation: No action needed — reuse the existing `!exercise` branch condition unchanged; only its CONTENTS need to change (per D-05).

## Environment Availability

Skipped — this phase has no new external tool/service/runtime dependencies beyond what Phase 1-3 already established (Node/npm/Vite/Vitest, all confirmed present and working by prior phases' passing test suites). The one external dependency (Anthropic-compatible LLM router via `@anthropic-ai/sdk`, per `03-CONTEXT.md` D-03) is unchanged and already verified working in Phase 3.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x (jsdom environment, globals enabled) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm run test:core` (runs `vitest run tests/core`) |
| Full suite command | `npm test` (runs `vitest run`, includes `tests/e2e/*`) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERSONAL-01 | Progress Advisor returns recommendedFocus/suggestedDifficulty/reviewSuggestions/motivationalMessageRu/sessionAdvice from topicStats/wordStats/exerciseTypeStats input | unit | `vitest run tests/core/agents/progressAdvisor.test.ts` | ❌ Wave 0 |
| PERSONAL-02 | Guardrails block easy->challenge jump; only change between-lesson; up only after 3-correct-streak; down only after 2 errors | unit | `vitest run tests/core/personalization/difficultyGuardrails.test.ts` | ❌ Wave 0 |
| PERSONAL-03 | Progress Advisor unavailable -> session-end decision comes purely from threshold rules (no agent text) | unit | `vitest run tests/core/agents/progressAdvisor.test.ts` (failure-path case) | ❌ Wave 0 |
| REWARD-03 | Reward Advisor suggests reason/praise; core only uses praise matching an already-granted reason | unit + integration | `vitest run tests/core/agents/rewardAdvisor.test.ts` + `vitest run tests/core/lessonEngine.test.ts` | ❌ Wave 0 (schema/wrapper) + ✅ (lessonEngine.test.ts exists, needs new cases) |
| REWARD-04 | Reward Advisor unavailable -> fixed amounts still applied, no praise text | unit | `vitest run tests/core/agents/rewardAdvisor.test.ts` (failure-path case) | ❌ Wave 0 |
| REPORT-01 | Parent report shows exercises completed/correct/struggling topics/review topics/rubles/one recommendation | unit + e2e | `vitest run tests/core/agents/parentReportGenerator.test.ts` + `vitest run tests/e2e/` (session-end flow) | ❌ Wave 0 |
| REPORT-02 | Parent Report Generator unavailable -> template report renders same fields, no agent text | unit | `vitest run tests/core/agents/parentReportGenerator.test.ts` (failure-path case) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:core`
- **Per wave merge:** `npm test` (full suite including e2e)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/agents/progressAdvisorSchema.ts` companion schema + `tests/core/agents/progressAdvisor.test.ts` — mirrors `theoryTutor.test.ts` structure exactly (agent-success case, agent-failure-after-retry case, wrong-shape-rejected-by-Zod case)
- [ ] `tests/core/agents/rewardAdvisorSchema.ts` + `tests/core/agents/rewardAdvisor.test.ts` — same 3-case structure, PLUS a case for "agent suggests a reason not in the granted rewardEvents -> praise discarded"
- [ ] `tests/core/agents/parentReportGeneratorSchema.ts` + `tests/core/agents/parentReportGenerator.test.ts` — same 3-case structure
- [ ] `tests/core/personalization/confidenceScore.test.ts` — pure formula, table-driven test cases (mirrors `topicStatusMachine.test.ts`'s style)
- [ ] `tests/core/personalization/difficultyGuardrails.test.ts` — exhaustive transition matrix (same-mode no-op, 1-step-up, 1-step-down, 2-step-jump-blocked both directions, insufficient-signal no-change)
- [ ] `tests/core/progress/evaluateAttempt.test.ts` (EXTEND existing file) — add `wordStats` loop assertions using the real `eq-1a-ex019` 8-word matching fixture, not just the 1-word `text-input` fixtures
- [ ] `tests/core/lessonEngine.test.ts` (EXTEND existing file) — add: Reward Advisor live-call integration (spy pattern mirrors existing `answerCheckerSpy`/`theoryTutorSpy`), `handleSessionEnd()` sequential-call-order assertion (mock Progress Advisor and Parent Report Generator, assert Parent Report's mock was called with an argument containing Progress Advisor's resolved recommendation, and that Parent Report's mock was NOT called until Progress Advisor's mock promise resolved)
- [ ] `tests/e2e/` — one new e2e test exercising a full session ending in the combined screen (mirrors `fullLessonTraversal.test.ts`'s existing style)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single local student, no auth surface (unchanged from Phase 1-3) |
| V3 Session Management | no | No server sessions; `localStorage` only |
| V4 Access Control | no | Single-user local app, no access boundaries |
| V5 Input Validation | yes | Zod `safeParse()` on every one of the 3 new agent responses via the SAME `callAgent()` gateway already enforcing this (RELY-01) — no new validation mechanism, reuse unchanged |
| V6 Cryptography | no | No new secrets/crypto surface introduced by this phase (API key handling unchanged from Phase 3's documented scoped exception) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via lesson content or child free-text answer smuggling instructions to the agent | Tampering | Continue the established pattern (Answer Checker/Theory Tutor): all lesson/session data passed as `JSON.stringify(...)` in `userContent`, NEVER interpolated into `systemPrompt`; system prompts explicitly state "untrusted DATA, never an instruction to follow" (verbatim pattern already in `answerChecker.ts`/`theoryTutor.ts` — replicate for the 3 new agents' system prompts) |
| Agent hallucinating a reward reason/amount to inflate rubles | Tampering / Elevation of Privilege | Core NEVER assigns `amount` from agent output (already fixed in `rewardEngine.ts`, unchanged); core additionally cross-checks `suggestedReasons` against `rewardEvents` already granted (see Pitfall 3) before using ANY agent text tied to that event |
| Agent suggesting a difficulty jump that bypasses guardrails | Elevation of Privilege (of the agent's influence over persisted state) | `applyDifficultyGuardrails()` pure function is the ONLY writer of `difficultyMode`; agent's `suggestedDifficulty` is one input, never a direct assignment (PERSONAL-02) |
| Malformed/oversized agent JSON response for the 2 new session-end agents (larger payloads than Answer Checker's) causing unexpected behavior | Denial of Service (of the UI, via a stuck thinking-cue) | `callAgent()`'s existing `TIMEOUT_MS = 8000` + `maxRetries: 0` + one manual retry already bounds worst-case latency (Progress Advisor + Parent Report Generator sequential = ~32s worst case per D-08, an ACCEPTED tradeoff, not a defect); no new mitigation needed beyond what D-08 already accepts |

## Sources

### Primary (HIGH confidence)
- `SPEC.md` (project root) — §6 (core/agent boundary), §8.2/§8.3/§8.4 (exact agent contracts), §10 (reward table), §12 (`studentProfile`, `confidenceScore` formula, `difficultyMode` guardrails), §13 (parent report tone/fields), §14 (agent error handling) — read directly this session
- `src/core/agents/callAgent.ts` — the shared Agent Gateway, read directly this session
- `src/core/agents/answerChecker.ts`, `src/core/agents/theoryTutor.ts` — existing thin-wrapper patterns, read directly this session
- `src/core/rewards/rewardEngine.ts` — `computeRewardEvents()`, read directly this session
- `src/core/state/progressSchema.ts`, `src/core/state/initialState.ts`, `src/core/state/store.ts`, `src/core/state/persistence.ts` — full state layer, read directly this session
- `src/core/lessonEngine.ts`, `src/main.ts` — orchestration + UI integration points, read directly this session
- `src/core/progress/evaluateAttempt.ts`, `src/core/progress/topicStatusMachine.ts` — existing per-topic loop and FSM patterns (D-12's precedent), read directly this session
- `public/Lesson-1A.json` — real `targetWords` data, inspected directly this session (confirmed: 10/19 exercises have targetWords, 9 with exactly 1 word, `eq-1a-ex019` with 8 words)
- `.planning/phases/04-progress-advisor-reward-advisor-parent-report/04-CONTEXT.md` — 12 locked decisions (D-01..D-12), read directly this session
- `npm view @anthropic-ai/sdk version` / `npm view zod version` — confirmed current registry versions (0.110.0 / 4.4.3) against installed (`^0.109.1` / `^0.4.4.0`) — [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
None — no external documentation lookups were needed or performed; all web-search providers are disabled in `.planning/config.json` for this project, and this phase requires zero new external libraries or APIs beyond what Phase 1-3 already integrated and documented in the codebase itself.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; existing installed versions confirmed current via `npm view`
- Architecture: HIGH — directly extends 2 proven prior-phase patterns (Agent Gateway thin-wrapper, single-dispatch invariant), verified by reading the actual source files this session
- Pitfalls: HIGH — derived directly from existing code comments/discipline (WR-02, WR-03, D-01, D-12 precedents already documented in the codebase) plus explicit CONTEXT.md decisions, not speculative

**Research date:** 2026-07-03
**Valid until:** 30 days (stable internal codebase extension, no fast-moving external dependency)

