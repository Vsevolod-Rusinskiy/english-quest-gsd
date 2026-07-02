# Phase 2: Progress Tracking, Review Queue & Reward Engine - Research

**Researched:** 2026-07-02
**Domain:** Deterministic state-machine / rule-engine logic extending an existing Zod + TypeScript core (no new libraries, no I/O, no agents)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Topic Key & Multi-Topic Exercises**
- **D-01:** `topicStats` is keyed by the raw topic strings found in `exercise.topicImpact[]` across the lesson (e.g. `present_continuous_now`, `present_simple_negative`). On every `exercise_attempt` event, the core loops over `topicImpact` and applies the same correct/incorrect update to every topic's counters — no topic is privileged as "primary". Verified against real `public/Lesson-1A.json`: all 19 exercises currently have exactly 1 `topicImpact` entry, so this loop degenerates to a single update per attempt in practice today, but the implementation must not assume length-1 (schema allows more).

**Review Queue Population & Consumption**
- **D-02:** When a topic's status flips to `Повторить` (2+ errors on that topic), the core scans all lesson exercises whose `topicImpact` includes that topic AND that the child has not yet answered correctly in the current session, and enqueues their `exerciseId`s into `reviewQueue` (deduplicated — an exercise already in the queue isn't added twice). The child encounters `reviewQueue` exercises as a distinct pass appended after the main 19-exercise sequence finishes (extends `EXERCISE-05`'s progress indicator range for this phase: main sequence 1-19, then a review sub-sequence), not interleaved mid-lesson. Rationale: keeps Phase 1's linear `currentExerciseIndex` navigation model intact without needing mid-lesson re-ordering logic; matches the literal "ещё не пройденное в сессии" (not yet passed this session) requirement.
- Completing a `reviewQueue` item removes it from the queue (whether answered correctly or not — a wrong review-queue answer doesn't loop it back in immediately; it can be re-added by the normal 2+-error trigger if the topic re-accumulates errors).

**Reward De-duplication ("No Farming")**
- **D-03:** Before granting `honest_attempt`, `first_try_correct`, `correct_after_hint`, or `fixed_mistake` for a given exercise, the core checks whether a `rewardHistory` entry already exists with that exact `(exerciseId, reason)` pair; if so, the reward is skipped (already granted). This is the literal enforcement of "1 раз/задание" per reward reason.
- **D-04:** `streak_bonus` (+10₽ per SPEC §10) is a **session-global** correct-answer streak (not per-topic): a counter increments on every correct answer and resets to 0 on any incorrect answer. When it reaches 5, `streak_bonus` fires once and the counter resets to 0 (so a 10-correct-in-a-row session fires the bonus twice, at 5 and 10 — not continuously).
- **D-05:** `weak_topic_closed` (+15₽) fires once per topic, exactly when that topic's status transitions **into** `Выучено` (tracked via the topic-status state machine's own transition event, not a `rewardHistory` scan — a topic can only make that transition once per session in practice since there's no path back into `Повторить` after reaching `Выучено` within Phase 2's scope).
- Review-queue exercise completions flow through the **same** reward pipeline as main-sequence exercises (same `(exerciseId, reason)` dedup) — there is no separate reward path for review answers.

**Topic Status State Machine — Threshold Interpretation**
- **D-06:** The topic-status machine implements exactly the transitions SPEC.md §9 defines with concrete triggers: `Не изучено → В процессе` (first attempt on the topic), `В процессе → Повторить` (2+ errors on that topic), `Повторить → В процессе` (a correct answer on that topic while in `Повторить`, including via `reviewQueue`), `→ Выучено` (3 correct-in-a-row on that topic, evaluated from whatever status the topic is currently in — this is the single "advance" rule SPEC gives for both "усилить статус" and "приблизить к Выучено"). No separate "mini-training" artifact is built — 3+ errors is absorbed by the already-triggered `Повторить` status and growing `reviewQueue` membership; this avoids inventing UI/content scope that belongs to a later phase or isn't specified.
- Per-topic counters (`errors`, `correctStreak`) live in `topicStats` alongside the existing per-exercise `exerciseStats`, not replacing it — both are needed (exercise-level for review-queue eligibility checks, topic-level for the status machine).

### Claude's Discretion

- Exact `topicStats`/`reviewQueue` TypeScript shape and file layout (new module vs. extending `store.ts`) — left to planner/executor, informed by Phase 1's existing `progressSchema.ts` structure (this phase fills in the `topicStats: z.record(...)` and typed `reviewQueue: string[]` fields that currently exist only as `z.array(z.unknown())` placeholders).
- Whether `reviewQueue` stores full exercise objects or just `exerciseId` strings resolved against the loaded lesson at render time — planner's call, but `exerciseId` strings keep the persisted blob smaller and avoid data duplication (Phase 1's `PERSIST-01` precedent stores IDs/indices, not full exercise objects).

### Deferred Ideas (OUT OF SCOPE)

