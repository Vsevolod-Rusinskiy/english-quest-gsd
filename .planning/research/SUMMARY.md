# Project Research Summary

**Project:** English Quest
**Domain:** Browser-only, no-backend kids' English-learning MVP — deterministic core + 5 single-shot LLM "agent function" calls
**Researched:** 2026-07-01
**Confidence:** MEDIUM-HIGH

## Executive Summary

English Quest is a single-lesson, browser-only ed-tech MVP whose real engineering challenge is not "pick a framework" but "build a legible boundary between a fully deterministic, unit-testable core and five narrow, single-shot Claude calls that can never be trusted blindly." The recommended stack (TypeScript, Vite, vanilla TS or Preact, `@anthropic-ai/sdk`, Zod, Vitest) reflects that framing directly: no agent-orchestration framework, no client database, no global state library — the project's own constraints (localStorage-only persistence, 4 fixed exercise types, 5 stateless agent adapters) already answer most stack questions. The one real infrastructure decision is how to call Claude without leaking the API key from a static bundle; a thin serverless proxy (Cloudflare Workers) is the recommended default, with a "grader supplies their own key" fallback documented as an explicit tradeoff, not an oversight.

Feature-wise, the project already matches the ecosystem's table stakes (multiple exercise types, immediate non-punitive feedback, visible progress, persistent state, a reward economy, same-session review, a short theory step) while carrying two genuine differentiators worth protecting in the roadmap: LLM-assisted fuzzy answer checking with typed error classification, and the "agent proposes, core decides" architecture itself with mandatory deterministic fallback for all five agents. SPEC.md has already correctly scoped out a long list of anti-features (full SRS, avatar shops, leaderboards, streaks, dynamic content generation, rich dashboards) — the roadmap should resist scope creep back toward any of these during planning.

The dominant risk category, per PITFALLS.md, is not "will Claude work" but "will the core actually hold the line it promises": untracked localStorage schema drift, structurally-valid-but-semantically-wrong agent JSON flowing into state unguarded, non-idempotent retry/fallback logic, composable reward-farming loopholes, difficulty-mode thrashing from per-exercise (rather than per-lesson) evaluation, and over/under-aggressive text normalization that either defeats the grammar lesson or falsely rejects correct answers. All six pitfalls map cleanly onto specific phases and are testable with fixture-based unit tests that don't require a live LLM — this should directly shape phase verification criteria.

## Key Findings

### Recommended Stack

TypeScript 6.0.x + Vite (5.x/6.x) + vanilla TS (or optional Preact 10.x) form the application layer; `@anthropic-ai/sdk` + Zod form the agent-integration layer; Vitest covers unit testing of the deterministic core. Claude Haiku 4.5 is the default model for all 5 agents (cheap, fast, sufficient for narrow single-shot JSON tasks), with per-agent upgrade to Sonnet only if quality testing shows a specific gap. A thin serverless proxy (Cloudflare Workers, free tier) is the recommended way to keep the API key out of the shipped browser bundle — a scoped, documented exception to "no backend," not a violation of it.

**Core technologies:**
- TypeScript 6.0.x — pins the Lesson JSON schema and all 5 agent contracts as first-class types, making the core/agent boundary self-documenting
- Vite 5.x/6.x — zero-backend-aware static bundler/dev-server matching the "no backend" constraint (avoid Vite 8.x/Rolldown, too new for a time-boxed thesis build)
- `@anthropic-ai/sdk` + Zod — typed Claude client plus the actual enforcement mechanism for "agent response is not trusted until core validates it"
- Vitest — Vite-native test runner for the deterministic core (answer normalization, reward rules, status thresholds, schema rejection)
- Cloudflare Workers (thin proxy) — the only "backend" needed, solely to keep the API key server-side

### Expected Features

**Must have (table stakes):**
- 4 mixed exercise types (`text-input`, `single-choice`, `matching`, `order-builder`) rendered from a fixed lesson JSON
- Immediate, non-punitive per-answer feedback with visible in-lesson progress
- Persistent progress across reload via a single `localStorage` key
- A reward/points economy for effort, not just correctness
- Same-session, threshold-based review queue (not full SRS)
- A short theory/rule step before practice

