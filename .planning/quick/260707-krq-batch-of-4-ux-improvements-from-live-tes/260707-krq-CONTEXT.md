# Quick Task 260707-krq: Batch of 4 UX improvements from live testing - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Task Boundary

Four UX improvements surfaced during live manual testing of the full lesson, all decided by the user. Diploma-MVP (English Quest), deterministic-core/LLM-agent hybrid (see CLAUDE.md). No backend, no external asset files, vanilla TS + createElement/textContent only (no innerHTML), single localStorage key.

1. **Coin sound on ruble award.**
2. **Unify all text-input exercises to inline blanks** (single-blank is currently inconsistent with multi-blank).
3. **Escalating authored hints on wrong answers** (firstError → secondError).
4. **Surface progress in the UI**: progress bar + correct-streak chip + topic-mastery summary.

</domain>

<decisions>
## Implementation Decisions (LOCKED by the user)

### #1 — Coin sound
- Play a short **coin-clink** sound the moment rubles are awarded.
- Hook it at the EXISTING reward-diff site in `src/main.ts` (~line 210): where `const rewardsDelta = store.getState().currentRewards - rewardsBefore;` and `if (rewardsDelta > 0)` already fires the `RewardToast`. Play the sound in that same `rewardsDelta > 0` branch.
- **Synthesize via the Web Audio API** (a short two-note "cling"), NOT an external audio asset file — keeps the project asset-free / no-backend. A small dedicated helper module (e.g. `src/ui/sound/coin.ts`) with a `playCoinSound()` function that lazily creates/reuses a single `AudioContext`.
- Must degrade silently: if `AudioContext` is unavailable or blocked by the browser's autoplay policy (no user gesture yet), never throw — wrap in try/catch. (In practice the sound fires right after the child clicks "Проверить", which IS a user gesture, so autoplay should allow it.)
- No mute toggle for this pass (can add later); keep it a single short, non-annoying cling.

### #2 — Unify all blanks to inline
- Currently `textInput.ts` renders multi-blank (2+) exercises as inline inputs replacing each `___`, BUT single-blank (1) exercises keep the OLD path: the `___` stays in the prompt text AND a separate full-width input box appears below. This is inconsistent (user saw it on ex005 "I ___ going out to restaurants. (love)").
- Fix: make single-blank ALSO render inline — i.e. use the inline-per-blank path for ALL text-input exercises (blankCount >= 1). The `___` is replaced by an inline input in the sentence flow; no separate box below, no literal `___` left in the text.
- The existing reconstruction (`blank[0] + interior segments + blank[i]`) already produces the correct single-string for onSubmit; for a single blank it's just `blank[0].value`, which equals the current single-input behavior — so checkTextInput/normalize/onSubmit stay byte-identical in contract.
- Keep a fallback for a prompt with ZERO `___` (shouldn't happen in current data, but don't crash): render a single input below, as today.
- The `.inline-blank` inline-block CSS already exists (260707-hby) and applies.

### #3 — Escalating authored hints
- On a WRONG answer, show the AUTHORED hint from lesson data as the PRIMARY hint, escalating by attempt count: 1st wrong attempt → `exercise.hint.firstError`; 2nd+ wrong attempt → `exercise.hint.secondError` **falling back to `firstError` when `secondError` is absent** (only 9/19 exercises have `secondError`; `HintSchema.secondError` is `.optional()`).
- Attempt count comes from `store.getState().exerciseStats[exerciseId].attempts` (read AFTER `engine.handleAnswer` resolves, so it reflects the just-recorded attempt). attempts===1 → first wrong try; attempts>=2 → secondError. (Only text-input has multiple tries on the same screen; matching/others also carry `hint.firstError`.)
- The agent's `result.hintRu` is now only SUPPLEMENTARY (per user choice "агентская подсказка — только как дополнение"): the authored escalating hint is what's shown as the main hint. If keeping the agent hint at all, show it as a secondary/subordinate line — but do NOT let a confusing agent hint (e.g. the earlier "add usually between don't and have") replace the reliable authored one. Simplest acceptable implementation: authored escalating hint is the hint passed to the banner; agent hintRu optionally appended as a muted secondary line. Planner may choose to drop the agent hint entirely from the banner if that's cleaner — the deterministic authored hint is the requirement.
- Current code to change: `src/main.ts` ~line 222 `const hint = result.hintRu ?? ("hint" in exercise ? exercise.hint.firstError : undefined);` — invert the priority to authored-first with escalation. `FeedbackBanner.ts` may need a small extension if showing a secondary supplement line.
- All exercise types carry `hint.firstError` (required in schema); only text-input meaningfully escalates (repeated same-screen tries). Non-text types keep showing firstError.

### #4 — Surface progress in the UI (all three, first pass)
Data already tracked by the core (nothing new to compute in the agents):
- `state.currentPosition.currentExerciseIndex` / `engine.totalExercises` (position — already shown as "Задание N из 19" text).
- `state.currentCorrectStreak` (session-global correct-answer streak).
- `state.topicStats` (record keyed by topicId → { status: not_started|in_progress|needs_review|mastered, attempts, correct, correctStreak }). Topic display names come from `src/core/topics/topicLabels.ts`'s `topicLabel(id)`.

- **Progress bar:** a visual filled bar reflecting current/total exercises, in/under the `top-bar` (keep the "Задание N из 19" text too, or integrate). Kid-friendly, uses existing palette tokens; must handle main pass, review pass, and complete states without overshoot (mirror the existing ProgressIndicator's 3 variants' guarding — main/review/complete).
- **Streak chip:** a small chip in the `top-bar` (next to the ruble chip), e.g. "🔥 N" from `currentCorrectStreak`. Only show when streak >= 2 (don't show "🔥 0/1"), so it reads as a reward for a run, not clutter.
- **Topic-mastery summary:** a COMPACT, kid-friendly display of topic progress using `topicLabel()` for RU names and `topicStats[id].status`. First pass — keep it minimal and unobtrusive (e.g. a small "освоено N / M тем" summary, or a compact row of topic chips colored by status). Do NOT clutter every exercise screen; planner picks a clean placement (a slim row under the progress bar, or a small always-visible summary). This is a first-pass we can refine after live review.

### Claude's Discretion
- Exact Web Audio synthesis params for the coin cling (two short high notes, ~80–120ms, gentle gain envelope to avoid clicks).
- Exact progress-bar visual (height, fill color from palette, animation or not).
- Exact topic-mastery layout/placement within the "compact & unobtrusive" constraint.
- Whether to keep the agent hint as a secondary line or drop it (authored hint is the requirement either way).

</decisions>

<specifics>
## Specific Ideas

- Reward-diff hook for the sound is the SAME spot as `RewardToast` (main.ts ~line 210, `rewardsDelta > 0`).
- `.inline-blank` inline CSS already exists from 260707-hby.
- `topicLabels.ts` already maps all 8 topic ids to RU display names (built in 260706-nxg) — reuse for #4's topic-mastery summary.

</specifics>

<canonical_refs>
## Canonical References

- `CLAUDE.md` — constraints (no backend, no external assets beyond the scoped LLM proxy, vanilla TS, createElement/textContent only, deterministic core owns state).
- `.planning/STATE.md` — Pending Todos where these findings were recorded during manual testing.

</canonical_refs>
