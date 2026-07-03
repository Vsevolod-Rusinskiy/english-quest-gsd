# Phase 4: Progress Advisor, Reward Advisor & Parent Report - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the last 3 of the project's 5 agents — **Progress Advisor** (session-end next-focus/difficulty recommendation), **Reward Advisor** (live per-answer praise text layered on Phase 2's fixed reward amounts), and **Parent Report Generator** (session-end parent-facing summary) — all reusing Phase 3's `callAgent()` gateway unchanged. No new orchestration framework: each is an independent single-shot function per SPEC.md §6/§8. `REPORT-03` (cross-lesson trend from `lessonHistory`) is explicitly out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Reward Advisor Timing & Scope

- **D-01:** Reward Advisor is called **live, per exercise answer** (not once at session end) — the same real-time pattern as Answer Checker in Phase 3, not a session-end batch summary.
- **D-02:** It is called on **every** answer that produces at least one reward event, including `honest_attempt` (+1₽ for any attempt) — not gated to "significant" reasons only (first_try_correct/streak_bonus/weak_topic_closed). This means potentially one live agent call per exercise submission across the whole lesson (up to 19+ calls in a full session).
- **D-03:** When a single answer produces **multiple** reward events at once (e.g. `honest_attempt` + `first_try_correct` + `streak_bonus` all firing together), this is **one Reward Advisor call per answer**, not one call per individual reward event — the full list of that answer's reward events is passed to the agent together, and it returns one combined praise phrase. Mirrors SPEC.md §8.3's per-attempt input framing ("результат проверки, номер попытки, история, серия").
- **D-04:** The agent's praise text renders in the **same feedback banner** used for correct/incorrect verdicts — no new UI element. If the agent call fails (after retry), the banner shows the existing correct/incorrect message with no praise line (fixed reward amounts are unaffected either way — Reward Advisor never touches amounts, per REWARD-03/04).

### Session-End Scenario

