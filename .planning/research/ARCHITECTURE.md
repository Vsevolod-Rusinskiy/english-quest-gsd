# Architecture Research

**Domain:** Browser-only, no-backend educational web app with a deterministic core + LLM "function agent" boundary
**Researched:** 2026-07-01
**Confidence:** HIGH (architecture pattern is a well-established shape — client-side state store + strict output-validation boundary — verified against SPEC.md, Lesson-1A.json schema, and current LLM-integration best practice)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER (DOM)                         │
│  ┌────────────┐  ┌────────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │ TopBar     │  │ TheoryScreen    │  │ ExerciseCard  │  │ ParentReport│ │
│  │ (₽, prog.) │  │ (rule+example)  │  │ (4 renderers) │  │ Screen      │ │
│  └─────┬──────┘  └────────┬────────┘  └───────┬───────┘  └──────┬──────┘ │
│        │                  │                    │                 │       │
│        └──────────────────┴────── subscribe ───┴─────────────────┘       │
│                                    ↑ render(state)                       │
├────────────────────────────────────┴───────────────────────────────────┤
│                        DETERMINISTIC CORE (owns all state)               │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ LessonEngine (orchestrator / "controller")                       │   │
│  │  - drives pipeline: theory → exercises → review → report          │   │
│  │  - dispatches actions, calls checkers, calls agent gateway        │   │
│  └───────┬───────────────┬───────────────┬───────────────┬──────────┘   │
│          │               │               │               │              │
│  ┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼──────┐ ┌──────▼──────────┐  │
│  │ AnswerChecker│ │ ProgressRules│ │ RewardRules│ │ ReviewQueue      │  │
│  │ (normalize + │ │ (thresholds, │ │ (fixed     │ │ Manager          │  │
│  │  exact match)│ │  status FSM) │ │  amounts)  │ │                  │  │
│  └───────┬──────┘ └──────────────┘ └────────────┘ └──────────────────┘  │
│          │ (only when ambiguous)                                        │
│  ┌───────▼─────────────────────────────────────────────────────────┐   │
│  │              AGENT GATEWAY (the trust boundary)                  │   │
│  │  buildPrompt() → callLLM() → parseJSON() → validateSchema()      │   │
│  │  → validateSemantics() → retry-once-on-failure → fallback()      │   │
│  └───────┬────────┬────────┬────────┬────────┬──────────────────────┘   │
├──────────┼────────┼────────┼────────┼────────┼──────────────────────────┤
│  Answer  │Progress│ Reward │ Parent │ Theory  │   5 independent          │
│  Checker │Advisor │Advisor │ Report │ Tutor   │   single-shot LLM calls  │
├──────────┴────────┴────────┴────────┴─────────┴──────────────────────────┤
│                         PERSISTENCE LAYER                                │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ StateStore (in-memory object, single source of truth)           │    │
│  │  studentProfile · lessonHistory · topicStats · wordStats ·      │    │
│  │  exerciseTypeStats · currentRewards · rewardHistory ·           │    │
│  │  reviewQueue                                                    │    │
│  └───────────────────────────┬────────────────────────────────────┘    │
│                    save()/load() (debounced, JSON.stringify/parse)      │
│  ┌───────────────────────────▼────────────────────────────────────┐    │
│  │ localStorage["english-quest-progress-v1"]                       │    │
│  └───────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                     ┌────────────────────────────────┐
                     │ Lesson-1A.json (static, fetched │
                     │ once, read-only, never mutated) │
                     └────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| **LessonEngine (orchestrator)** | Drives the fixed pipeline (theory → exercises → review → reward → report); the *only* caller of the Agent Gateway; sequences state updates | Plain JS class/module with explicit step functions, no framework required |
