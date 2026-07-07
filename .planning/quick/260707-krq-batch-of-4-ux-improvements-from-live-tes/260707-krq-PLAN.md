---
phase: 260707-krq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/ui/sound/coin.ts
  - src/main.ts
  - src/ui/exercise-renderers/textInput.ts
  - src/ui/components/FeedbackBanner.ts
  - src/ui/components/ProgressBar.ts
  - src/ui/components/StreakChip.ts
  - src/ui/components/TopicMasterySummary.ts
  - src/style.css
  - tests/helpers/multiBlankAnswers.ts
  - tests/ui/exercise-renderers/textInput.test.ts
  - tests/ui/sound/coin.test.ts
  - tests/ui/components/ProgressBar.test.ts
  - tests/ui/components/StreakChip.test.ts
  - tests/ui/components/TopicMasterySummary.test.ts
  - tests/main.test.ts
autonomous: true
requirements: [UX-COIN-01, UX-INLINE-02, UX-HINT-03, UX-PROGRESS-04]

must_haves:
  truths:
    - "When rubles are awarded, a short synthesized coin cling plays; if AudioContext is unavailable/blocked it degrades silently and never throws"
    - "Every text-input exercise (including single-blank) renders its blank(s) as inline inputs replacing '___' — no separate box below, no literal '___' left in the sentence"
    - "On a wrong text-input answer the authored hint shows first: attempt 1 → hint.firstError, attempt 2+ → hint.secondError (falling back to firstError when absent)"
    - "The top bar shows a visual progress bar for main/review/complete passes without overshoot, a 🔥 streak chip when currentCorrectStreak >= 2, and a compact topic-mastery summary from topicStats"
  artifacts:
    - src/ui/sound/coin.ts
    - src/ui/components/ProgressBar.ts
    - src/ui/components/StreakChip.ts
    - src/ui/components/TopicMasterySummary.ts
  key_links:
    - "main.ts rewardsDelta > 0 branch calls playCoinSound() alongside renderRewardToast"
    - "main.ts hint computation reads store.getState().exerciseStats[exerciseId].attempts AFTER handleAnswer resolves"
    - "textInput.ts inline-blank path drives blankCount >= 1 (was >= 2); reconstruction for a single blank is blankInputs[0].value"
    - "top-bar in main.ts render() mounts ProgressBar + StreakChip + TopicMasterySummary reading currentPosition / currentCorrectStreak / topicStats"
---

<objective>
Ship four UX improvements surfaced during live manual testing of English Quest, exactly as LOCKED in 260707-krq-CONTEXT.md:

1. Coin-clink sound synthesized via Web Audio when rubles are awarded (UX-COIN-01).
2. Unify ALL text-input exercises to inline blanks — single-blank currently uses an inconsistent separate-box layout (UX-INLINE-02).
3. Escalating authored hints on wrong answers, firstError → secondError by attempt count (UX-HINT-03).
4. Surface progress in the UI: progress bar + correct-streak chip + topic-mastery summary (UX-PROGRESS-04).

Purpose: Close concrete UX gaps found in a real child-testing session — audio feedback for reward, consistent blank rendering, more helpful escalating hints, and visible progress/motivation.

Output: One new sound helper, three new UI components, edits to main.ts/textInput.ts/FeedbackBanner.ts, new CSS, and test coverage. No new npm packages, no Lesson-1A.json schema changes, no backend.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/260707-krq-batch-of-4-ux-improvements-from-live-tes/260707-krq-CONTEXT.md
@.claude/CLAUDE.md
@.planning/STATE.md

# Reward-diff hook site (~line 210) + hint computation (~line 222) + top-bar block (~line 60-104)
@src/main.ts
# Blank-splitting renderer — the inline-vs-single-box branch to unify
@src/ui/exercise-renderers/textInput.ts
# Feedback banner — may gain a supplementary muted hint line
@src/ui/components/FeedbackBanner.ts
# 3-variant guarding pattern to mirror for the progress bar (main/review/complete)
@src/ui/components/ProgressIndicator.ts
# Transient-UI-cue pattern (the coin sound fires alongside this)
@src/ui/components/RewardToast.ts
# State shape: currentCorrectStreak, topicStats{status,...}, exerciseStats{attempts}
@src/core/state/progressSchema.ts
# topicLabel(id) → RU display names for the topic-mastery summary
@src/core/topics/topicLabels.ts
# HintSchema: firstError required, secondError optional (9/19 have it)
@src/core/lesson/lessonSchema.ts
# Palette tokens, .top-bar, .ruble-balance, .progress-indicator, .inline-blank
@src/style.css
# Test helper that fills single/multi blanks — needs single-inline-blank handling
@tests/helpers/multiBlankAnswers.ts
@tests/ui/exercise-renderers/textInput.test.ts
@tests/main.test.ts
</context>