- **D-05:** The current bare "Урок завершён!" message is **replaced** by one combined end-of-session screen (not appended alongside it) — child and parent both see the same single screen: Progress Advisor's recommendation/motivational text plus the Parent Report, together.
- **D-06:** Progress Advisor and Parent Report Generator are **two separate agent calls** through the same shared `callAgent()`, not merged into one combined JSON contract — preserves SPEC.md §6/§8's "5 independent agent-functions" boundary even though they're presented on the same screen.
- **D-07:** Call order is **sequential, not parallel**: Progress Advisor resolves first (agent success or fallback — either way it produces a final core-decided `recommendedFocus`/`suggestedDifficulty`), and only then is Parent Report Generator called, receiving that final recommendation as part of its input snapshot. This directly implements SPEC.md §8.4's stated input ("снимок урока + рекомендация") — Parent Report is NOT independent of Progress Advisor's outcome.
- **D-08:** The child/parent sees a brief **thinking-screen** while both sequential calls run (mirrors Phase 3's disabled-buttons + thinking-cue pattern) — worst case ~32s (two agents × up to 16s each with one retry) is treated as acceptable given the session-end nature (not a mid-lesson blocking wait).

### difficultyMode Scope (MVP has only 1 lesson, no easy/challenge content variants)

- **D-09:** `difficultyMode` is **computed and stored only** this phase — it does NOT change anything observable within a single lesson session (there is no easy/challenge content to switch to in `Lesson-1A.json`). It is surfaced in the end-of-session recommendation/report as an informational value ("next session should be at X difficulty"), honoring SPEC.md §12's guardrails (no easy→challenge jump, up only after 3-correct streak, down only after 2 errors) in the computation itself, even though there's no in-session behavior to gate.
- **D-10:** SPEC.md's "меняется только между уроками" (changes only between lessons) guardrail is honored literally: `difficultyMode` is computed **once, at session end**, not recalculated live after every answer within the session — consistent with there being exactly one lesson in this MVP (the guardrail is a no-op observable effect here, but the computation still happens correctly for whenever a second lesson exists).

### wordStats

- **D-11:** A dedicated `wordStats` (separate from `topicStats`/`exerciseTypeStats`) IS built for Progress Advisor's input, per SPEC.md §8.2's explicit input contract — even though only 10 of 19 real exercises have non-empty `targetWords` (each currently exactly 1 word).
- **D-12:** Update rule mirrors Phase 2's D-01 pattern for `topicImpact`: loop over **all** entries in `targetWords[]` for an exercise and apply the same correct/incorrect signal to each word's counters. Degenerates to a single update per attempt in today's real data (never more than 1 word), but the implementation must not assume length ≤ 1 — schema allows more, matching Phase 2's precedent decision for `topicImpact`.

### Claude's Discretion

- Exact TypeScript shape/module layout for `wordStats`, `exerciseTypeStats`, `StudentProfileSchema` extensions (`confidenceScore`, `difficultyMode`, `lastRecommendedFocus`, `motivationSignals`) — left to planner/executor, following Phase 1/2's established Zod-schema-per-shape pattern. `confidenceScore`'s exact formula is already fixed by SPEC.md §12 (`clamp(correctRatio + 0.05*streak - 0.1*errorsInARow, 0, 1)`) — no product decision needed, just correct implementation.
- Whether the end-of-session screen is a distinct render branch in `main.ts`/a new UI module, or extends the existing `else` branch that currently renders "Урок завершён!" — implementation detail, not a product decision (D-05 only fixes that it's ONE combined screen, not the visual structure).
- `exerciseTypeStats` shape (per-type attempts/correct, keyed by `text-input`/`single-choice`/`matching`/`order-builder`) — straightforward extension of the existing `exerciseStats`-per-exercise pattern, no gray area surfaced during discussion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specification
- `SPEC.md` §6 (core/agent boundary — Reward Advisor/Progress Advisor/Parent Report Generator all propose only, never write numbers), §8 (agent contracts: §8.2 Progress Advisor input/output, §8.3 Reward Advisor input/output, §8.4 Parent Report Generator input/output — the exact JSON shapes this phase must implement), §10 (reward table — amounts/limits stay Phase 2's `computeRewardEvents()`, Reward Advisor only adds reason/praise on top), §12 (`studentProfile` fields, `confidenceScore` formula, `difficultyMode` guardrails), §13 (parent report tone/fields), §14 (agent error handling — not-trusted-until-validated, one retry, source/failure logging — same rules as Phase 3's gateway)
- `Lesson-1A.json` — real `targetWords` data (10/19 exercises, always exactly 1 word today) grounding D-11/D-12

### Phase 2/3 Artifacts (dependency)
- `src/core/rewards/rewardEngine.ts` — `computeRewardEvents()`, the fixed-amount engine Reward Advisor layers on top of without ever touching `amount`
- `src/core/agents/callAgent.ts` — the shared Agent Gateway (validate→retry-once→fallback) all 3 of this phase's agents reuse unchanged
- `src/core/state/progressSchema.ts` — current `ProgressStateSchema`; this phase extends `StudentProfileSchema` (currently just `{studentId: "primary"}`) with `confidenceScore`/`difficultyMode`/`lastRecommendedFocus`/`motivationSignals`, and adds new `wordStats`/`exerciseTypeStats` records
- `src/main.ts` — the `else` branch currently rendering bare "Урок завершён!" (line ~237), the integration point D-05 replaces

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeRewardEvents()` (`src/core/rewards/rewardEngine.ts`) — pure function, fixed amounts/dedup; Reward Advisor's praise text is additive metadata on the events this function already produces, never a replacement.
- `callAgent()` (`src/core/agents/callAgent.ts`) — the exact same gateway function from Phase 3, reused unchanged by all 3 new agents (Answer Checker/Theory Tutor never needed to change it — confirms D-05 from Phase 3's own decision log that this gateway generalizes).
- `StateStore.dispatch()` / `save()` (Phase 1) — single synchronous save-on-dispatch; session-end agent results (Progress Advisor recommendation, difficultyMode, Parent Report text) must fold into this same dispatch path, not a new parallel write.

### Established Patterns
- Zod schema + `z.infer` per shape (every prior phase) — new `wordStats`/`exerciseTypeStats`/`StudentProfileSchema` fields follow this.
- `source: "core" | "agent"` + failure-flag event logging (Phase 3, RELY-03) — extends to Progress Advisor/Reward Advisor/Parent Report Generator calls the same way.
- Async handler + disabled-buttons + thinking-cue pattern (Phase 3's `main.ts` handlers) — the session-end screen's sequential Progress Advisor → Parent Report calls (D-07/D-08) follow this same shape.
- Per-`topicImpact[]`-entry loop for multi-topic exercises (Phase 2 D-01) — directly reused for `wordStats`'s per-`targetWords[]`-entry loop (D-12).

### Integration Points
- `computeRewardEvents()` call site inside `LessonEngine.handleAnswer` — Reward Advisor's live per-answer call (D-01/D-02/D-03) hooks in immediately after this function returns its reward event list for the current answer.
- The `else` branch in `main.ts`'s render function (currently "Урок завершён!") — replaced by the new combined end-of-session screen (D-05), triggering the sequential Progress Advisor → Parent Report call chain (D-06/D-07).

</code_context>

<specifics>
## Specific Ideas

No specific visual/copy references were given for the end-of-session screen — Phase 5 (Kid-Friendly Visual Design) handles final visual polish; this phase only needs the screen to render the right data through the right call sequence.

</specifics>

<deferred>
## Deferred Ideas

- Full easy/normal/challenge content variants (alternate exercise sets) — would make `difficultyMode` visibly actionable within a session, but requires new lesson content authoring, which is out of this MVP's scope (D-09).
- REPORT-03 (cross-lesson trend from `lessonHistory`) — explicitly not a Phase 4 requirement; `lessonHistory` stays untyped (`z.array(z.unknown())`) for this phase.

### Reviewed Todos (not folded)

None — no pending todos matched this phase (`todo_count: 0`).

</deferred>

---

*Phase: 4-Progress Advisor, Reward Advisor & Parent Report*
*Context gathered: 2026-07-03*