| **StateStore** | Single in-memory source of truth for all mutable state; the only thing allowed to write `topicStats`/`rewardHistory`/etc.; notifies subscribers on change | Plain object + tiny pub/sub (`subscribe(fn)` / `emit()`), or a 40-line reducer function — do not reach for Redux/Zustand for this scope |
| **PersistenceAdapter** | Serializes StateStore to/from `localStorage` under the fixed key; owns schema versioning (`english-quest-progress-v1`) and corrupt-data recovery | `load()` on boot, `save()` after every state-mutating action (debounced ~300ms to avoid thrashing on rapid typing) |
| **LessonLoader** | Fetches/parses `Lesson-1A.json` once at boot; treated as immutable read-only reference data, never merged into StateStore | `fetch()` + `JSON.parse` + shape assertion at load time |
| **AnswerChecker (deterministic)** | Normalizes text (`lowercase/trim/collapseSpaces/stripFinalPunctuation`) and does exact-match / id-match / pair-match comparison for all 4 exercise types | Pure functions, no I/O, fully unit-testable |
| **ProgressRules** | Applies fixed thresholds (1 error → hint, 2 errors → Повторить + reviewQueue, 3 correct → status up) as a finite-state machine per topic | Pure function `applyAttempt(topicStats, attempt) -> topicStats'` |
| **RewardRules** | Computes reward amounts from the fixed table + limits; the *only* writer of `rewardHistory`/`currentRewards` | Pure function; agent output only supplies `reason` suggestions, never amounts |
| **ReviewQueueManager** | Builds/maintains `reviewQueue` from weak-topic detection; selects existing lesson exercises (no generation) | Pure function operating on `sections[]` + `topicStats` |
| **Agent Gateway (trust boundary)** | Single choke point every agent call passes through: build prompt → call LLM → parse JSON → validate schema → validate semantic constraints (enum membership, ranges) → on any failure, retry once → on second failure, invoke that agent's deterministic fallback | One shared `callAgent(agentName, input, schema, fallbackFn)` function reused by all 5 agents — this is the component that makes "core never trusts agent output" enforceable in one place instead of 5 |
| **5 Agent Adapters** (Answer Checker LLM path, Progress Advisor, Reward Advisor, Parent Report Generator, Theory Tutor) | Pure prompt-building + response-shape definition per agent; no shared state, no cross-agent calls | 5 small modules, each exporting `{buildPrompt(input), schema, fallback(input)}`, all routed through the same Agent Gateway |
| **Renderers (4 exercise types)** | Render `text-input`, `single-choice`, `matching`, `order-builder` from exercise JSON; emit user actions upward, never mutate state directly | Stateless render functions keyed by `exercise.type`; a small dispatch map, not a framework component tree |
| **ParentReportScreen** | Read-only view over `lessonHistory` snapshot + `Parent Report Generator` output (or its fallback) | Pure render function |

## Recommended Project Structure

```
src/
├── core/                       # deterministic core — zero LLM awareness, 100% unit-testable
│   ├── state/
│   │   ├── store.js             # StateStore: get/set/subscribe, single source of truth
│   │   ├── persistence.js       # load()/save() to localStorage, schema version guard
│   │   └── initialState.js      # default shape for a fresh studentProfile
│   ├── answer-checking/
│   │   ├── normalize.js         # text normalization rules
│   │   ├── checkTextInput.js
│   │   ├── checkSingleChoice.js
│   │   ├── checkMatching.js
│   │   └── checkOrderBuilder.js
│   ├── progress/
│   │   ├── topicStatusMachine.js  # Не изучено→В процессе→Повторить→Выучено
│   │   ├── confidenceScore.js
│   │   └── reviewQueue.js
│   ├── rewards/
│   │   └── rewardRules.js       # fixed table, limits, ledger writer
│   └── lessonEngine.js          # orchestrator: the pipeline from §17 of SPEC.md
├── agents/                      # LLM boundary — the only code that talks to an LLM
│   ├── gateway.js                # callAgent(): prompt→call→parse→validate→retry→fallback
│   ├── schemas/                  # JSON-schema-like validators per agent (hand-written or zod-lite)
│   │   ├── answerChecker.schema.js
│   │   ├── progressAdvisor.schema.js
│   │   ├── rewardAdvisor.schema.js
│   │   ├── parentReport.schema.js
│   │   └── theoryTutor.schema.js
│   ├── answerChecker.agent.js    # buildPrompt + fallback (strict compare, errorType: unknown)
│   ├── progressAdvisor.agent.js  # buildPrompt + fallback (threshold-only recommendation)
│   ├── rewardAdvisor.agent.js    # buildPrompt + fallback (core applies reward rules alone)
│   ├── parentReport.agent.js     # buildPrompt + fallback (templated report)
│   └── theoryTutor.agent.js      # buildPrompt + fallback (theory.explanationLevels)
├── lesson/
│   └── lessonLoader.js           # fetch + validate Lesson-1A.json against lesson-json-v1
├── ui/                            # presentation — reads state, emits events, never writes state
│   ├── screens/
│   │   ├── TheoryScreen.js
│   │   ├── ExerciseScreen.js
│   │   ├── ReviewScreen.js
│   │   └── ParentReportScreen.js
│   ├── exercise-renderers/
│   │   ├── textInput.js
│   │   ├── singleChoice.js
│   │   ├── matching.js
│   │   └── orderBuilder.js
│   └── components/
│       ├── TopBar.js              # rubли balance + progress "5 of 19"
│       └── FeedbackBanner.js      # correct/incorrect states
├── styles/
│   └── theme.css                  # Roblox-inspired: rounded, bright, blocky
└── main.js                         # boot: load lesson → load/init state → mount UI → subscribe

data/
└── Lesson-1A.json                  # static, read-only

tests/
├── core/                            # pure-function unit tests (majority of test effort)
└── agents/                          # gateway validation + fallback tests (mock LLM responses)
```