**Should have (differentiators):**
- LLM-assisted fuzzy answer checking with typed error classification (typo / wrong tense / missing article / etc.) for `text-input` — deterministic exact-match first, agent only for ambiguous cases
- Deterministic core + agent-as-advisor architecture with mandatory fallback for all 5 agents — the project's stated secondary (architectural) goal
- Guardrailed, inspectable difficulty personalization (Progress Advisor suggests, core enforces no easy→challenge jumps, changes only between lessons)
- Reward reasons tied to honest effort and mistake-correction, not streaks/speed
- Short, single-lesson narrative parent report with template fallback

**Defer (v2+):**
- Full spaced-repetition scheduling, avatar/cosmetic shop, leaderboards/social competition, daily-streak mechanics, AI-generated dynamic exercises, rich multi-lesson parent dashboards, voice/speech modes, multi-student accounts, backend + sync

### Architecture Approach

The system is a single-page app with a strict layered boundary: a **presentation layer** (DOM/renderers) that only reads state and emits events; a **deterministic core** (`LessonEngine` orchestrator + pure rule modules for answer-checking, progress thresholds, reward rules, review queue) that owns all state and has zero imports from agent or LLM code; an **Agent Gateway** as the single trust-boundary choke point (`callAgent()`: build prompt → call LLM → parse → validate schema → validate semantics → retry once → fallback) reused by all 5 agents; and a **persistence layer** (in-memory `StateStore` + debounced `localStorage` save/load under one versioned key). Agents never touch `StateStore` directly — their output is always intercepted, validated, and only a core-approved subset is ever dispatched as state.

**Major components:**
1. `LessonEngine` (orchestrator) — drives the fixed theory → exercises → review → reward → report pipeline; the only caller of the Agent Gateway
2. `StateStore` + `PersistenceAdapter` — single in-memory source of truth, debounced writes to a schema-versioned `localStorage` blob
3. Core rule modules (`AnswerChecker`, `ProgressRules`, `RewardRules`, `ReviewQueueManager`) — pure, agent-agnostic functions, fully unit-testable in isolation
4. Agent Gateway + 5 agent adapters — one shared validate/retry/fallback wrapper reused by Answer Checker, Progress Advisor, Reward Advisor, Parent Report Generator, and Theory Tutor
5. UI renderers — 4 exercise-type renderers + screens, strictly read-only over state, emitting events upward only

### Critical Pitfalls

1. **No schema version baked into the localStorage blob** — key-name-only versioning (`-v1` suffix) silently orphans real progress on any future data-model change. Store `{schemaVersion, data}` and write a migration pipeline from day one, before any feature writes to storage.
2. **Trusting LLM JSON structurally without validating semantics/ranges** — schema-valid JSON can still carry implausible or out-of-guardrail values (e.g., `suggestedDifficulty: "challenge"` right after 2 wrong answers). Every "agent proposes, core decides" field needs an independent, agent-agnostic guard function built and tested with adversarial fixtures before the real agent is wired in.
3. **Retry/fallback that isn't idempotent or error-type-aware** — treating timeouts, malformed JSON, and slow-but-eventually-successful calls identically risks double-counted rewards/attempts and wastes retry budget on unrecoverable failures. Structure agent calls as pure functions with no side effects; only the caller writes state after a validated result.
4. **Reward rules that compose into a farming loophole** — individually-sane fixed amounts can still be exploitable across sequences (wrong→hint→correct, or repeated review-queue completions). Requires an exhaustive reward-sequence table as a design artifact, turned into test cases, with limits enforced via ledger queries, not ad hoc flags.
5. **Difficulty-mode thrashing from per-exercise (not per-lesson) evaluation** — must resolve difficulty transitions once at lesson-end from whole-session aggregates, with an explicit tie-break for mixed signals, not last-write-wins per exercise.
6. **Text normalization too loose (masks the taught grammar errors) or too strict (rejects valid variants)** — normalization must stay lossless (case/whitespace/punctuation only, no fuzzy/edit-distance matching at the core layer); `acceptedAnswers` completeness in lesson content is a content-QA task, not a matching-algorithm problem.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Deterministic Core Foundation (state, persistence, answer-checking)
**Rationale:** Everything downstream (rewards, review queue, progress, agents) depends on `StateStore`, the schema-versioned `localStorage` adapter, and deterministic answer-checking existing and being correct first. This is also where Pitfall 1 (schema versioning) and Pitfall 6 (normalization) must be solved before any other phase touches state.
**Delivers:** `StateStore`, `PersistenceAdapter` with `schemaVersion` + migration pipeline, `LessonLoader`, lossless text normalization, exact/pairs/order comparison for all 4 exercise types (no agent yet).
**Addresses:** Persistent progress, 4 exercise types, deterministic checking (table stakes from FEATURES.md).
**Avoids:** Pitfall 1 (no schema version), Pitfall 6 (over/under-normalization).