<constraints>
- Vanilla TS + `document.createElement` / `textContent` only. NEVER `innerHTML` (project rule; existing tests grep sources for `/innerHTML/`).
- No new npm packages. No backend. No external asset files (the coin sound is synthesized, not loaded).
- No changes to `checkTextInput` / `normalize` / the `onSubmit(rawAnswer)` contract / `lessonEngine`. The deterministic core owns all state and numbers.
- No Lesson-1A.json schema changes. `HintSchema.secondError` is `.optional()` — always fall back to `firstError`.
- WCAG AA (>= 4.5:1) for any new text/colors on the cream bg `#fff8e7`. Compute contrast against existing tokens (see `--color-muted` #6b6b6b @ 5.03:1, `--color-success-dark` #238038 @ 4.70:1), do not eyeball. Prefer reusing existing tokens.
- Full suite (`npx vitest run`, 270 tests) stays green; `npx tsc --noEmit` clean.
</constraints>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Synthesized coin-clink sound on ruble award (UX-COIN-01)</name>
  <files>src/ui/sound/coin.ts, tests/ui/sound/coin.test.ts, src/main.ts</files>
  <behavior>
    - playCoinSound() returns without throwing when neither window.AudioContext nor window.webkitAudioContext exists (jsdom case — this is what keeps main.test.ts green).
    - playCoinSound() returns without throwing when constructing/using AudioContext throws (autoplay-blocked / SecurityError case).
    - When a working AudioContext-like stub is provided, playCoinSound() creates oscillator + gain nodes, connects them, and calls start/stop (two short notes) — proving the happy path wires nodes.
    - The single AudioContext is created lazily and reused across calls (not re-created every call).
  </behavior>
  <action>
    Create src/ui/sound/coin.ts exporting `playCoinSound(): void`. Resolve the constructor from `window.AudioContext ?? (window as any).webkitAudioContext`; if none, return early. Lazily create ONE module-level AudioContext on first successful call and reuse it (module-scoped `let ctx: AudioContext | null`). Synthesize a short two-note "cling": two OscillatorNodes (e.g. ~988 Hz then ~1319 Hz — high, bell-like) each through its own GainNode, with a gentle attack/decay gain envelope (setValueAtTime + linearRampToValueAtTime / exponentialRampToValueAtTime, ~80-120ms total, no hard on/off to avoid clicks), the second note starting ~60-90ms after the first, each stopped after its envelope. Connect gain → ctx.destination. Wrap the ENTIRE body in try/catch (per CONTEXT.md #1) so an unavailable or autoplay-blocked AudioContext, or any node-graph error, NEVER throws — silent no-op on failure. If `ctx.state === "suspended"`, call `ctx.resume()` inside the try (best-effort; ignore rejection). No mute toggle this pass. No external audio file. Exact synthesis params are Claude's discretion within the "short, non-annoying, click-free cling" constraint.

    In src/main.ts: import playCoinSound from "./ui/sound/coin". In the EXISTING `if (rewardsDelta > 0)` branch (currently ~line 211, right where `renderRewardToast` is mounted), call `playCoinSound()` alongside mounting the toast. Order: call playCoinSound() then mount the toast (or vice-versa — both are side effects; keep it inside the existing branch, one call, no new state). Do NOT add any await — playCoinSound is synchronous fire-and-forget.
  </action>
  <verify>
    <automated>npx vitest run tests/ui/sound/coin.test.ts</automated>
  </verify>
  <done>playCoinSound never throws when AudioContext is absent (jsdom) or when a stub throws; wires oscillator/gain nodes when a working stub is supplied; reuses one lazily-created context; main.ts calls it in the rewardsDelta > 0 branch. tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Unify all text-input blanks to inline rendering (UX-INLINE-02)</name>
  <files>src/ui/exercise-renderers/textInput.ts, tests/ui/exercise-renderers/textInput.test.ts, tests/helpers/multiBlankAnswers.ts</files>
  <behavior>
    - A single-blank exercise (e.g. ex005 "I ___ going out to restaurants. (love)") renders exactly ONE input, and it carries the inline-blank class; there is NO separate full-width box below and NO literal three-underscore marker left in the prompt text.
    - For a single blank, the reconstructed submitted string equals blankInputs[0].value verbatim (so checkTextInput still accepts a correct value, identical onSubmit contract).
    - Multi-blank behavior (ex002/ex003/ex004) is unchanged: one inline input per blank, interior words visible between inputs, reconstruction interleaves interior segments.
    - A prompt with ZERO blank markers still renders a single input below (no-blank fallback) and never crashes.
    - Submit stays disabled until every blank is non-empty (single and multi).
  </behavior>
  <action>
    In src/ui/exercise-renderers/textInput.ts: change the branch guard so the inline-per-blank path drives `blankCount >= 1` instead of `blankCount >= 2`. Concretely, replace the current `if (blankCount <= 1) { ...single-box path... }` early-return so that the single-box layout is used ONLY when `blankCount === 0` (the no-blank fallback), and the inline path handles `blankCount >= 1`. Keep the no-blank fallback (blankCount === 0) rendering one input appended to the container as today, so a prompt without the blank marker never crashes.

    The existing inline path already generalizes to one blank: `parts[0]` (leading text) + one inline input + `parts[1]` (trailing text) rendered into the prompt paragraph, and the reconstruction loop `rawAnswer = blankInputs[0].value; for (i=1..blankCount-1) rawAnswer += parts[i] + blankInputs[i].value` yields exactly `blankInputs[0].value` when blankCount === 1. Do NOT special-case single-blank reconstruction — the general loop is already correct. Do NOT touch checkTextInput / normalize / the onSubmit(rawAnswer) shape / lessonEngine. The `.inline-blank` CSS already exists (260707-hby) and applies.

    Update tests/ui/exercise-renderers/textInput.test.ts: the existing test "single-blank exercise renders exactly one input and submits its raw value verbatim" currently asserts `.inline-blank` has length 0 and that submitting a full string is echoed verbatim. Migrate it to the NEW contract: the single blank IS an inline-blank input (querySelectorAll(".inline-blank") has length 1, total text inputs === 1), the prompt paragraph contains NO literal blank marker, and filling that one inline input then clicking Проверить submits exactly the typed value. Add a test for the no-blank fallback (a prompt string with no marker renders one input and does not throw). Keep all existing multi-blank tests passing.

    Update tests/helpers/multiBlankAnswers.ts `fillCorrectTextAnswer`: it currently assumes any `.inline-blank` presence means a multi-blank exercise and requires a MULTI_BLANK_ANSWERS entry. Now single-blank exercises also render one `.inline-blank`. Fix the branch: when exactly one inline-blank input is present AND MULTI_BLANK_ANSWERS has no entry for the exerciseId, fill that single blank with `fullAnswer` (the single-input behavior). Keep the multi-blank path (2+ inline blanks, or a known MULTI_BLANK_ANSWERS id) exactly as-is. This keeps main.test.ts and the e2e traversal/review tests green now that single-blank exercises render inline.
  </action>
  <verify>
    <automated>npx vitest run tests/ui/exercise-renderers/textInput.test.ts tests/e2e/fullLessonTraversal.test.ts</automated>
  </verify>
  <done>Single-blank exercises render one inline input with no separate box and no leftover blank marker; reconstruction === typed value; multi-blank and no-blank cases unchanged; the fill helper handles single-inline-blank; full-traversal e2e stays green. tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Escalating authored hints on wrong answers (UX-HINT-03)</name>
  <files>src/main.ts, src/ui/components/FeedbackBanner.ts, tests/main.test.ts</files>
  <behavior>
    - On a wrong answer with attempts === 1, the banner's primary hint is exercise.hint.firstError.
    - On a wrong answer with attempts >= 2, the primary hint is exercise.hint.secondError.
    - On a wrong answer with attempts >= 2 when secondError is absent, the primary hint falls back to exercise.hint.firstError.
    - The authored hint is what drives the banner (agent hintRu no longer replaces it).
  </behavior>
  <action>
    In src/main.ts, replace the current hint computation (~line 222): `const hint = result.hintRu ?? ("hint" in exercise ? exercise.hint.firstError : undefined);`. Invert to AUTHORED-FIRST with escalation per CONTEXT.md #3. After `engine.handleAnswer(...)` resolves (attempt already recorded), read the attempt count from `store.getState().exerciseStats[exercise.exerciseId]?.attempts ?? 0`. Compute the authored hint only for exercises that carry one (`"hint" in exercise`): `attempts >= 2 ? (exercise.hint.secondError ?? exercise.hint.firstError) : exercise.hint.firstError`. This authored hint becomes the PRIMARY `hint` passed into `feedback`/`renderFeedbackBanner`. secondError is optional (only 9/19 exercises define it) — always fall back to firstError; never let an undefined secondError blank the hint.

    Agent hint (`result.hintRu`): per CONTEXT.md it is now SUPPLEMENTARY only and must never replace the authored hint. Planner's discretion (granted in CONTEXT.md) — the CLEANEST implementation is to DROP the agent hint from the banner entirely this pass (the authored escalating hint is the requirement, and the earlier live-test issue was a confusing agent hint replacing the reliable authored one). Do NOT append the agent hintRu as a secondary line unless it is trivially safe; default choice = drop it, keeping FeedbackBanner's signature and behavior unchanged (no secondary-line extension needed). If you keep it, add it only as a muted secondary `<p>` below the authored hint in FeedbackBanner and pass it as a distinct optional arg — but the default recommendation is to not.

    Only text-input escalates in practice (repeated same-screen tries on the unchanged exercise). Non-text types record attempts === 1 on their single try and keep showing firstError — the same code path handles them correctly. Do NOT change how/when the banner is mounted (the four consumption branches in onSubmit stay as-is); only the `hint` value fed into `feedback` changes.

    Add tests in tests/main.test.ts driving a wrong text-input answer once (assert firstError text appears in the feedback banner), then a second wrong answer on the SAME exercise (assert secondError text appears for an exercise that has one, e.g. ex001/ex005), and a wrong answer on an exercise WITHOUT secondError repeated twice (assert firstError still shown, not blank). Use the existing mountApp + stubbed-fetch + mocked-agent harness; mock the Answer Checker / core to return an incorrect verdict for the deliberately-wrong input.
  </action>
  <verify>
    <automated>npx vitest run tests/main.test.ts</automated>
  </verify>
  <done>Wrong-answer hint escalates authored firstError (attempt 1) → secondError (attempt 2+), falling back to firstError when secondError is absent; agent hintRu no longer replaces the authored hint; banner mount branches unchanged. tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Progress bar + streak chip components with state guarding (UX-PROGRESS-04)</name>
  <files>src/ui/components/ProgressBar.ts, src/ui/components/StreakChip.ts, tests/ui/components/ProgressBar.test.ts, tests/ui/components/StreakChip.test.ts, src/main.ts, src/style.css</files>
  <behavior>
    - renderProgressBar(current, total) produces a filled bar whose fill fraction is current/total, clamped so it never overshoots 100% (current > total → full, never wider).
    - A complete/review state renders a full (or correctly-bounded) bar, never a > 100% fill.
    - renderStreakChip(streak) returns a chip element for streak >= 2 and returns null (or an empty/absent marker) for streak < 2, so "🔥 0" / "🔥 1" never render.
    - The streak chip text reflects the streak count (e.g. "🔥 3").
  </behavior>
  <action>
    Create src/ui/components/ProgressBar.ts exporting `renderProgressBar(current: number, total: number): HTMLElement`. Build a track `<div class="progress-bar">` containing a fill `<div class="progress-bar-fill">`; set the fill width from `Math.max(0, Math.min(1, total > 0 ? current / total : 0)) * 100` percent via `style.width` (a numeric style assignment, not innerHTML). This clamp is the overshoot guard mirroring ProgressIndicator's 3-variant guarding (main/review/complete) — the caller passes complete/review-appropriate current/total; the clamp guarantees no bar ever exceeds 100% even if current > total. createElement/textContent/style only. Add an aria-label or role="progressbar" with aria-valuenow/valuemin/valuemax for accessibility (numeric attributes, no text on cream bg to contrast-check for the bar fill itself — but ensure the fill color meets a visible/contrast-appropriate choice from the palette).

    Create src/ui/components/StreakChip.ts exporting `renderStreakChip(streak: number): HTMLElement | null`. Return `null` when `streak < 2` (per CONTEXT.md: only show for a run of 2+). Otherwise return `<span class="streak-chip">` with textContent `🔥 ${streak}`. createElement/textContent only.

    In src/style.css add: `.progress-bar` (a slim track — e.g. height ~8-10px, border-radius, a muted track background from an existing token like --color-bg-secondary-dark) and `.progress-bar-fill` (100%-height fill using a palette token — --color-accent-dark or --color-success work; pick one that is clearly visible on the track). `.streak-chip` styled like the sibling `.ruble-balance` chip (inline-flex, rounded, padded) but visually distinct (e.g. a highlight/orange border). Any TEXT color you introduce on the cream `#fff8e7` bg must be >= 4.5:1 — reuse --color-text (#111827) or the already-verified --color-muted/--color-success-dark tokens; the 🔥 emoji chip text should sit on a chip background, so verify text-on-chip-bg contrast (compute it, don't eyeball). Do NOT introduce a new raw hex without a computed contrast ratio noted in a CSS comment.

    In src/main.ts render(): inside the existing top-bar block (the `if (state.currentPosition.theoryUnderstood)` section, ~line 76-104), append `renderProgressBar(...)` reflecting the current pass. Reuse the SAME completion/review signals already computed there: for the main pass use `state.currentPosition.currentExerciseIndex + 1` / `engine.totalExercises`; when `engine.getCurrentExercise()` is null (complete) pass `engine.totalExercises / engine.totalExercises` (full, no overshoot); for the review pass use the existing `consumed + 1` / `reviewPassTotal`. Keep the existing "Задание N из 19" text indicator too (do not remove renderProgressIndicator*). Also append the streak chip: call `renderStreakChip(state.currentCorrectStreak)` near the ruble chip (~line 74) and only appendChild it when it returns non-null.
  </action>
  <verify>
    <automated>npx vitest run tests/ui/components/ProgressBar.test.ts tests/ui/components/StreakChip.test.ts</automated>
  </verify>
  <done>Progress bar fill = clamped current/total (never > 100%) across main/review/complete; streak chip shows only for streak >= 2 with correct count; both mounted in the top bar without removing the existing "Задание N из 19" text; new CSS meets WCAG AA with computed ratios noted. tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Compact topic-mastery summary + integration and full-suite green (UX-PROGRESS-04)</name>
  <files>src/ui/components/TopicMasterySummary.ts, tests/ui/components/TopicMasterySummary.test.ts, src/main.ts, src/style.css, tests/main.test.ts</files>
  <behavior>
    - renderTopicMasterySummary(topicStats) renders a compact summary using topicLabel() for RU names and topicStats[id].status.
    - It shows a mastered-count summary (e.g. "освоено N / M тем") where N = topics with status "mastered" and M = total topics present in topicStats.
    - With an empty topicStats it renders a safe zero-state ("освоено 0 / 0 тем" or an empty/absent element) and never throws.
    - Topic display names come from topicLabel(id), never raw snake_case ids.
  </behavior>
  <action>
    Create src/ui/components/TopicMasterySummary.ts exporting `renderTopicMasterySummary(topicStats: Record<string, TopicStat>): HTMLElement` (import the `TopicStat` type from src/core/state/progressSchema and `topicLabel` from src/core/topics/topicLabels). Build a COMPACT, unobtrusive display per CONTEXT.md #4: a small summary line `<div class="topic-mastery">` whose primary text is `освоено ${masteredCount} / ${total} тем` where masteredCount = count of entries with `status === "mastered"` and total = `Object.keys(topicStats).length`. Optionally (planner's discretion, keep minimal) render a compact row of small status-colored chips — one `<span class="topic-chip topic-chip--{status}">` per topic with textContent `topicLabel(id)` — but keep it a single slim row and do NOT clutter; if it risks visual clutter, ship ONLY the "освоено N / M тем" summary line for this first pass. Guard the empty case (no topics → "освоено 0 / 0 тем", never divide/throw). createElement/textContent only; RU names via topicLabel(id).

    In src/style.css add `.topic-mastery` as a slim, muted line (small font, --color-muted #6b6b6b which is verified 5.03:1 on #fff8e7). If you ship status chips, define `.topic-chip` + per-status modifiers using palette tokens; any text color on the cream bg must be >= 4.5:1 (reuse verified tokens, note computed ratios in CSS comments). Placement: a slim row directly under the progress bar / top bar, or an unobtrusive spot in the top-bar block — pick the cleaner placement; do NOT render it on every exercise card, only once in the shared top-bar/header region.

    In src/main.ts render(): mount `renderTopicMasterySummary(state.topicStats)` once in the top-bar/header region (below the progress bar), inside the same `theoryUnderstood` guard so it appears during the lesson. Reads `state.topicStats` only — no new state, no core changes.

    Finally, run the FULL suite and typecheck. Add a test in tests/ui/components/TopicMasterySummary.test.ts covering: mastered count from a topicStats fixture with mixed statuses, RU labels via topicLabel, and the empty-topicStats zero-state (no throw). Then confirm the whole existing 270-test suite plus all new tests are green and tsc is clean.
  </action>
  <verify>
    <automated>npx vitest run && npx tsc --noEmit</automated>
  </verify>
  <done>Topic-mastery summary renders "освоено N / M тем" from topicStats using topicLabel() RU names, handles empty state safely, is mounted once in the top-bar region; full vitest suite (existing 270 + all new tests) passes and tsc --noEmit is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser Web Audio API → app | AudioContext may be unavailable or blocked by autoplay policy before a user gesture |
| persisted localStorage state → render | topicStats / exerciseStats / currentCorrectStreak are read to drive new UI (progress bar, streak chip, topic summary, hint escalation) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-krq-01 | Denial of Service | src/ui/sound/coin.ts (AudioContext unavailable/blocked) | low | mitigate | Entire playCoinSound body wrapped in try/catch; missing constructor returns early — a blocked or absent AudioContext is a silent no-op, never a thrown error that breaks the lesson flow (verified by coin.test.ts under jsdom which has no AudioContext) |
| T-krq-02 | Tampering | localStorage state read into new UI (progress/streak/topic/hint) | low | mitigate | State already validated by ProgressStateSchema on load(); new render code adds only clamping (progress fill Math.min(1, ...)) and safe optional reads (`?.attempts ?? 0`, empty topicStats zero-state) so malformed/absent fields degrade to safe defaults rather than crashing render |
| T-krq-03 | Information Disclosure | rendered RU text on cream bg | low | accept | No secrets involved; only WCAG-AA contrast is a concern, handled by reusing verified palette tokens with computed ratios — not a security-severity item |
| T-krq-SC | Tampering | npm/pip/cargo installs | low | accept | No new packages are installed this task (constraint: no new npm packages); no supply-chain surface added |
</threat_model>

<verification>
- `npx vitest run` — full suite (existing 270 tests + all new tests) passes.
- `npx tsc --noEmit` — no type errors.
- Sources contain no `innerHTML` (existing per-renderer tests grep for `/innerHTML/`).
- coin.ts never throws when AudioContext is absent (jsdom) or when a stub throws.
- Single-blank text-input renders one inline input, no separate box, no leftover blank marker; reconstruction === typed value.
- Wrong-answer hint escalates authored firstError → secondError (fallback firstError when absent).
- Progress bar fill never overshoots 100% across main/review/complete; streak chip only shows for streak >= 2; topic-mastery summary renders "освоено N / M тем" from topicStats with RU labels.
</verification>

<success_criteria>
- All four LOCKED CONTEXT.md decisions implemented exactly (coin sound synthesized + silent-degrade; all text-input blanks inline; authored escalating hints; progress bar + streak chip + topic-mastery summary).
- No new npm packages, no backend, no external asset files, no Lesson-1A.json schema changes.
- checkTextInput / normalize / onSubmit / lessonEngine contracts unchanged.
- Any new text/color on #fff8e7 meets WCAG AA (>= 4.5:1) with computed ratios noted.
- Full vitest suite and tsc --noEmit both clean.
</success_criteria>

<output>
Create `.planning/quick/260707-krq-batch-of-4-ux-improvements-from-live-tes/260707-krq-01-SUMMARY.md` when done.
</output>