### Structure Rationale

- **`core/` has zero imports from `agents/` or `ui/`.** This is the load-bearing boundary from the milestone brief: the deterministic core must be independently testable and must never import LLM-calling code. `lessonEngine.js` is the only file in `core/` allowed to *call into* `agents/gateway.js` (dependency direction: core → agents, never agents → core, never ui → core state mutation directly).
- **`agents/gateway.js` is a single choke point, not 5 separate integrations.** Every one of the 5 agents is wired through the same `callAgent()` function so "validate before trust" and "retry once then fallback" are implemented and tested exactly once, not 5 times with drift risk.
- **Each agent file pairs its LLM path with its fallback in the same module.** This makes the fallback a first-class, reviewable artifact next to the prompt — not an afterthought bolted on later. It also means each agent is independently testable by calling `fallback(input)` directly with no network/mocking needed.
- **`ui/` only renders and emits events; it never mutates `core/state/store.js` directly.** All state changes flow through `lessonEngine.js` action handlers, keeping the "core owns all state" rule enforceable by convention + code review, not just by discipline.
- **No framework folder (`components/` in the React sense) is needed** — see Anti-Pattern 1. The structure above works equally with vanilla JS/DOM or a thin framework (Preact/Alpine/Svelte) if chosen later; the core/agents boundary is framework-agnostic by design.
- **`schemas/` is separated from the agent modules** so schema validation logic (used by the gateway) is reusable and testable independent of prompt text, and so a diploma reviewer can see the "contract" in one place per SPEC.md §14.

## Architectural Patterns

### Pattern 1: Agent Gateway as a single trust boundary ("propose, don't write")

**What:** Every one of the 5 agents is invoked through one shared function: `callAgent(agentId, input) → {result, source: 'agent'|'fallback'}`. Internally it does: build prompt → call LLM → parse JSON → validate against a schema (required fields, enum membership, type/range checks) → if valid, return `{result, source:'agent'}` → if invalid/timeout/malformed, retry once → if still invalid, call that agent's `fallback(input)` and return `{result, source:'fallback'}`. The core (`lessonEngine.js`, `rewardRules.js`, etc.) always applies its own rules on top of the agent's *suggestions* (e.g., Reward Advisor suggests a `reason`; only `rewardRules.js` decides the amount and writes the ledger).

**When to use:** Any time an LLM's output could affect numbers, persisted state, or anything shown as fact to the parent. This is the direct implementation of SPEC.md §6/§14 ("agent предлагает — ядро записывает" / "Ответ агента не доверенный, пока ядро не проверит").

**Trade-offs:** Adds one layer of indirection and a schema per agent to write/maintain, but this is exactly the mechanism that makes "core never trusts agent output without validation" verifiable rather than aspirational — and it is the part of the architecture explicitly being graded (per PROJECT.md Context).