### Phase 2: Exercise Loop, Stats, Review Queue, Reward Engine (no agents)
**Rationale:** Progress thresholds, review-queue triggers, and reward rules are all core-owned logic that must exist and be fully guardrailed *before* any agent is wired in — per ARCHITECTURE.md's dependency notes, guardrails must exist independently so a bad/hallucinated agent output can never bypass them.
**Delivers:** `topicStats`/`wordStats`/`exerciseTypeStats` counters, topic-status FSM, same-session `reviewQueue`, fixed-amount reward engine with ledger, exhaustive reward-sequence test table.
**Uses:** Vitest for pure-function unit tests of all rule modules.
**Avoids:** Pitfall 4 (reward farming loopholes), Pitfall 5's precondition (per-lesson-only difficulty evaluation groundwork).

### Phase 3: Agent Gateway (shared trust boundary, built once)
**Rationale:** The single choke point (`callAgent()`: build prompt → call → parse → validate schema → validate semantics → retry-once (error-type-aware) → fallback) must be built and hardened once, independent of any specific agent, so validation/retry/fallback logic isn't reimplemented 5 times with drift risk.
**Delivers:** Zod schemas per agent contract, `agents/gateway.js`, error-type-classified retry logic, client-side timeout tuned to child attention span.
**Implements:** Pattern 1 (Agent Gateway as trust boundary) and Pattern 2 (deterministic-first, agent-as-escalation) from ARCHITECTURE.md.
**Avoids:** Pitfall 2 (semantic validation gap), Pitfall 3 (non-idempotent retry/fallback).

### Phase 4: Agent Integration — Answer Checker, Theory Tutor
**Rationale:** These two agents are directly in the primary exercise-answering flow (highest-frequency user action per SPEC.md). Answer Checker only activates on deterministic-ambiguous `text-input` cases; Theory Tutor is bounded by a capped simplify-round counter.
**Delivers:** Live Answer Checker (typed `errorType`) and Theory Tutor wired through the Phase 3 gateway, each with its adversarial-fixture test suite.
**Addresses:** The project's primary differentiator (fuzzy answer checking with error classification).

### Phase 5: Agent Integration — Progress Advisor, Reward Advisor, Parent Report Generator
**Rationale:** These three are lower-frequency (session/lesson-end) and depend on the Phase 2 stats/reward engine and Phase 3 gateway both being stable; Progress Advisor specifically needs the per-lesson (not per-exercise) difficulty-evaluation guardrail from Phase 2 to be correct before its suggestions can be safely clamped.
**Delivers:** Progress Advisor with difficulty guardrails, Reward Advisor (reason/praise suggestions only, core still computes amounts), Parent Report Generator with template fallback.
**Avoids:** Pitfall 5 (difficulty thrashing) — verify with a scripted mixed-performance test before considering this phase done.

### Phase 6: UI Polish, Kid-Friendly Styling, End-to-End UX Verification
**Rationale:** UI work is intentionally last/parallel-capable once the underlying data flows are correct, since renderers are stateless and only need the finalized state shape and event contracts.
**Delivers:** Kid-friendly visual style (blocky, bright, rounded), loading/"thinking" states for agent calls, calm non-punitive wrong-answer treatment, difficulty-change explanations surfaced to the child.
**Avoids:** UX pitfalls from PITFALLS.md (robotic fallback tone, silent loading states, punishing-feeling wrong-answer UI, unexplained difficulty changes).

### Phase Ordering Rationale

