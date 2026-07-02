# Phase 2: Progress Tracking, Review Queue & Reward Engine - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers per-topic mastery tracking, a same-session review queue for weak topics, and a fixed-rule ledgered reward engine — entirely **without any agent involvement** (zero LLM calls; Reward Advisor and Progress Advisor arrive in Phase 4, layered on top of this engine, not replacing it). Phase 1's `exerciseStats` (attempts/correct per exercise) already exists as a typed empty container; this phase adds `topicStats`, the topic-status state machine, `reviewQueue` population/consumption, and `currentRewards`/`rewardHistory`.

</domain>

<decisions>
## Implementation Decisions

Discussion ran in `--auto` mode: for each gray area below, the recommended option was auto-selected (no interactive prompts).

### Topic Key & Multi-Topic Exercises

[auto] Topic Mapping — Q: "Lesson-1A.json's `topicImpact` field is a string array per exercise (schema allows multiple topics per exercise even though the real Lesson-1A.json data always has exactly 1). How does an attempt's correct/incorrect signal apply when an exercise impacts multiple topics?" → Selected: "Apply the same correct/incorrect signal to every topic in `topicImpact[]`, looping over all entries" (recommended default)

- **D-01:** `topicStats` is keyed by the raw topic strings found in `exercise.topicImpact[]` across the lesson (e.g. `present_continuous_now`, `present_simple_negative`). On every `exercise_attempt` event, the core loops over `topicImpact` and applies the same correct/incorrect update to every topic's counters — no topic is privileged as "primary". Verified against real `public/Lesson-1A.json`: all 19 exercises currently have exactly 1 `topicImpact` entry, so this loop degenerates to a single update per attempt in practice today, but the implementation must not assume length-1 (schema allows more).

### Review Queue Population & Consumption

[auto] Review Queue UX — Q: "SPEC.md §9 says reviewQueue items are 'ready-made task from the lesson, not yet passed this session' — where does the child encounter them relative to the main 19 exercises?" → Selected: "Append review-queue items as a distinct pass after the main lesson exercises complete, not interleaved mid-lesson" (recommended default)

- **D-02:** When a topic's status flips to `Повторить` (2+ errors on that topic), the core scans all lesson exercises whose `topicImpact` includes that topic AND that the child has not yet answered correctly in the current session, and enqueues their `exerciseId`s into `reviewQueue` (deduplicated — an exercise already in the queue isn't added twice). The child encounters `reviewQueue` exercises as a distinct pass appended after the main 19-exercise sequence finishes (extends `EXERCISE-05`'s progress indicator range for this phase: main sequence 1-19, then a review sub-sequence), not interleaved mid-lesson. Rationale: keeps Phase 1's linear `currentExerciseIndex` navigation model intact without needing mid-lesson re-ordering logic; matches the literal "ещё не пройденное в сессии" (not yet passed this session) requirement.
- Completing a `reviewQueue` item removes it from the queue (whether answered correctly or not — a wrong review-queue answer doesn't loop it back in immediately; it can be re-added by the normal 2+-error trigger if the topic re-accumulates errors).

### Reward De-duplication ("No Farming")

[auto] Reward Farming Guard — Q: "SPEC.md §10 says 'нет фарма на одном задании' (no farming on one exercise) with per-exercise limits like '1 раз/задание'. What's the concrete enforcement mechanism?" → Selected: "Per-(exerciseId, reason) dedup checked against rewardHistory before granting" (recommended default)

- **D-03:** Before granting `honest_attempt`, `first_try_correct`, `correct_after_hint`, or `fixed_mistake` for a given exercise, the core checks whether a `rewardHistory` entry already exists with that exact `(exerciseId, reason)` pair; if so, the reward is skipped (already granted). This is the literal enforcement of "1 раз/задание" per reward reason.
- **D-04:** `streak_bonus` (+10₽ per SPEC §10) is a **session-global** correct-answer streak (not per-topic): a counter increments on every correct answer and resets to 0 on any incorrect answer. When it reaches 5, `streak_bonus` fires once and the counter resets to 0 (so a 10-correct-in-a-row session fires the bonus twice, at 5 and 10 — not continuously).
- **D-05:** `weak_topic_closed` (+15₽) fires once per topic, exactly when that topic's status transitions **into** `Выучено` (tracked via the topic-status state machine's own transition event, not a `rewardHistory` scan — a topic can only make that transition once per session in practice since there's no path back into `Повторить` after reaching `Выучено` within Phase 2's scope).
- Review-queue exercise completions flow through the **same** reward pipeline as main-sequence exercises (same `(exerciseId, reason)` dedup) — there is no separate reward path for review answers.

### Topic Status State Machine — Threshold Interpretation

[auto] "Mini-Training Expansion" at 3+ Errors — Q: "SPEC.md §9 says 3+ errors on a topic should 'расширить мини-тренировку' (expand mini-training) — but no concrete mechanic is defined anywhere in SPEC.md, and Phase 2 has no UI scope (UI is Phase 5)." → Selected: "Do not invent a new UI mechanic; 3+ errors keeps the topic at `Повторить` (already reached at 2 errors) with no additional behavior beyond what `reviewQueue` already provides" (recommended default)

- **D-06:** The topic-status machine implements exactly the transitions SPEC.md §9 defines with concrete triggers: `Не изучено → В процессе` (first attempt on the topic), `В процессе → Повторить` (2+ errors on that topic), `Повторить → В процессе` (a correct answer on that topic while in `Повторить`, including via `reviewQueue`), `→ Выучено` (3 correct-in-a-row on that topic, evaluated from whatever status the topic is currently in — this is the single "advance" rule SPEC gives for both "усилить статус" and "приблизить к Выучено"). No separate "mini-training" artifact is built — 3+ errors is absorbed by the already-triggered `Повторить` status and growing `reviewQueue` membership; this avoids inventing UI/content scope that belongs to a later phase or isn't specified.
- Per-topic counters (`errors`, `correctStreak`) live in `topicStats` alongside the existing per-exercise `exerciseStats`, not replacing it — both are needed (exercise-level for review-queue eligibility checks, topic-level for the status machine).

### Claude's Discretion

- Exact `topicStats`/`reviewQueue` TypeScript shape and file layout (new module vs. extending `store.ts`) — left to planner/executor, informed by Phase 1's existing `progressSchema.ts` structure (this phase fills in the `topicStats: z.record(...)` and typed `reviewQueue: string[]` fields that currently exist only as `z.array(z.unknown())` placeholders).
- Whether `reviewQueue` stores full exercise objects or just `exerciseId` strings resolved against the loaded lesson at render time — planner's call, but `exerciseId` strings keep the persisted blob smaller and avoid data duplication (Phase 1's `PERSIST-01` precedent stores IDs/indices, not full exercise objects).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specification
- `SPEC.md` §6 (core/agent boundary — Phase 2 owns "прогресс/статусы/рубли" rows fully, no agent rows), §9 (topic status thresholds, reviewQueue definition — the primary source for this phase's state-machine rules), §10 (reward table, amounts, limits, mutual-exclusion rules), §12 (`confidenceScore` formula — NOT in Phase 2 scope, that's Phase 4's Progress Advisor personalization, but the raw counters this phase produces feed it later)
- `Lesson-1A.json` — real `topicImpact` values per exercise (all single-topic in current data, verified via direct inspection)

### Phase 1 Artifacts (dependency)
- `.planning/phases/01-deterministic-core-lesson-rendering-persistence/01-01-SUMMARY.md`, `01-02-SUMMARY.md`, `01-03-SUMMARY.md` — what already exists: `StateStore`/`dispatch`/`save-on-dispatch` pattern, `ProgressStateSchema` with placeholder `topicStats`-adjacent fields, all 4 exercise-type checkers, `LessonEngine.handleAnswer`
- `src/core/state/progressSchema.ts` — current Phase 1 schema; this phase's Zod additions must extend it, not replace the existing `exerciseStats`/`currentPosition`/`lessonId` fields
- `src/core/state/store.ts`, `src/core/lessonEngine.ts` — the dispatch/save flow this phase's new counters and reward events must plug into (still synchronous save-on-dispatch per Phase 1's D-03, no debouncing)