**Example:**
```javascript
// agents/gateway.js
export async function callAgent(agentId, input, {buildPrompt, schema, fallback}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callLLM(buildPrompt(input));         // network boundary
      const parsed = JSON.parse(raw);                         // may throw
      const validated = validateSchema(parsed, schema);       // throws on shape/enum mismatch
      return { result: validated, source: 'agent', attempt };
    } catch (err) {
      logAgentFailure(agentId, attempt, err);                 // for debugging (§14)
    }
  }
  return { result: fallback(input), source: 'fallback' };
}

// core/rewards/rewardRules.js — core still decides amounts even with agent input
export function applyReward(state, { reason, amount }) {
  if (!ALLOWED_REASONS.includes(reason)) throw new Error('unknown reward reason');
  const rule = REWARD_TABLE[reason];               // amount ALWAYS from this table, never from agent
  if (limitReached(state, reason, currentExerciseId)) return state;
  return ledgerAppend(state, { reason, amount: rule.amount, ... });
}
```

### Pattern 2: Deterministic-first, agent-as-escalation (not agent-as-default)

**What:** For every decision that *can* be made deterministically, do it deterministically and only escalate to an agent on genuine ambiguity. This is explicit in SPEC.md §9: `text-input` exact match short-circuits before Answer Checker is ever called; `matching`/`single-choice`/`order-builder` never call an agent at all.

**When to use:** Every checkAnswer() call, every theory step. Escalate to LLM only when deterministic logic cannot resolve the case (near-miss text answer, "не понятно" theory request).

**Trade-offs:** Reduces LLM calls (cost, latency, flakiness surface) dramatically — most of the 19 exercises are `text-input` with a small `acceptedAnswers` list, so most attempts resolve without any network call. The cost is that the "deterministic-first" branching logic itself must be carefully tested (this is where an evaluator will look for correctness).

**Example:**
```javascript
// core/answer-checking/checkTextInput.js
export function checkTextInput(exercise, rawAnswer) {
  const normalized = normalize(rawAnswer, exercise.answerCheck.mode);
  if (exercise.answerCheck.acceptedAnswers.includes(normalized)) {
    return { isCorrect: true, source: 'core', errorType: null };
  }
  return { needsAgent: true };   // lessonEngine decides whether/how to call Answer Checker
}
```

### Pattern 3: Event-log-lite over the state store (structured `exercise_attempt` events)

**What:** Rather than mutating `topicStats`/`wordStats`/`rewardHistory` ad hoc from many call sites, every user answer produces one structured event object (`exercise_attempt`: exerciseId, attemptNumber, isCorrect, errorType, topicImpact, rewardEvents, source) as specified in SPEC.md §7. A single reducer-like function consumes that event and updates all derived state (`topicStats`, `wordStats`, `exerciseTypeStats`, `reviewQueue`, `rewardHistory`) in one place.

**When to use:** Any time one user action needs to update several statistics structures consistently (this project: almost always). It also directly feeds the Parent Report and Progress Advisor inputs without needing separate aggregation code.

**Trade-offs:** Slightly more ceremony than "just mutate the object inline," but pays for itself immediately: it's the natural shape for unit testing ("given this event, state goes from X to Y"), for the audit trail SPEC.md §14 requires (`source: core/agent`, failure flag), and for the diploma's testability goal.

**Example:**
```javascript
// core/lessonEngine.js (excerpt)
function handleAnswer(exercise, rawAnswer) {
  const verdict = checkAnswer(exercise, rawAnswer);         // core or agent+fallback, see Pattern 1&2
  const event = buildAttemptEvent(exercise, rawAnswer, verdict);
  store.dispatch('exercise_attempt', event);                 // single reducer updates all derived stats
  persistence.save(store.getState());                        // debounced
  render(store.getState());
}
```

## Data Flow

### Request Flow (answering one exercise)