- Core-before-agents is a hard dependency chain confirmed independently by both ARCHITECTURE.md ("guardrails must exist and be enforced before advisor suggestions can be safely applied") and PITFALLS.md (every agent-integration pitfall's prevention phase is listed as "before the real agent call is wired in").
- The shared Agent Gateway is deliberately its own phase (not folded into the first agent's phase) because PITFALLS.md explicitly flags "retry logic reimplemented per agent" and "one monolithic AI service" as anti-patterns on opposite ends of the same mistake — building the gateway once, generically, and reusing it 5 times is the correct middle path.
- Answer Checker/Theory Tutor before Progress/Reward/Report Advisor reflects both call frequency (per-exercise vs per-lesson) and the fact that Progress Advisor's safe operation depends on the per-lesson difficulty-evaluation guardrail, which is more naturally built alongside the Phase 2 stats work.
- UI is last because ARCHITECTURE.md's structure is explicitly framework-agnostic and stateless at the render layer — there is no dependency risk in deferring polish, only opportunity cost, so it should not block core/agent correctness work.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Agent Gateway):** Claude structured-output/strict-tool-use specifics (beta header, model-version gating) and timeout/retry semantics against the real SDK are still evolving; verify current `@anthropic-ai/sdk` behavior at implementation time.
- **Phase 4 (Answer Checker):** The `errorType` taxonomy's real-world reliability against actual child input variance (contractions, mobile smart quotes) may need a short calibration pass against `Lesson-1A.json`'s `acceptedAnswers` completeness.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Core foundation):** localStorage + schema-versioning + pub/sub state patterns are well-documented, standard vanilla-JS patterns (corroborated across multiple 2026 sources in ARCHITECTURE.md).
- **Phase 2 (Stats/rewards/review queue):** Pure-function rule modules with fixed tables are conventional application logic, no external research needed.
- **Phase 6 (UI polish):** Standard frontend styling/UX work with clear guidance already in SPEC.md and PITFALLS.md's UX section.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core library versions cross-checked against npm/official docs; Claude API structured-output details verified against official Claude Platform docs and independent write-ups |
| Features | MEDIUM | Ecosystem patterns well-established and cross-corroborated across multiple products; project-specific numeric/UX choices are project-defined in SPEC.md, not externally derived |
| Architecture | HIGH | Well-established pattern (client-side state store + strict output-validation boundary) verified directly against SPEC.md and Lesson-1A.json, plus corroborating community sources |
| Pitfalls | MEDIUM-HIGH | Grounded in documented industry patterns (localStorage migration, structured-output validation, gamification misuse research); project-specific pitfalls derived by domain reasoning from SPEC.md since no public case study covers this exact core+5-agent design |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Claude Structured Outputs beta vs. classic strict tool-use: the final choice affects Phase 3's gateway implementation details and should be confirmed against current SDK/model access at execution time, not locked in during roadmap creation.
- API-key handling strategy (Cloudflare Workers proxy vs. "bring your own key" demo mode) is a deployment decision that affects Phase 3/6 scope — should be explicitly decided (not defaulted silently) during requirements or early planning.
- Exact reward-sequence table (Pitfall 4's prevention artifact) does not yet exist — it should be produced as a concrete design artifact at the start of Phase 2, not assumed to already be implied by SPEC.md's fixed reward table alone.
- `acceptedAnswers` completeness in `Lesson-1A.json` is a content-QA gap, not a code gap — flag for explicit content review sign-off alongside Phase 1/4 code review, since it directly affects agent-call volume and correctness.

## Sources

### Primary (HIGH confidence)
- Project's own `SPEC.md`, `PROJECT.md`, `Lesson-1A.json` — ground truth for architecture, feature scope, and data contracts
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs — official Anthropic docs on Structured Outputs / strict tool use
- https://platform.claude.com/docs/en/about-claude/pricing — official Claude model pricing

### Secondary (MEDIUM confidence)
- https://vite.dev/releases, https://www.npmjs.com/package/vite — Vite version/release info
- https://www.npmjs.com/package/zod, https://zod.dev/v4 — Zod version and features
- https://www.npmjs.com/package/vitest, https://www.npmjs.com/package/typescript, https://www.npmjs.com/package/@anthropic-ai/sdk — current package versions
- https://developers.cloudflare.com/workers/ — serverless key-proxy pattern
- Duolingo, Prodigy Math, Khan Academy/DreamBox parent dashboards — competitor feature landscape
- State Management in Vanilla JS (Medium), CSS-Tricks vanilla state management — vanilla state pattern corroboration
- LLM output validation patterns (DEV Community), OWASP LLM05:2025 — schema-vs-semantic validation risk
- Simple frontend data migration (Jan Monschke), 3 Hidden Dangers of LocalStorage in 2025 (Medium) — localStorage schema/migration risk
- Gamification misuse case study (arXiv 2203.16175), Gamification mistakes (xtremepush) — reward-loophole and engagement-misuse research

### Tertiary (LOW confidence)
- None flagged — all sources used were cross-corroborated across at least two independent references or grounded directly in project documents

---
*Research completed: 2026-07-01*
*Ready for roadmap: yes*