### Project-Level Context
- `.planning/PROJECT.md` — Core Value, Active requirements (PROGRESS-01..04, REWARD-01/02 now move toward Validated after this phase)
- `.planning/REQUIREMENTS.md` — PROGRESS-01, PROGRESS-02, PROGRESS-03, PROGRESS-04, REWARD-01, REWARD-02 (the 6 requirements this phase must satisfy)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StateStore` (`src/core/state/store.ts`) — `dispatch()`/`subscribe()` pattern already handles synchronous save-on-dispatch; new progress/reward logic should be new dispatch handlers or reducer-style update functions called from the existing dispatch flow, not a parallel state mechanism.
- `ProgressStateSchema` (`src/core/state/progressSchema.ts`) — already has placeholder `z.array(z.unknown())`/`z.record(...)` fields for `lessonHistory`, `rewardHistory`, `reviewQueue` explicitly commented as "Phase 2 scope" — this phase types them properly.
- `checkTextInput`/`checkSingleChoice`/`checkMatching`/`checkOrderBuilder` (Phase 1, `src/core/answer-checking/`) — already return a normalized correct/incorrect + `source:"core"` verdict per attempt; Phase 2's topic/reward logic consumes this verdict, doesn't re-derive it.

### Established Patterns
- Zero `innerHTML`, `createElement`/`textContent` only — carries forward, though Phase 2 is largely UI-free (only extends the existing progress indicator's range for the review pass).
- Synchronous `save()` on every `dispatch()`, no debounce (D-03 from Phase 1) — new reward/topic-status writes must go through the same path.
- Zod `safeParse`-or-reset on every `localStorage` read (Pattern 2 from Phase 1 research) — extends automatically to new schema fields since it's the same top-level `ProgressStateSchema`.

### Integration Points
- `LessonEngine.handleAnswer` (`src/core/lessonEngine.ts`) is the single point every exercise-type answer already routes through — Phase 2's counter/reward/topic-status updates hook in here, after the deterministic checker verdict, before/alongside the existing `dispatch()` call.

</code_context>

<specifics>
## Specific Ideas

No specific UI/UX references — Phase 2 is explicitly logic-only per ROADMAP.md ("no agent involved", no `**UI hint**: yes` on this phase). The review-queue pass reuses Phase 1's existing exercise renderers unchanged; only the sequencing/progress-indicator range extends.

</specifics>

<deferred>
## Deferred Ideas

- Full "мини-тренировка" (mini-training) mechanic for 3+ errors on a topic — SPEC.md doesn't define a concrete UI/content mechanic beyond what `reviewQueue` already covers; if a richer mechanic is wanted later, it's a new capability, not a Phase 2 gray-area resolution (see D-06).
- `confidenceScore` formula and `difficultyMode` guardrails (SPEC.md §12) — these consume Phase 2's raw counters but are explicitly Phase 4 (Progress Advisor) scope, not this phase's.

### Reviewed Todos (not folded)

None — no pending todos existed (`todo_count: 0` at project start, none added since).

</deferred>

---

*Phase: 2-Progress Tracking, Review Queue & Reward Engine*
*Context gathered: 2026-07-02*