```
[User types/selects/orders answer, clicks "Проверить"]
    ↓
[ExerciseScreen] → emits AnswerSubmitted(exerciseId, rawAnswer)
    ↓
[LessonEngine.handleAnswer]
    ↓
[core/answer-checking/*] — deterministic check first
    ↓ (only if ambiguous text-input)
[agents/gateway.callAgent('answerChecker', ...)] → LLM or fallback
    ↓
[verdict: {isCorrect, errorType, source}]
    ↓
[buildAttemptEvent] → [store.dispatch('exercise_attempt', event)]
    ↓                              ↓                    ↓
[topicStats' ]              [rewardHistory']     [reviewQueue']
    ↓ (all via one reducer, StateStore is the single source of truth)
[persistence.save() → localStorage["english-quest-progress-v1"]]
    ↓
[store notifies subscribers] → [UI re-renders: FeedbackBanner, TopBar balance, progress counter]
```

### State Management

```
localStorage (on boot)
    ↓ load()
StateStore (in-memory, single source of truth)
    ↓ subscribe(render)
UI screens/components  ←→  user events  →  LessonEngine action handlers
                                                 ↓
                                     StateStore.dispatch(event) — ONLY entry point for mutation
                                                 ↓
                                     persistence.save() (debounced) → localStorage
```

Agents never touch `StateStore` directly. An agent's output is always intercepted by the calling core function (`rewardRules.js`, `progressRules.js`, etc.), validated, and only the core-approved subset (e.g., a reward `amount` computed from the fixed table, not from the agent) is ever passed to `store.dispatch()`.

### Key Data Flows

1. **Exercise answer → stats/rewards/review update:** described above — this is the highest-frequency flow (up to 26 child actions per SPEC.md §Context) and should be the first flow implemented and tested, since almost everything else (progress, rewards, review, report) is derived from it.
2. **Theory step → Theory Tutor escalation:** `TheoryScreen` emits `understood: false` → `LessonEngine` increments a bounded counter (`maxSimplifyRounds`, capped at 3, owned by core) → if under cap, calls Agent Gateway for Theory Tutor; if at cap or agent fails, falls back to `theory.explanationLevels[next]` already present in `Lesson-1A.json`. No state persistence needed here beyond the round counter (ephemeral, resets each lesson run).
3. **End-of-lesson → Parent Report:** `LessonEngine` assembles a read-only snapshot from `lessonHistory`/`topicStats`/`rewardHistory` (no new mutation) → calls Agent Gateway for Parent Report Generator → renders `ParentReportScreen` from either the agent's `{parentReportRu, headlineRu}` or the templated fallback built from the same snapshot fields.
4. **Session progress → Progress Advisor:** After some threshold of attempts (or end of section), `LessonEngine` reads `topicStats`/`wordStats`/`exerciseTypeStats`/`difficultyMode` → calls Agent Gateway → applies the *guarded* recommendation (SPEC.md §12 guard rules: no easy→challenge jump, direction changes only between lessons) via a core function that clamps the agent's suggestion before writing `studentProfile.difficultyMode`.
5. **Boot flow:** `main.js` → `lessonLoader.js` fetches and validates `Lesson-1A.json` shape (fail loudly if malformed — this is authored data, not agent output, so no fallback needed) → `persistence.load()` reads `localStorage`, applies schema-version guard, initializes fresh `studentProfile` if absent/corrupt → mounts UI subscribed to `StateStore`.

## Scaling Considerations

This is a diploma MVP with 1 lesson, 19 exercises, 1 local user, no backend, no concurrency. "Scaling" here means scaling the *architecture*, not traffic.

| Scale | Architecture Adjustments |
|-------|---------------------------|
| MVP (this milestone): 1 lesson, 1 student, browser-only | Current design as-is: in-memory StateStore + localStorage, no framework required, no build step strictly necessary (though a lightweight bundler eases module imports across files) |
| Post-MVP: multiple lessons, multiple students (`studentId` no longer fixed) | `localStorage` key becomes namespaced per student or moves to `IndexedDB` (larger quota, structured queries); `lessonLoader` becomes a lesson *catalog* loader; core/agents boundary is unaffected — this is purely a persistence-layer change |
| Post-MVP: Exercise Generator agent, deeper multi-agent orchestration | The Agent Gateway pattern extends cleanly (6th agent = 6th adapter module through the same `callAgent()`), but *generation* output (new exercises) needs a stronger validation layer (structural JSON-schema validation against `lesson-json-v1`, not just field-shape checks) before it can be merged into `sections[]`, and probably a "queued for adult approval" state per PROJECT.md's `requiresAdultApproval` flag |
| Post-MVP: backend sync | Persistence layer swaps `localStorage` for a sync adapter behind the same `load()/save()` interface; StateStore and core logic do not change — this is exactly why keeping persistence behind an adapter interface now (not scattering `localStorage.setItem` calls everywhere) pays off later |

