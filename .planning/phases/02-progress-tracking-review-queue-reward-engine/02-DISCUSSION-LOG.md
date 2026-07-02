# Phase 2: Progress Tracking, Review Queue & Reward Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 2-Progress Tracking, Review Queue & Reward Engine
**Areas discussed:** Topic Key & Multi-Topic Exercises, Review Queue Population & Consumption, Reward De-duplication ("No Farming"), Topic Status State Machine Threshold Interpretation

**Mode:** `--auto` — all areas auto-selected, no interactive prompts. Recommended option chosen for each.

---

## Topic Key & Multi-Topic Exercises

| Option | Description | Selected |
|--------|-------------|----------|
| Only apply signal to the first `topicImpact` entry | Simpler, but silently drops signal for additional topics | |
| Apply the same signal to every topic in `topicImpact[]` | Symmetric, no arbitrary "primary topic" choice | ✓ |

**Selection:** Apply to every topic (recommended default)
**Notes:** Real `Lesson-1A.json` data always has exactly 1 `topicImpact` entry per exercise (verified), so this is currently a no-op distinction in practice, but the schema allows more and the implementation shouldn't assume length-1.

---

## Review Queue Population & Consumption

| Option | Description | Selected |
|--------|-------------|----------|
| Interleave review items mid-lesson right after the triggering exercise | More "in the moment" but breaks Phase 1's linear index navigation | |
| Append review-queue pass after the main 19-exercise sequence | Simpler, reuses existing linear navigation model | ✓ |

**Selection:** Append after main sequence (recommended default)
**Notes:** Matches SPEC.md §9's "not yet passed this session" requirement without needing mid-lesson re-ordering.

---

## Reward De-duplication ("No Farming")

| Option | Description | Selected |
|--------|-------------|----------|
| Track a separate "already rewarded" flag per exercise | Extra state to keep in sync | |
| Dedup by scanning `rewardHistory` for `(exerciseId, reason)` pairs | Single source of truth, no parallel bookkeeping | ✓ |

**Selection:** Dedup via `rewardHistory` scan (recommended default)
**Notes:** Also locked: `streak_bonus` is session-global (not per-topic), resets after firing at 5; `weak_topic_closed` fires once on the `→Выучено` transition event.

---

## Topic Status State Machine — "Mini-Training Expansion" at 3+ Errors

| Option | Description | Selected |
|--------|-------------|----------|
| Invent a new "mini-training" mechanic (extra exercises, repeated drilling) | Matches SPEC wording literally but has no defined UI/content — would be scope invention | |
| No new mechanic — 3+ errors is absorbed by the already-triggered `Повторить` status + `reviewQueue` | Avoids inventing undefined UI scope; Phase 2 has no UI budget anyway | ✓ |

**Selection:** No new mechanic (recommended default)
**Notes:** SPEC.md never defines what "мини-тренировка" concretely looks like. Building a real mechanic for it would be premature scope creep into Phase 5 (UI) or beyond. `reviewQueue` already growing with that topic's exercises is the practical effect.

---

## Claude's Discretion

- Exact `topicStats`/`reviewQueue` TypeScript shape and module layout — left to planner/executor, informed by Phase 1's `progressSchema.ts` placeholders.
- `reviewQueue` stores exercise IDs, not full exercise objects (consistent with Phase 1's ID/index-based persistence precedent).

## Deferred Ideas

- Full "мини-тренировка" mechanic (see above) — no concrete spec exists, deferred until/unless explicitly requested.
- `confidenceScore` / `difficultyMode` guardrails (SPEC.md §12) — explicitly Phase 4 (Progress Advisor) scope, consumes but doesn't own Phase 2's counters.