- Full "мини-тренировка" (mini-training) mechanic for 3+ errors on a topic — SPEC.md doesn't define a concrete UI/content mechanic beyond what `reviewQueue` already covers; if a richer mechanic is wanted later, it's a new capability, not a Phase 2 gray-area resolution (see D-06).
- `confidenceScore` formula and `difficultyMode` guardrails (SPEC.md §12) — these consume Phase 2's raw counters but are explicitly Phase 4 (Progress Advisor) scope, not this phase's.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROGRESS-01 | Ядро ведёт счётчики попыток/правильных/ошибок/серий по каждому упражнению | `exerciseStats` counters already exist from Phase 1 (unchanged); this phase adds the parallel per-topic `topicStats` counters (`attempts`/`correct`/`errors`/`correctStreak`) via the D-01 topic loop — see Architecture Patterns Pattern 1 and Code Examples `TopicStatSchema` |
| PROGRESS-02 | Ядро ведёт статус каждой темы по машине состояний (Не изучено → В процессе → Повторить → Выучено) на основе пороговых правил ошибок/успехов | Pattern 1 (`nextTopicStatus()`) implements the exact D-06 transition table; Wave 0 test gap `topicStatusMachine.test.ts` covers all 4 transitions |
| PROGRESS-03 | При 2+ ошибках по теме тема получает статус «Повторить», связанные задания добавляются в `reviewQueue` | Pattern 4 (`enqueueReviewItems()`) implements the D-02 scan-and-enqueue logic, triggered off the FSM's `entered_needs_review` transition signal |
| PROGRESS-04 | Ребёнок может пройти задания из `reviewQueue` в той же сессии | Pitfall 4 documents the review-pass cursor design constraint (distinct appended pass, not interleaved); Open Question 1 flags the exact `LessonEngine`/`CurrentPositionSchema` shape as a planner decision |
| REWARD-01 | Ядро начисляет фиксированные суммы рублей по правилам (`honest_attempt`, `first_try_correct`, `correct_after_hint`, `fixed_mistake`, `streak_bonus`, `weak_topic_closed`) с лимитами на упражнение | Pattern 2 (dedup) + Pattern 3 (session-global streak) + D-05's FSM-transition-triggered `weak_topic_closed`; Open Question 2 flags the `correct_after_hint` hint-tracking gap the planner must resolve |
| REWARD-02 | Ядро ведёт леджер начислений `rewardHistory` (`rewardEventId`, `reason`, `amount`, `attemptNumber`, `createdAt`) | `RewardEventSchema` in Code Examples defines the exact typed shape; `crypto.randomUUID()` recommended for `rewardEventId` (Don't Hand-Roll table) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Source | Relevance to Phase 2 |
|-----------|--------|----------------------|
| Числа и запись состояния только у ядра, агент предлагает суждение/текст, никогда не пишет числа напрямую | CLAUDE.md Constraints | Directly enforced by this phase: `topicStats`/`rewardHistory`/`reviewQueue` are 100% core-computed with zero agent involvement (Reward Advisor/Progress Advisor arrive Phase 4, layered on top, per CONTEXT.md phase boundary) |
| Хранение: только `localStorage`, один ключ `english-quest-progress-v1`, без бэкенда | CLAUDE.md Constraints | New fields extend the same single versioned blob under the same key — no new storage mechanism, no IndexedDB, no backend call |
| Отказоустойчивость: у каждого агента обязателен детерминированный fallback | CLAUDE.md Constraints | Not directly applicable — this phase has no agent calls at all, so there is no fallback to design here (fallback logic is Phase 3/4 scope for Answer Checker/Progress Advisor/Reward Advisor) |
| Vanilla TS + small hand-rolled render layer (no React/Vue/Svelte/Preact) | CLAUDE.md Technology Stack | Reinforces the "Don't Hand-Roll" table's `xstate` rejection — no framework dependency should be introduced for the topic-status FSM; plain TypeScript functions only |
| IndexedDB / Dexie / any client database library — avoid | CLAUDE.md What NOT to Use | Confirms `topicStats`/`rewardHistory`/`reviewQueue` must stay inside the single `ProgressState` object persisted via the existing `localStorage` blob, not a separate storage layer |
| Zod for runtime validation of every agent's JSON response / of the lesson file | CLAUDE.md Core Technologies | This phase has no agent responses to validate, but reuses the identical Zod `safeParse`-or-reset pattern for the new `ProgressState` fields, consistent with the project's single validation mechanism |

## Summary

Phase 2 adds zero new dependencies and zero new architectural layers. It is a pure extension of three already-proven Phase 1 patterns: the `ProgressStateSchema` (Zod), the `StateStore.dispatch`/`reduce`/synchronous-`save()` cycle, and `LessonEngine.handleAnswer` as the single integration point after a deterministic checker returns a verdict. The entire phase can be implemented as (a) three new Zod schemas (`TopicStatSchema`, `RewardEventSchema`, typed `reviewQueue`) replacing the current placeholder `z.unknown()`/`z.array(z.unknown())` fields, (b) a set of pure reducer-style functions that compute topic-status transitions and reward events from a `CheckResult` + exercise + current state, and (c) new `Action` variants (or an expanded `exercise_attempt` action) that `StateStore.reduce` folds into state, still inside the existing single synchronous `dispatch()` call.

The highest-risk area is not the tech stack (there is none to research) but **getting the state-machine transition table and reward-dedup logic exactly right against CONTEXT.md's D-01 through D-06**, since SPEC.md §9/§10 alone is ambiguous on several points already resolved by CONTEXT.md. This research therefore focuses on translating each locked decision into concrete Zod shapes, a concrete transition table, and a concrete integration sequence inside `handleAnswer`, rather than surveying alternative libraries (none apply here).

**Primary recommendation:** Extend `progressSchema.ts` with `TopicStatSchema` (`status`, `errors`, `correctStreak`, `attempts`, `correct`), `RewardEventSchema` (`rewardEventId`, `exerciseId`, `reason`, `amount`, `attemptNumber`, `createdAt`), and `reviewQueue: z.array(z.string())`; add a new `evaluateAttempt()` pure function (topic loop + status transitions + reward computation) called from `LessonEngine.handleAnswer` immediately after the existing checker call and folded into state via one enriched `exercise_attempt` dispatch (or a small ordered sequence of dispatches within the same synchronous `handleAnswer` call) — preserving Phase 1's "exactly one save() per user-facing action" invariant is about sequencing, not about a single dispatch call; see Pitfall 3 below for the precise rule.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-exercise attempt counters (`exerciseStats`) | Core (`src/core/state`) | — | Already implemented in Phase 1; Phase 2 reads but does not change this shape |
| Per-topic mastery counters (`topicStats`) | Core (`src/core/state` + new pure logic module) | — | Pure derived state from `topicImpact[]` + checker verdicts; no UI, no agent involvement per CONTEXT.md phase boundary |
| Topic-status state machine | Core (new pure function, e.g. `src/core/progress/topicStatusMachine.ts`) | — | Deterministic FSM per SPEC §9 + CONTEXT.md D-06; must be unit-testable in isolation from `StateStore` |
| Review queue population/consumption | Core (new pure function + `StateStore.reduce`) | UI (renderer reuse only) | Population logic is core; the UI only reuses Phase 1's existing exercise renderers unchanged to *display* review items — no new rendering tier work in this phase |
| Reward computation + dedup ledger | Core (new pure function, e.g. `src/core/rewards/rewardEngine.ts`) | — | Fixed-rule ledger, no agent (Reward Advisor is Phase 4); dedup logic must be pure and testable against `rewardHistory` |
| Persistence of new fields | Core (`persistence.ts`/`progressSchema.ts`) | — | Extends the existing versioned-blob pattern; no new storage mechanism |
| Progress-indicator range extension (main 1-19 then review sub-sequence) | UI (`ProgressIndicator.ts`) | Core (`LessonEngine` exposes review-queue position) | UI only renders whatever position/total the core computes — no new UI logic beyond consuming an extended range, per CONTEXT.md "Phase 2 is logic-only" |

## Standard Stack

### Core

No new libraries. This phase extends the existing stack unchanged:

| Library | Version (verified installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.4.3 `[VERIFIED: package.json + npm view]` | New `TopicStatSchema`/`RewardEventSchema`/typed `reviewQueue` on `ProgressStateSchema` | Same validation pattern Phase 1 already established (`safeParse`-or-reset); no reason to introduce a second validation approach |
| typescript | 6.0.x `[VERIFIED: package.json]` | Typed reducer functions, discriminated `Action` union extension | Continues Phase 1's typed-core pattern |
| vitest | 4.1.x `[VERIFIED: package.json]` | Unit tests for the state machine and reward engine (pure functions, no DOM needed) | Same test runner already wired; these are the easiest, highest-value tests in the whole project since the logic is 100% pure functions |

### Supporting

None needed — no new supporting libraries for this phase.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled topic-status FSM (plain TypeScript switch/if-chain) | A generic FSM library (e.g. `xstate`) | Not warranted: the FSM has exactly 4 states and 4 literal transitions, fully specified by CONTEXT.md D-06. `xstate`'s actor model, visualizer, and hierarchical states solve problems this phase does not have, and would be the first framework dependency introduced purely for a project explicitly avoiding "framework magic" per CLAUDE.md's stated thesis-architecture goal. A plain function `nextTopicStatus(current, event): TopicStatus` is simpler, obviously correct, and trivially unit-testable with a table-driven test. |
| Reward dedup via `Set<string>` key lookup in `rewardHistory` | A dedicated event-sourcing/ledger library | Not warranted: `rewardHistory` is already an append-only array (established by Phase 1's placeholder field and SPEC §10's literal "леджер"); a `.some(e => e.exerciseId === X && e.reason === Y)` scan (or a derived `Set` for O(1) lookup, given max ~26 actions per session) is sufficient at this data scale. |

**Installation:**
No install step — zero new packages for this phase.

**Version verification:** `npm view zod version` returns `4.4.3` on `[VERIFIED: npm registry]` `[date: 2026-07-02]`, matching the already-pinned `^4.4.0` in `package.json`. `npm view typescript version` / `npm view vitest version` were not re-queried since Phase 1 already pinned and verified these; no phase 2 work touches their major versions.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. All work extends existing Zod schemas and existing TypeScript modules already present from Phase 1.

## Architecture Patterns

### System Architecture Diagram

```
User answers an exercise (any of 4 types)
        │
        ▼
LessonEngine.handleAnswer(exerciseId, answer)
        │
        ├─▶ [existing, unchanged] checkTextInput / checkSingleChoice /
        │    checkMatching / checkOrderBuilder → CheckResult { isCorrect, source: "core" }
        │
        ▼
[NEW] evaluateAttempt(state, exercise, checkResult, attemptNumber)
        │
        ├─▶ loop over exercise.topicImpact[] (D-01)
        │      for each topic:
        │        ├─ update topicStats[topic].{attempts, correct, errors, correctStreak}
        │        ├─ run nextTopicStatus() FSM (D-06) → may emit a status-transition event
        │        │     (Не изучено→В процессе / →Повторить / →В процессе / →Выучено)
        │        └─ if transition == "→Повторить": scan lesson exercises whose
        │            topicImpact includes topic AND not-yet-correctly-answered
        │            this session → enqueue exerciseIds into reviewQueue (D-02, deduped)
        │
        ├─▶ computeRewardEvents(state, exercise, checkResult, attemptNumber, streakCounter)
        │      ├─ per-(exerciseId, reason) dedup against rewardHistory (D-03)
        │      ├─ session-global correct-answer streak counter (D-04) → streak_bonus at
        │      │   multiples of 5, resets on any incorrect answer
        │      └─ weak_topic_closed (+15₽) fired from the FSM's →Выучено transition
        │          event itself, NOT from a rewardHistory scan (D-05)
        │
        ▼
[NEW/EXTENDED] StateStore.dispatch({ type: "exercise_attempt", ...enriched payload })
        │  (single synchronous save() per Pitfall 3 below — see integration note)
        ▼
StateStore.reduce() folds: exerciseStats (unchanged Phase 1 logic) +
        topicStats + reviewQueue + currentRewards + rewardHistory
        │
        ▼
localStorage["english-quest-progress-v1"] (existing versioned-blob persistence, unchanged)
        │
        ▼
UI re-renders (ProgressIndicator extended range, existing renderers reused for
        reviewQueue pass — no new UI code, per CONTEXT.md phase boundary)
```

### Recommended Project Structure

```
src/core/
├── state/
│   ├── progressSchema.ts     # EXTEND: TopicStatSchema, RewardEventSchema, typed reviewQueue
│   ├── initialState.ts       # EXTEND: topicStats: {}, plus session-only streak counter (see Open Question 1)
│   └── store.ts              # EXTEND: Action union + reduce() cases for topic/reward updates
├── progress/                 # NEW module directory
│   └── topicStatusMachine.ts # NEW: nextTopicStatus(current, event) pure FSM (D-06)
├── rewards/                  # NEW module directory
│   └── rewardEngine.ts       # NEW: computeRewardEvents(...) pure function (D-03, D-04, D-05)
└── lessonEngine.ts           # EXTEND: handleAnswer calls evaluateAttempt() after checker, before dispatch
```

### Pattern 1: Table-driven topic-status FSM

**What:** A pure function taking the current `TopicStatus` and an `AttemptEvent` (correct/incorrect + current counters) and returning the next `TopicStatus` plus an optional `transition` tag (used to trigger `weak_topic_closed` and `reviewQueue` population as side-effect-free *signals*, not side effects themselves).
**When to use:** Every topic in `exercise.topicImpact[]`, on every attempt, looped per D-01.
**Example:**
```typescript
// Source: derived from SPEC.md §9 + CONTEXT.md D-06 (locked decision, not external doc)
export type TopicStatus = "not_started" | "in_progress" | "needs_review" | "mastered";

export interface TopicStatusResult {
  status: TopicStatus;
  transition: "entered_needs_review" | "entered_mastered" | null;
}

export function nextTopicStatus(
  current: TopicStatus,
  isCorrect: boolean,
  errorsAfterThisAttempt: number,
  correctStreakAfterThisAttempt: number,
): TopicStatusResult {
  // D-06's single "advance" rule: 3 correct-in-a-row from ANY current status -> mastered
  if (isCorrect && correctStreakAfterThisAttempt >= 3) {
    return {
      status: "mastered",
      transition: current !== "mastered" ? "entered_mastered" : null,
    };
  }
  if (current === "not_started") {
    return { status: "in_progress", transition: null };
  }
  if (!isCorrect && errorsAfterThisAttempt >= 2) {
    return {
      status: "needs_review",
      transition: current !== "needs_review" ? "entered_needs_review" : null,
    };
  }
  if (current === "needs_review" && isCorrect) {
    // D-06: a correct answer while in needs_review moves back to in_progress
    // (unless the 3-correct-streak branch above already fired mastered)
    return { status: "in_progress", transition: null };
  }
  return { status: current, transition: null };
}
```

### Pattern 2: Reward dedup via `(exerciseId, reason)` pair lookup

**What:** Before granting a per-exercise reward, scan `rewardHistory` for an existing entry with the identical `(exerciseId, reason)` pair.
**When to use:** For all four per-exercise reward reasons (`honest_attempt`, `first_try_correct`, `correct_after_hint`, `fixed_mistake`) per D-03. `streak_bonus` and `weak_topic_closed` use different triggers (D-04, D-05), not this dedup path.
**Example:**
```typescript
// Source: CONTEXT.md D-03 (locked decision)
function alreadyGranted(
  rewardHistory: RewardEvent[],
  exerciseId: string,
  reason: RewardReason,
): boolean {
  return rewardHistory.some((r) => r.exerciseId === exerciseId && r.reason === reason);
}
```

### Pattern 3: Session-global streak counter as ProgressState, not a closure

**What:** D-04's streak counter must survive across `dispatch()` calls (it is not per-topic, not per-exercise) and must persist correctly if the phase's reward logic needs it after a reload — store it as a small numeric field in `ProgressState` (e.g. `currentCorrectStreak: number`), reset to 0 on any incorrect answer, incremented on every correct answer, with `streak_bonus` firing (and the counter resetting to 0) whenever it reaches 5.
**When to use:** Session-global streak tracking (D-04). Do NOT confuse with per-topic `correctStreak` inside `topicStats[topic]` (used by the FSM's mastery rule) — these are two distinct counters with different scopes, both needed simultaneously per D-06's closing note ("both are needed").
**Example:**
```typescript
// Source: CONTEXT.md D-04 (locked decision)
// currentCorrectStreak lives at the top level of ProgressState, separate from
// topicStats[topic].correctStreak (per-topic, used only by the FSM's mastery rule).
if (isCorrect) {
  currentCorrectStreak += 1;
  if (currentCorrectStreak >= 5 && currentCorrectStreak % 5 === 0) {
    // fires at 5, 10, 15... — D-04's literal "fires once and resets" means the
    // simplest correct model is: fire + reset to 0 every time it HITS a multiple of 5
    rewardEvents.push({ reason: "streak_bonus", amount: 10, ... });
    currentCorrectStreak = 0; // reset immediately after firing, per D-04
  }
} else {
  currentCorrectStreak = 0;
}
```
Note: the `% 5 === 0` guard is redundant if you reset-to-0 immediately after firing (which D-04 mandates), but is shown here for clarity — the simpler and equally-correct implementation is just `if (currentCorrectStreak === 5) { fire(); currentCorrectStreak = 0; }` since the counter can never exceed 5 before firing once reset discipline is followed.

### Pattern 4: Review-queue population scan (D-02)

**What:** When a topic's FSM transition is `entered_needs_review`, scan **all** lesson exercises (not just the one just answered) whose `topicImpact` includes that topic, filter to those not yet answered correctly this session, and enqueue their `exerciseId`s (deduplicated against exercises already in `reviewQueue`).
**When to use:** Exactly once per FSM `entered_needs_review` transition event, per D-02.
**Example:**
```typescript
// Source: CONTEXT.md D-02 (locked decision)
function enqueueReviewItems(
  allExercises: Exercise[],
  topic: string,
  exerciseStats: Record<string, ExerciseStat>,
  currentQueue: string[],
): string[] {
  const eligible = allExercises
    .filter((ex) => ex.topicImpact.includes(topic))
    .filter((ex) => (exerciseStats[ex.exerciseId]?.correct ?? 0) === 0)
    .map((ex) => ex.exerciseId)
    .filter((id) => !currentQueue.includes(id));
  return [...currentQueue, ...eligible];
}
```
**Caveat:** "not yet answered correctly this session" is read from `exerciseStats[id].correct === 0`, which conflates "never attempted" with "attempted but always wrong so far" — both cases correctly belong in the review queue per the literal D-02 wording ("не пройденное в сессии" / "ещё не пройденное в сессии" = not yet passed, i.e., not yet correct), so this is the correct filter, not a shortcut.

### Anti-Patterns to Avoid

- **Deriving `weak_topic_closed` by scanning `rewardHistory` for prior grants:** D-05 explicitly rejects this — fire it directly off the FSM's `entered_mastered` transition signal in the same `evaluateAttempt()` pass, not as a separate post-hoc scan. Scanning `rewardHistory` for this reason is both unnecessary (the FSM already tells you the transition happened exactly once) and technically wrong if `topicStats` could ever exist without a corresponding `rewardHistory` entry (e.g. after a future schema migration).
- **Treating `reviewQueue` consumption as removing from the main exercise-index sequence:** Per D-02, `reviewQueue` is a *distinct appended pass* after the main 19, not an interleaved re-ordering of `currentExerciseIndex`. Do not attempt to splice review items into the main sequence array — extend `LessonEngine` with a second index/cursor concept (see Open Question 1) instead of mutating the main `exercises` array Phase 1 already established.
- **Firing `first_try_correct` and `correct_after_hint` both:** SPEC §10 explicitly states these are mutually exclusive. The dedup mechanism (D-03) does not by itself prevent granting *both* different reasons for the same exercise in the same attempt — `evaluateAttempt()`'s reward-selection logic must pick exactly one of these two reasons per exercise (based on attempt number / hint-shown state), not just dedup against re-granting the same reason twice.
- **Re-adding a wrong review-queue answer immediately:** Per D-02's closing note, a wrong answer on a `reviewQueue` item removes it from the queue and does NOT immediately re-add it — it can only re-enter via the normal 2+-error FSM trigger re-accumulating on that topic. Do not special-case "still wrong → keep in queue" logic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime shape validation of new `topicStats`/`rewardHistory`/`reviewQueue` fields | Custom type-guard functions (`isTopicStat(x): x is TopicStat`) | Zod schemas (`TopicStatSchema`, `RewardEventSchema`) composed into the existing `ProgressStateSchema` | Already the established Phase 1 pattern (Pattern 2 from 01-RESEARCH.md); a parallel hand-written validator would be inconsistent and duplicate the `safeParse`-or-reset persistence contract |
| Unique reward-event IDs (`rewardEventId`) | A UUID library or hand-rolled counter with collision risk | `crypto.randomUUID()` (native browser/Node API, zero dependency, available in all target environments — Vite dev server, modern browsers, Vitest/jsdom) | No new package needed; `crypto.randomUUID()` is standard and sufficient for a single-session, single-device, non-distributed ID need. Do NOT add a `uuid` npm package for this — it would be the first new runtime dependency introduced for a problem the platform already solves natively. |

**Key insight:** Every "don't hand-roll" temptation in this phase (state machines, event IDs, dedup ledgers) has a solution that's either already in the codebase (Zod) or already in the JS runtime (`crypto.randomUUID`) — this phase should add exactly zero new npm dependencies.

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase. Phase 2 adds new fields to an existing schema and new pure-function modules; it does not rename or restructure any existing stored keys, external service configuration, OS-registered state, secrets, or build artifacts. The only "migration" concern is schema-shape compatibility for already-persisted `localStorage` blobs, covered under Common Pitfalls below (Pitfall 1).

## Common Pitfalls

### Pitfall 1: Breaking existing persisted state for users who played through Phase 1 only

**What goes wrong:** Phase 1 already ships `topicStats`-adjacent placeholder fields as `z.array(z.unknown())` / not present at all (`topicStats` doesn't exist yet as a field name in `progressSchema.ts` — only `lessonHistory`, `rewardHistory`, `reviewQueue` exist as untyped placeholders). A `localStorage` blob saved by Phase 1 code will be missing the new `topicStats` and `currentCorrectStreak` fields entirely (not just have them as empty arrays).
**Why it happens:** Phase 1's `initialState()` doesn't set `topicStats` or `currentCorrectStreak` because those fields didn't exist yet.
**How to avoid:** Since `CURRENT_SCHEMA_VERSION` is still `1` in `persistence.ts` (no version bump documented in CONTEXT.md for this phase), a Phase-1-saved blob will fail `ProgressStateSchema.safeParse()` once the schema requires `topicStats`/`currentCorrectStreak`, and `load()` will correctly reset to `initialState()` per the existing defensive-read pattern — this is actually the **desired** and already-built behavior (no data migration needed, Phase 1 test data doesn't need to survive into Phase 2 for a diploma MVP). Confirm this is the intended behavior during planning (it matches Phase 1's own precedent of resetting on any shape mismatch) rather than assuming a silent default-fill is needed. If default-fill (not reset) is preferred instead, use `.default()` on the new Zod fields — but this contradicts the project's established "no partial/inconsistent state" philosophy, so reset-on-mismatch is the recommended approach, consistent with Phase 1.
**Warning signs:** A test that saves a Phase-1-shaped blob and expects Phase 2 code to silently fill in `topicStats: {}` rather than resetting — this would be inconsistent with the existing `persistence.test.ts` pattern (`schemaVersion` mismatch → reset).

### Pitfall 2: Looping `topicImpact[]` but only updating the first topic

**What goes wrong:** Writing `const topic = exercise.topicImpact[0]` instead of `for (const topic of exercise.topicImpact)` — silently correct against today's real `Lesson-1A.json` (all 19 exercises have exactly 1 topic) but wrong per D-01's explicit instruction and wrong the moment any future lesson content has a multi-topic exercise.
**Why it happens:** The temptation to "simplify" against observed real data, ignoring the schema's actual cardinality (`topicImpact: z.array(z.string())`, not `z.string()`).
**How to avoid:** Always loop; write at least one unit test with a hand-authored fixture exercise carrying 2 `topicImpact` entries (mirroring Phase 1's own precedent of hand-authoring fixtures for schema-valid-but-not-in-real-data cases — see `01-02-SUMMARY.md`'s Pitfall-1 closure for `single-choice`/`order-builder` fixtures).
**Warning signs:** No test in the suite ever exercises a multi-topic `topicImpact[]` array — if grep for `topicImpact.*,.*"` (two+ entries) in test fixtures returns nothing, this pitfall likely wasn't caught.

### Pitfall 3: Violating Phase 1's "exactly one save() per dispatch" invariant when multiple state slices update from one answer

**What goes wrong:** A single answer can now trigger up to 4 conceptually distinct updates in one user action: (1) `exerciseStats` update (existing), (2) `topicStats` update + possible FSM transition, (3) `reviewQueue` mutation, (4) one or more `rewardHistory` entries + `currentRewards` balance change. Phase 1's `StateStore.dispatch()` calls `save()` synchronously exactly once per `dispatch()` call (D-03, verified by `persistence.test.ts`'s "dispatch triggers exactly one save() per dispatch" test). If Phase 2 code calls `store.dispatch()` four separate times for one answer (once per concern), it violates the spirit of that invariant even though each individual call still calls `save()` exactly once for itself — this creates 4 separate `localStorage.setItem` writes for what the user experiences as a single action, and 4 separate `subscribe()` listener notifications (causing 4 UI re-renders per answer instead of 1).
**Why it happens:** Natural tendency to add one `Action` variant per new concern (`topic_status_updated`, `review_queue_updated`, `reward_granted`) and dispatch each separately, mirroring how the concerns were designed conceptually.
**How to avoid:** Compute the *entire* Phase 2 update (topic loop + FSM transitions + reward events + reviewQueue mutation) as one pure function (`evaluateAttempt()`) that returns a single enriched payload, then extend the existing `exercise_attempt` action's payload (or add exactly one new action type, e.g. `attempt_evaluated`, carrying all four resulting deltas) and fold everything in a single `reduce()` branch, dispatched exactly once per `handleAnswer()` call — matching Phase 1's literal invariant (one dispatch = one save = one render per user-facing action). This is the single most important integration constraint from Phase 1 that Phase 2 must not violate.
**Warning signs:** `handleAnswer()` in `lessonEngine.ts` calling `this.store.dispatch(...)` more than twice per invocation (Phase 1's existing code already calls it twice — once for `exercise_attempt`, once for `advance_position` on correct — so Phase 2 should extend the *first* dispatch's payload, not add 3 more dispatch calls before/alongside the existing two).

### Pitfall 4: `advance_position` reduce case conflicting with review-queue "distinct pass" model

**What goes wrong:** The existing `advance_position` action increments `currentPosition.currentExerciseIndex` unconditionally past the main sequence. Per D-02, `reviewQueue` exercises are a *separate appended pass*, not part of the main `exercises` array — so `LessonEngine` needs a way to know "main sequence done, now serve reviewQueue items" without corrupting `currentExerciseIndex`'s meaning (which Phase 1's `ProgressIndicator` and persistence-resume logic already depend on).
**Why it happens:** The natural (wrong) shortcut is to append `reviewQueue` exercise objects onto the end of `this.exercises` in `LessonEngine`, which would make `currentExerciseIndex` overshoot past `totalExercises` in a way Phase 1's UAT already flagged as a gap (`01-UAT.md` Gap 2: "progress indicator overshoots to N+1 из N at lesson-complete") — compounding an already-known bug rather than fixing it.
<br>
**How to avoid:** Model the review pass as a second, explicit cursor (e.g. `currentPosition.reviewQueueIndex: number | null`, or derive "are we in the review pass" from `currentExerciseIndex >= totalExercises && reviewQueue.length > 0`), and have `LessonEngine` expose a `getCurrentExercise()`-style method that returns either the next main-sequence exercise or the next `reviewQueue` exercise, resolved by looking up the `exerciseId` string against `this.exercises`. This is a **design decision the planner must make explicitly** (see Open Question 1) — CONTEXT.md's Claude's Discretion section leaves exact shape open, but the constraint (main sequence untouched, review pass distinct) is locked by D-02.
**Warning signs:** Any code that does `this.exercises.push(...reviewExercises)` or otherwise mutates the `exercises` array built in the `LessonEngine` constructor.

### Pitfall 5: Reward for review-queue completions accidentally treated as a new exerciseId

**What goes wrong:** If review-queue items are ever represented as *copies* of the original exercise (new synthetic `exerciseId` like `${originalId}-review`) rather than the literal original `exerciseId` string, the reward dedup (D-03, keyed on `(exerciseId, reason)`) would incorrectly allow `first_try_correct` to be granted a second time for what's conceptually "the same task."
**Why it happens:** Tempting to give review attempts a distinct identity to track them separately in `lessonHistory`/analytics.
**How to avoid:** D-02's Claude's Discretion note already resolves this: `reviewQueue` stores plain `exerciseId` strings resolved against the loaded lesson, not synthetic copies — so a review-queue completion IS the same `exerciseId` flowing through the same `handleAnswer()`/`evaluateAttempt()`/reward-dedup path, per D-03's explicit closing line ("Review-queue exercise completions flow through the same reward pipeline... same dedup — there is no separate reward path"). Do not invent a `-review` suffix or wrapper ID.
**Warning signs:** Any `exerciseId` string in code that isn't a literal lookup key into `this.exercises`/`Lesson-1A.json`'s real IDs (e.g. `eq-1a-ex001`).

## Code Examples

### Extending `ProgressStateSchema` (Zod)

```typescript
// Source: extends src/core/state/progressSchema.ts (existing Phase 1 file, same conventions)
export const TopicStatusSchema = z.enum(["not_started", "in_progress", "needs_review", "mastered"]);

export const TopicStatSchema = z.object({
  status: TopicStatusSchema,
  attempts: z.number(),
  correct: z.number(),
  errors: z.number(),
  correctStreak: z.number(), // per-topic streak, distinct from session-global streak
});

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
  exerciseId: z.string().optional(), // absent for weak_topic_closed (topic-scoped, not exercise-scoped)
  relatedTopic: z.string().optional(),
  reason: RewardReasonSchema,
  amount: z.number(),
  attemptNumber: z.number(),
  createdAt: z.string(), // ISO timestamp, matches SPEC §10's createdAt field
});

// Extends the existing ProgressStateSchema object (do not replace unrelated fields):
export const ProgressStateSchema = z.object({
  studentProfile: StudentProfileSchema,
  lessonId: z.string().optional(),
  lessonHistory: z.array(z.unknown()), // unchanged, still not this phase's scope
  exerciseStats: z.record(z.string(), ExerciseStatSchema), // unchanged
  currentPosition: CurrentPositionSchema, // extend separately if review-pass cursor needed (see Open Question 1)
  currentRewards: z.number(), // unchanged type, now actively written
  rewardHistory: z.array(RewardEventSchema), // NOW TYPED (was z.array(z.unknown()))
  reviewQueue: z.array(z.string()), // NOW TYPED (was z.array(z.unknown())) — exerciseId strings per D-02 discretion
  topicStats: z.record(z.string(), TopicStatSchema), // NEW FIELD
  currentCorrectStreak: z.number(), // NEW FIELD — session-global streak counter (D-04)
});
```

### `crypto.randomUUID()` for `rewardEventId` — zero-dependency native API

```typescript
// Source: MDN Web Crypto API (standard, no package needed)
const rewardEventId = crypto.randomUUID(); // e.g. "3fa85f64-5717-4562-b3fc-2c963f66afa6"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A | N/A | N/A | This phase has no "old vs. new library approach" axis — it's pure application logic on an already-current stack, not a domain with evolving external tooling. |

**Deprecated/outdated:** None applicable.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `TopicStatus` string-literal values (`not_started`/`in_progress`/`needs_review`/`mastered`) are Claude's-discretion naming, not locked by CONTEXT.md or SPEC.md (which use Russian labels `Не изучено`/`В процессе`/`Повторить`/`Выучено` only as prose, not as a required enum wire-format) `[ASSUMED]` | Architecture Patterns, Code Examples | Low — if the planner/UI phase (Phase 5) expects the Russian strings as the actual stored enum values (e.g. for direct display without a lookup table), the FSM's return type would need matching literal values instead of English identifiers. Easy to rename before persistence ships since no user data exists yet. |
| A2 | `currentCorrectStreak` as a new top-level `ProgressState` field (not nested under `studentProfile` or a new `sessionState` object) `[ASSUMED]` | Pattern 3, Code Examples | Low — purely a schema organization choice; CONTEXT.md's Claude's Discretion section explicitly defers exact shape to the planner, so this is a reasonable default, not a risk to correctness. |
| A3 | `crypto.randomUUID()` is available in all target runtimes (Vite dev server via browser, Vitest via jsdom/Node) without a polyfill `[ASSUMED — should be spot-checked, not verified via tool this session]` | Don't Hand-Roll | Medium — if Vitest's jsdom environment or the target deployment browser lacks `crypto.randomUUID` (unlikely for any browser from the last ~4 years and Node 18+, per MDN baseline availability), reward event IDs would throw at runtime. Recommend the planner add one quick smoke test (`expect(typeof crypto.randomUUID).toBe("function")`) in Wave 0 rather than fully trusting this assumption. |
| A4 | Reset-on-schema-mismatch (not default-fill) is the correct behavior for Phase-1-shaped blobs missing `topicStats`/`currentCorrectStreak` `[ASSUMED]` | Pitfall 1 | Low for this MVP (no real user data to preserve across the Phase 1→2 boundary during development), but the planner should explicitly confirm this matches intent rather than silently inheriting it, since a production app would treat this as a breaking migration requiring more care. |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **How does `LessonEngine` expose "main sequence exercise" vs. "review-queue exercise" to the UI/`ExerciseScreen`, given `currentPosition.currentExerciseIndex` currently indexes only into the fixed 19-exercise main array?**
   - What we know: D-02 locks the *behavior* (distinct appended pass, no interleaving, no mutation of the main sequence) and explicitly says this "extends EXERCISE-05's progress indicator range." CONTEXT.md's Claude's Discretion section explicitly leaves exact TypeScript shape/file layout to the planner.
   - What's unclear: Whether to add a second index field to `CurrentPositionSchema` (e.g. `reviewQueueIndex: number | null`) vs. deriving "in review pass" purely from `currentExerciseIndex >= totalExercises && reviewQueue.length > 0` with no new persisted field at all.
   - Recommendation: The planner should decide during PLAN.md authoring, informed by Pitfall 4 above. A derived (non-persisted) approach is likely simpler and has less schema-versioning risk, but must handle the resume-after-reload case correctly (Phase 1's PERSIST-02 precedent) — if the review pass position needs to survive a reload mid-review-pass, an explicit persisted cursor is probably required rather than a fully-derived value, since "how many review items already consumed" isn't otherwise recoverable from `reviewQueue` alone (items are removed from the queue as consumed, so `reviewQueue.length` alone tells you what's left, which may actually be sufficient — the planner should verify this closes the resume case without an extra field).

2. **Exact reward-selection logic for `first_try_correct` vs. `correct_after_hint` vs. `fixed_mistake` (mutual exclusion + ordering, SPEC §10) is not fully re-derived in CONTEXT.md beyond the dedup mechanism.**
   - What we know: SPEC §10 states `first_try_correct` and `correct_after_hint` are mutually exclusive, and `fixed_mistake` only fires "after a previous incorrect" attempt. `honest_attempt` (+1₽) appears to fire on every attempt regardless of correctness (per SPEC §10's framing "reward for the learning action, not just a perfect answer").
   - What's unclear: Whether "hint shown" is tracked anywhere in current Phase 1 state (grep shows `hint` exists only as static lesson content — `HintSchema` on the `Exercise` type — with no runtime "was hint displayed to the child" tracking field in `ProgressState` yet). Phase 2's scope per CONTEXT.md's canonical refs doesn't mention adding hint-display tracking, but reward logic can't distinguish `correct_after_hint` from `first_try_correct` without knowing whether a hint was shown.
   - Recommendation: Flag for the planner — either (a) this phase needs a small `hintShown: boolean` per-exercise runtime flag (which would need a new `Action`/state field, arguably in scope since REWARD-01 explicitly names `correct_after_hint` as one of the phase's required reward reasons), or (b) hint-display UI doesn't exist yet at all in Phase 1/Phase 2 (no hint-trigger UI was built in Phase 1's renderers per the SUMMARY files reviewed), in which case `correct_after_hint` may be currently unreachable and the planner should decide whether to stub it as "never fires yet" (honest, matches Phase 1's "don't fake behavor" precedent) versus building minimal hint-tracking now. This is a genuine scope boundary question the planner must resolve, not a research gap that can be closed by more investigation — it depends on a product decision CONTEXT.md didn't explicitly address.

## Environment Availability

Not applicable — this phase has no new external dependencies (no new tools, services, runtimes, or CLIs). It runs entirely inside the already-verified Vite/TypeScript/Vitest/Zod toolchain from Phase 1.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x `[VERIFIED: package.json]` |
| Config file | `vite.config.ts` (Vitest reads Vite config; no separate `vitest.config.ts` per Phase 1's scaffold) |
| Quick run command | `npm run test:core` (runs `vitest run tests/core` — Phase 2 logic is 100% under `tests/core/`, no DOM needed) |
| Full suite command | `npm test` (`vitest run`, currently 68 tests across 15 files as of Phase 1 completion) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROGRESS-01 | Core maintains attempts/correct/errors/streak counters per exercise | unit | `npx vitest run tests/core/state/store.test.ts -t "exercise_attempt"` | ✅ (extend existing `store.test.ts` if present, else ❌ Wave 0 — see note below) |
| PROGRESS-02 | Topic status FSM transitions correctly per D-06's 4 rules | unit | `npx vitest run tests/core/progress/topicStatusMachine.test.ts` | ❌ Wave 0 |
| PROGRESS-03 | 2+ errors on a topic sets `needs_review` status AND enqueues related exercises into `reviewQueue` | unit | `npx vitest run tests/core/progress/reviewQueue.test.ts` | ❌ Wave 0 |
| PROGRESS-04 | Child can complete a `reviewQueue` item in the same session (dequeue on completion, regardless of correctness) | unit + e2e | `npx vitest run tests/e2e/reviewQueuePass.test.ts` | ❌ Wave 0 |
| REWARD-01 | Fixed reward amounts granted per rule, with per-exercise limits (dedup) | unit | `npx vitest run tests/core/rewards/rewardEngine.test.ts` | ❌ Wave 0 |
| REWARD-02 | `rewardHistory` ledger entries carry `rewardEventId`/`reason`/`amount`/`attemptNumber`/`createdAt` | unit | `npx vitest run tests/core/state/progressSchema.test.ts -t "RewardEventSchema"` | ❌ Wave 0 (or extend an existing schema test file if the planner finds one) |

Note: `tests/core/state/` currently has `persistence.test.ts` verified during research; check for a separate `store.test.ts` at planning time — none was directly read in this research pass, so its existence is unconfirmed (persistence.test.ts includes some `StateStore` dispatch tests inline, per the file read above).

### Sampling Rate
- **Per task commit:** `npm run test:core` (fast — no jsdom needed for pure-function logic)
- **Per wave merge:** `npm test` (full suite, including existing e2e files, to catch any regression in Phase 1's `handleAnswer` integration)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/progress/topicStatusMachine.test.ts` — table-driven test covering all 4 D-06 transitions + the "3 correct-in-a-row from any status" mastery rule + multi-topic-loop case (Pitfall 2)
- [ ] `tests/core/rewards/rewardEngine.test.ts` — covers dedup (D-03), session-global streak firing at 5/10/15 (D-04), `weak_topic_closed` firing exactly once off the FSM transition (D-05), and mutual-exclusion of `first_try_correct`/`correct_after_hint`
- [ ] `tests/core/progress/reviewQueue.test.ts` — covers population scan (D-02: multi-exercise-per-topic, dedup against already-queued items, exclusion of already-correctly-answered exercises) and consumption (dequeue-on-completion regardless of correctness, no immediate re-add)
- [ ] Extend `tests/core/state/progressSchema.test.ts` (or create if absent) — `TopicStatSchema`/`RewardEventSchema` validate correctly; a Phase-1-shaped legacy blob (missing `topicStats`/`currentCorrectStreak`) correctly resets via `load()` (Pitfall 1)
- [ ] Extend `tests/core/lessonEngine.test.ts` — `handleAnswer` calls `evaluateAttempt()` exactly once and dispatches exactly once (or a bounded, documented small number) per invocation (Pitfall 3 guard)
- [ ] No new framework install needed — all Wave 0 gaps are new test files using the existing Vitest setup

*(No existing test infrastructure gaps beyond new test files for new logic — the framework itself is fully set up from Phase 1.)*

## Security Domain

`security_enforcement` is enabled per `.planning/config.json` (`security_asvs_level: 1`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single-student, no-backend, no-auth MVP — unaffected by this phase (unchanged from Phase 1's disposition) |
| V3 Session Management | No | No server sessions; `localStorage` is the only "session" and Phase 1 already covers its threat model (versioned blob, safeParse-or-reset) |
| V4 Access Control | No | Single local user, no roles, no server — unaffected |
| V5 Input Validation | Yes | Zod `safeParse` on every `ProgressStateSchema` read from `localStorage` — Phase 2 extends the *shape* being validated (adds `TopicStatSchema`/`RewardEventSchema`) but reuses the exact same validation mechanism and trust boundary Phase 1 already established at `persistence.ts`'s `load()`. No new external input source is introduced (no network, no user-typed data feeds directly into `topicStats`/`rewardHistory` — those are entirely computed by core logic from already-validated exercise data and checker verdicts). |
| V6 Cryptography | No | `crypto.randomUUID()` usage here is for non-secret unique identifiers (reward event IDs), not for any cryptographic/security guarantee — no key material, no signing, no encryption in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reward-amount tampering via direct `localStorage` edit (e.g., child/parent manually editing `currentRewards` in devtools) | Tampering | Out of scope for MVP per SPEC.md's explicit no-backend, single-local-user, "just verify the mechanic" goal — this is a client-trusts-client architecture by design (documented tradeoff, not a gap to fix in Phase 2). Do not add anti-tamper logic (e.g., HMAC-signed state) — this would be scope creep against the explicit MVP boundary and Out-of-Scope table entries ("Серверная часть / бэкенд" is explicitly excluded). |
| Corrupt/malformed `topicStats`/`rewardHistory` shape causing an unhandled exception mid-lesson (breaking the "urok ne dolzhen lomat'sya" / lesson-must-not-break architectural promise) | Tampering / Denial of Service (local) | Same Zod `safeParse`-or-reset pattern Phase 1 already proved (`persistence.test.ts`'s corrupt-JSON and wrong-shape tests) — extends automatically to the new fields since they live on the same top-level `ProgressStateSchema`. No new mitigation code needed beyond correctly authoring the new Zod schemas as **required** (not optional/permissive) fields, so a malformed new field correctly triggers the existing reset-to-`initialState()` path rather than silently producing `undefined` deep in `topicStats` logic. |
| Reward "farming" (repeatedly re-triggering the same reward reason) | Tampering (gameplay-integrity, not security-critical) | D-03's `(exerciseId, reason)` dedup against `rewardHistory` — already the locked design; this research confirms no additional library or mechanism is needed beyond the array scan/derived Set pattern shown in Pattern 2 above. |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/02-progress-tracking-review-queue-reward-engine/02-CONTEXT.md` — all D-01 through D-06 locked decisions (this is the authoritative source for this phase's logic, not external docs, since the domain is pure project-specific application logic)
- `SPEC.md` §6, §7, §9, §10, §12 — read directly this session
- `src/core/state/progressSchema.ts`, `store.ts`, `lessonEngine.ts`, `persistence.ts`, `initialState.ts` — read directly this session, current as of Phase 1 completion
- `public/Lesson-1A.json` — inspected directly via Node script this session; confirmed all 19 exercises currently carry exactly 1 `topicImpact` entry each, across 8 distinct topic keys
- `package.json` — read directly; zod@^4.4.0 confirmed installed and matching `npm view zod version` = 4.4.3 `[VERIFIED: npm registry]`

### Secondary (MEDIUM confidence)
- `.planning/phases/01-deterministic-core-lesson-rendering-persistence/01-01-SUMMARY.md`, `01-02-SUMMARY.md`, `01-03-SUMMARY.md` — Phase 1's established patterns, decisions, and known-gaps (UAT deferred items) read directly this session

### Tertiary (LOW confidence)
- None used — this phase required no external web research; all necessary facts were available in the local codebase and project documents.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all versions directly verified against installed `package.json`/`npm view`
- Architecture: HIGH — directly derived from locked CONTEXT.md decisions (D-01 through D-06) and the actual, read source code of `StateStore`/`LessonEngine`/`progressSchema.ts`
- Pitfalls: HIGH — each pitfall is grounded in either a specific CONTEXT.md decision's literal wording or a specific already-documented Phase 1 gap (e.g., UAT Gap 2 progress-indicator overshoot)

**Research date:** 2026-07-02
**Valid until:** No external-facing expiry — this research has no dependency-version decay risk (zero new packages). Re-research only if CONTEXT.md decisions change or SPEC.md is amended.