### Scaling Priorities

1. **First likely friction point (within MVP scope):** `localStorage` write frequency during rapid text-input typing/backspacing if `save()` isn't debounced — mitigate by saving only on discrete actions (submit answer, reward event, session end), not on every keystroke.
2. **Second likely friction point (within MVP scope):** Agent latency perceived as UI freeze if `callAgent()` isn't clearly async with a loading state — mitigate with a lightweight "checking..." UI state during the single Answer Checker round-trip, and a visible timeout (SPEC.md §14 implies a bounded wait before declaring failure and falling back).

## Anti-Patterns

### Anti-Pattern 1: Reaching for a full SPA framework + state library for this scope

**What people do:** Default to React/Vue + Redux/Zustand/Pinia because "that's how apps are built," adding build tooling, component lifecycle complexity, and a dependency surface disproportionate to 1 lesson / 19 exercises / 4 renderers.
**Why it's wrong:** For a diploma MVP being evaluated partly on the clarity of the core/agent boundary, framework ceremony is exactly the wrong kind of complexity to introduce — it obscures the boundary that's actually being graded and adds a dependency-update/build-tooling risk surface with zero payoff at this scope. The web search consensus for small vanilla apps (single source-of-truth object + pub/sub) is directly sufficient here.
**Do this instead:** Plain JS StateStore (object + subscribe/emit, ~40-60 lines) + plain DOM rendering functions keyed by exercise type. If a thin reactive layer is wanted for less manual DOM diffing, a micro-library (Preact, Alpine.js) is a reasonable, low-risk upgrade — but it is not required to satisfy any requirement in SPEC.md, and the STACK.md research should make the final call.

### Anti-Pattern 2: Letting agent output flow into state without a schema gate

**What people do:** `JSON.parse(llmResponse)` then directly `Object.assign(state, parsed)` or trust `parsed.amount` as a reward value, because "the prompt asks for strict JSON so it should be fine."
**Why it's wrong:** This is precisely the failure mode the milestone brief forbids ("core never trusts agent output without validation") and the one OWASP LLM05 (Improper Output Handling) and current agentic-architecture guidance flag as the standard LLM-integration mistake — structured-looking output is not the same as validated output, and a model can emit a syntactically valid JSON object with an out-of-range number, a hallucinated `errorType`, or a reward amount that bypasses the fixed table.
**Do this instead:** Every agent response passes through `validateSchema()` (required fields present, enums restricted to the allowed list from SPEC.md §8, e.g., `errorType` must be one of the 11 listed values) before the core even looks at it, and numeric/state-changing fields (reward amounts, correctness verdicts for scoring) are *never* taken verbatim from the agent — only qualitative fields (`reason` suggestion, praise text, explanation text) pass through, and even `reason` is checked against an allowlist before triggering the core's own amount lookup.

### Anti-Pattern 3: One monolithic "AI service" instead of 5 independent single-shot adapters

**What people do:** Build one shared "agent orchestrator" that threads conversation history, shares context across the 5 use cases, or chains agents together (e.g., Reward Advisor calling Progress Advisor) to "be smarter."
**Why it's wrong:** SPEC.md explicitly scopes this out ("Сложная мультиагентная оркестрация" is out of scope; "5 независимых агентов-«функций»... без сложной оркестрации между собой"). Cross-agent chaining multiplies failure modes, makes fallback behavior ambiguous (which agent failed? what's the fallback for a chain?), and is unnecessary complexity for single-shot, stateless "function" calls.
**Do this instead:** Each agent is a pure `input → output` function conceptually (even though it goes over the network to an LLM): no shared mutable context between agents, no agent-calls-agent, each with its own independent fallback. The orchestrator that exists is the deterministic `LessonEngine`, not an agent-side orchestrator.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| LLM provider (Claude, per SPEC.md §4) | Single-shot request/response per agent call, structured-output/JSON-mode prompting, called only through `agents/gateway.js` | No streaming needed (single JSON object responses); no conversation/session state carried between calls — each call is stateless per SPEC.md's "one request → strict JSON" contract; API key handling in a browser-only app needs a decision (proxy vs. exposed key) — flag this as a STACK.md/PITFALLS.md concern, since a pure client-side app calling an LLM API directly exposes credentials unless a minimal proxy or a user-supplied key pattern is used |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| UI ↔ LessonEngine | DOM events up (user actions) → function calls; state down via `subscribe(render)` | UI never imports from `core/state/store.js` setters directly; it only reads via `store.getState()` and renders |
| LessonEngine ↔ core rule modules (answer-checking, progress, rewards, reviewQueue) | Direct function calls, pure functions where possible (input state + event → output state) | These modules have no knowledge of agents or the network — fully unit-testable in isolation, which is the main leverage point for proving "deterministic core" claims in a diploma defense |
| LessonEngine ↔ Agent Gateway | Direct async function call (`await callAgent(...)`), always with a fallback supplied | This is the *only* place `core/` code is allowed to await a network call; keeping this call site enumerable (5 call sites, one per agent, all inside `lessonEngine.js` or the rule module that needs that agent) makes the boundary auditable |
| StateStore ↔ PersistenceAdapter | `save(state)`/`load() → state`, debounced writes | Adapter pattern isolates `localStorage` API specifics so swapping storage backend later (IndexedDB, backend sync) doesn't touch `core/` logic |
| LessonLoader ↔ everything else | `Lesson-1A.json` is loaded once, treated as immutable reference data (like a constant), never merged into or written back to `StateStore` | Keeps "lesson content" and "student progress" as two clearly separate data lifetimes — important since `reviewExercises[]` in the schema is explicitly "filled at runtime" but should be treated as a *view* built from `sections[]` + `reviewQueue`, not as a field mutated on the loaded lesson object itself |

## Sources

- SPEC.md (project-authored, HIGH confidence — this is the ground truth for component boundaries, §6-9, §14, §17)
- Lesson-1A.json (project-authored, HIGH confidence — defines the `lesson-json-v1` schema that `LessonLoader` and exercise renderers must conform to)
- PROJECT.md (project-authored, HIGH confidence — confirms diploma evaluation criteria include the core/agent boundary itself)
- [State Management in Vanilla JS: 2026 Trends — Medium](https://medium.com/@chirag.dave/state-management-in-vanilla-js-2026-trends-f9baed7599de) — MEDIUM confidence, corroborates single-source-of-truth + pub/sub pattern for small vanilla apps
- [Build a state management system with vanilla JavaScript — CSS-Tricks](https://css-tricks.com/build-a-state-management-system-with-vanilla-javascript/) — MEDIUM confidence, corroborates closure/pub-sub state pattern without frameworks
- [How to Validate LLM Outputs in Production Before They Break Your Pipeline — DEV Community](https://dev.to/vhub_systems_ed5641f65d59/how-to-validate-llm-outputs-in-production-before-they-break-your-pipeline-ahl) — MEDIUM confidence, corroborates schema-gate-before-trust pattern
- [LLM Improper Output Handling — OWASP LLM05:2025](https://www.a10networks.com/glossary/llm-output-validation/) — MEDIUM confidence, corroborates "treat structured LLM output as an untrusted API boundary" as an industry-recognized risk category
- [Design Patterns to Secure LLM Agents In Action](https://labs.reversec.com/posts/2025/08/design-patterns-to-secure-llm-agents-in-action) — MEDIUM confidence, corroborates "model asks, runtime decides" separation

---
*Architecture research for: browser-only deterministic-core + LLM-agent-functions app (English Quest MVP)*
*Researched: 2026-07-01*
