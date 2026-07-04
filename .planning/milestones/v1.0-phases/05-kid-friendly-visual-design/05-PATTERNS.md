# Phase 5: Kid-Friendly Visual Design - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 14 (2 CSS/global, 3 screens, 4 exercise renderers, 3 components, 1 new component, 1 test-file gap area)
**Analogs found:** 14 / 14 (this phase touches almost exclusively existing files; every "new" surface is a small addition to an existing analog, not a fresh pattern)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/style.css` | config (design tokens + component CSS) | transform (values only, same structure) | itself (Phase 1 baseline) | exact — extend in place |
| `src/main.ts` (top-bar ruble chip, thinking-indicator wiring, feedback-clear fix, progress-overshoot fix) | controller (render orchestrator) | request-response (event handler -> await agent -> render) | itself (Phase 1-4 baseline) | exact — same file, additive edits |
| `src/ui/components/ThinkingIndicator.ts` (NEW FILE) | component | transform (pure render function) | `src/ui/components/FeedbackBanner.ts` | role-match (closest existing "small stateless render-a-status-element" component) |
| `src/ui/components/RewardToast.ts` (NEW FILE, implied by D-10/UI-02) | component | event-driven (fires on reward event, auto-dismiss) | `src/ui/components/FeedbackBanner.ts` | role-match |
| `src/ui/components/ProgressIndicator.ts` (add completion variant) | component | transform (pure render function) | itself (`renderReviewProgressIndicator` sibling function in same file) | exact |
| `src/ui/components/FeedbackBanner.ts` | component | transform (pure render function) | itself (re-skin only, no logic change) | exact |
| `src/ui/components/FatalError.ts` | component | transform (pure render function, DOM-mutating) | itself (re-skin only) | exact |
| `src/ui/screens/TheoryScreen.ts` | component (screen) | request-response (button -> callback) | itself (re-skin only, structure unchanged) | exact |
| `src/ui/screens/ExerciseScreen.ts` | component (screen, thin dispatcher) | request-response | itself (re-skin only) | exact |
| `src/ui/screens/SessionEndScreen.ts` | component (screen) | transform (pure render function) | itself (re-skin + hero spacing) | exact |
| `src/ui/exercise-renderers/textInput.ts` | component | request-response (input -> onSubmit) | `src/ui/exercise-renderers/singleChoice.ts` (near-identical submit-row/accent-button shape) | exact (sibling exercise renderer) |
| `src/ui/exercise-renderers/singleChoice.ts` | component | request-response | `src/ui/exercise-renderers/matching.ts` (shares option-button + accent-toggle pattern) | exact |
| `src/ui/exercise-renderers/matching.ts` | component | request-response | `src/ui/exercise-renderers/orderBuilder.ts` (shares chip/zone pattern) | exact |
| `src/ui/exercise-renderers/orderBuilder.ts` | component | request-response | `src/ui/exercise-renderers/matching.ts` | exact |
| `tests/main.test.ts` (NEW FILE, Wave 0 gap) | test | request-response (render/branching assertions) | `tests/ui/components/ProgressIndicator.test.ts` | role-match (closest existing DOM-assertion test style) |
| `tests/ui/components/ThinkingIndicator.test.ts` (NEW FILE) | test | transform | `tests/ui/components/ProgressIndicator.test.ts` | exact (same describe/it/textContent-assertion shape) |

## Pattern Assignments

### `src/style.css` (config, transform)

**Analog:** itself — `src/style.css` (175 lines, read in full)

**Token structure to extend, not replace** (lines 5-20):
```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  /* Phase 5 ADDS --space-2xl: 48px; --space-3xl: 64px per UI-SPEC Spacing Scale */

  --color-bg: #ffffff;            /* -> #FFF8E7 per UI-SPEC Color table */
  --color-bg-secondary: #f3f4f6;  /* -> #DCEEFF */
  --color-accent: #2563eb;        /* -> #2E7DF7 */
  --color-error: #dc2626;         /* -> #E8544A */
  --color-success: #16a34a;       /* -> #3DBB5E */
  --color-text: #111827;          /* keep or lightly adjust — UI-SPEC doesn't redefine text color */
  /* Phase 5 ADDS: --color-accent-dark, --color-error-dark, --color-success-dark,
     --color-highlight: #FFC93C, --color-highlight-dark — darker-shade pairs per
     UI-SPEC's "Border color technique" (~15-20% lightness reduction each) */
}
```

**Typography roles to bump** (lines 46-63) — same selector names, new size/weight values (UI-SPEC Typography table: Label 14/700, Heading 22/700, Display 32/700, Body stays 16/400/1.5). Do not rename `.heading`/`.display`/`.label` classes — every screen file already references them.

**Button base + accent pattern to extend** (lines 98-122) — this is the single most important block to modify, since EVERY exercise renderer's submit button and every screen's toggle button inherits from here:
```css
button {
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;   /* -> 700 per UI-SPEC */
  min-height: 44px;
  min-width: 44px;
  padding: var(--space-sm) var(--space-md);
  border: none;       /* -> 3px solid var(--color-*-dark) per element per D-04 */
  border-radius: 6px;  /* -> 14px per D-04/UI-SPEC Shape Language */
  background: var(--color-bg-secondary);
  color: var(--color-text);
  cursor: pointer;
}

button.accent,
button.selected {
  background: var(--color-accent);
  color: #ffffff;
}
```
Apply Pattern 2 from RESEARCH.md (chunky offset-shadow technique) to `button.accent` specifically (primary CTAs only, not every button — D-06's 52px height + shadow is an EXCEPTION for `.accent` submit/continue/show-results buttons, not the base `button` rule). Scope the 52px CTA height to a dedicated class (e.g. `.submit-row button.accent`, `.show-results-button`, `.continue-button`) — do NOT bump base `button` min-height past 44px, or chips/toggles (`.bank-chip`, `.sequence-chip`, `.option`, theory buttons) will incorrectly inherit the CTA-only exception (RESEARCH.md Pitfall 3).

**Feedback banner border-color-only pattern to extend** (lines 148-163) — already matches D-03's "error red sparingly, border/icon only, never full-bleed" requirement structurally; only needs new hex values + the bounce/shake keyframes:
```css
.feedback-banner.correct {
  border-color: var(--color-success);
  color: var(--color-success);
}
.feedback-banner.incorrect {
  border-color: var(--color-error);
  color: var(--color-error);
}
```
Add `@keyframes bounce-in` (350ms ease-out) applied to `.feedback-banner.correct` and `@keyframes gentle-shake` (300ms ease-in-out, single pass) applied to `.feedback-banner.incorrect`, per UI-SPEC Motion Contract.

**New component classes to add** (no existing analog — net-new CSS, but same file/convention):
- `.thinking-indicator` — pulsing circle, `@keyframes pulse { opacity: 0.4 -> 1 -> 0.4 }`, 1000ms ease-in-out infinite + `prefers-reduced-motion` fallback (RESEARCH.md Pattern 3).
- `.reward-toast` — slide-up+fade-in/out, background `var(--color-highlight)`, border `var(--color-highlight-dark)` (RESEARCH.md Code Examples).
- `.ruble-balance` — top-bar chip, small pill-ish (but not fully circular per D-04) with the ₽ glyph.

---

### `src/main.ts` (controller, request-response)

**Analog:** itself — read in full (306 lines)

**Thinking-indicator insertion — 3 call sites, all follow the SAME existing disable/await/finally shape.** Copy this exact structure (already present, lines 94-104) and only ADD the indicator element, do not restructure the try/finally:
```typescript
// Existing pattern at all 3 sites (theory buttons ~94-104, exercise submit
// ~135-156, "Показать итоги" ~271-283) — disable -> unsubscribe -> await ->
// finally { resubscribe, re-enable }. Phase 5 adds an appended/removed
// ThinkingIndicator element inside this exact same try/finally, nothing else
// changes in the control flow.
buttons.forEach((btn) => (btn.disabled = true));
const thinkingEl = renderThinkingIndicator();
theoryNode.appendChild(thinkingEl); // or exerciseNode / main, per call site
let result;
try {
  unsubscribeRender();
  result = await engine.handleTheoryStep(understood);
} finally {
  thinkingEl.remove();
  unsubscribeRender = store.subscribe(render);
  buttons.forEach((btn) => (btn.disabled = false));
}
```

**Ruble-balance top-bar insertion** — same block that builds `topBar` (lines 50-76), append a new chip element right after `title`, reading `state.currentRewards` (already proven live at line 263's `rublesEarned: state.currentRewards` in the SessionEndScreen call):
```typescript
const rubleChip = document.createElement("span");
rubleChip.className = "ruble-balance";
rubleChip.textContent = `${state.currentRewards} ₽`;
topBar.appendChild(rubleChip);
```

**D-12 Gap 1 fix (feedback banner not cleared)** — root cause and exact fix location confirmed in RESEARCH.md Pitfall 1: add an explicit `feedback = null` reset once the banner has been shown for the render it targeted. Minimal-diff approach: set `feedback = null` at the top of the correct-answer `render(store.getState())` branches (lines 174, 182) AFTER the feedback object has already been captured/used for that one render — i.e., call `render()` first, then null it, OR pass a "consumed" flag. Follow the existing comment style (this file's inline reasoning comments, e.g. lines 162-170, 216-229) when documenting the fix.

**D-12 Gap 2 fix (progress overshoot)** — exact same top-bar block (lines 57-75) needs the SAME completion check the main-content block already uses at line 118 (`const exercise = engine.getCurrentExercise();`). Reuse that signal, do not duplicate detection logic:
```typescript
// RESEARCH.md Code Examples — reuses the SAME `!exercise` signal the
// main-content block computes at line 118, per D-12's "fix at the call
// site, one completion signal" recommendation.
if (state.currentPosition.theoryUnderstood) {
  if (engine.isReviewPass()) {
    // ...existing review-pass branch, unchanged (lines 58-66)
  } else {
    const exercise = engine.getCurrentExercise();
    if (!exercise) {
      topBar.appendChild(renderProgressIndicatorComplete(engine.totalExercises));
    } else {
      topBar.appendChild(
        renderProgressIndicator(state.currentPosition.currentExerciseIndex + 1, engine.totalExercises),
      );
    }
  }
}
```
Note: this duplicates the `getCurrentExercise()` call already made later at line 118 inside `main`'s block — acceptable per RESEARCH.md (pure getter, no side effect), but the planner may choose to hoist ONE call to the top of `render()` and reuse the result in both blocks, which is cleaner and avoids two separate lookups per render.

**Reward toast trigger — IMPORTANT CORRECTION to RESEARCH.md Assumption A1.** `HandleAnswerResult` (confirmed via direct read of `src/core/lessonEngine.ts` line 40-42) is:
```typescript
export interface HandleAnswerResult extends CheckResult {
  praiseRu?: string;
}
// CheckResult (src/core/answer-checking/checkTextInput.ts:13-19):
// { isCorrect, source, errorType?, confidence?, hintRu? }
```
There is **no `rewardAmount` field on `HandleAnswerResult`** — RESEARCH.md's Assumption A1/Pitfall 4 code example is WRONG as written and must not be copied verbatim. Reward events are computed and dispatched entirely inside `LessonEngine.handleAnswer()` (via `computeRewardEvents()` in `src/core/rewards/rewardEngine.ts`) and folded into `state.currentRewards` (the running total) BEFORE `render()` fires. The toast trigger must instead diff `state.currentRewards` before/after the `handleAnswer()` await inside the `onSubmit` handler (main.ts lines 140-156) — capture `const before = store.getState().currentRewards;` immediately before the `try`, then after `result = await engine.handleAnswer(...)`, compare `store.getState().currentRewards - before` and fire the toast with that delta if `> 0`. This is a before/after diff BUT it is safe here (unlike RESEARCH.md's general warning against diffs) because `handleAnswer` is the ONLY call site that can change `currentRewards` between these two reads, and it runs to completion synchronously relative to this one dispatch cycle (Pitfall 3's established single-dispatch-window reasoning already documented in this file, lines 142-150, applies identically to reading `currentRewards` before/after).

---

### `src/ui/components/ThinkingIndicator.ts` (NEW FILE — component, transform)

**Analog:** `src/ui/components/FeedbackBanner.ts` (closest existing "small pure render function returning one DOM element, createElement/textContent only")

**Pattern to copy** (full file, 20 lines):
```typescript
// Correct/incorrect feedback (textContent only, never innerHTML).
export function renderFeedbackBanner(isCorrect: boolean, firstErrorHint?: string): HTMLElement {
  const el = document.createElement("div");
  el.className = `feedback-banner ${isCorrect ? "correct" : "incorrect"}`;
  // ... textContent assignments only, zero innerHTML
  return el;
}
```
New file should mirror this exact shape:
```typescript
export function renderThinkingIndicator(): HTMLElement {
  const el = document.createElement("div");
  el.className = "thinking-indicator";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = "Секунду, думаю…";
  return el;
}
```
No props/options object needed (unlike `FeedbackBanner`'s `isCorrect`/`firstErrorHint` params) — this is the simplest component in the codebase, a zero-argument factory.

---

### `src/ui/components/RewardToast.ts` (NEW FILE — component, event-driven)

**Analog:** `src/ui/components/FeedbackBanner.ts` (same createElement/textContent shape) combined with `src/ui/components/ProgressIndicator.ts`'s file-level convention of exporting one small named function per variant.

**Pattern:**
```typescript
export function renderRewardToast(amount: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "reward-toast";
  el.textContent = `+${amount} ₽`;
  return el;
}
```
Caller (`main.ts`) owns mount/auto-dismiss timing (`document.body.appendChild(toast)` + `setTimeout(() => toast.remove(), 1950)`), matching RESEARCH.md's Code Examples section — the component itself stays a pure render function, no internal timers, consistent with every other component in `src/ui/components/`.

---

### `src/ui/components/ProgressIndicator.ts` (component, transform)

**Analog:** itself — the file already has two sibling functions (`renderProgressIndicator`, `renderReviewProgressIndicator`) with an identical shape; the new completion variant is a third sibling, not a new pattern.

**Exact pattern to copy** (full file, 19 lines):
```typescript
export function renderProgressIndicator(current: number, total: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "label progress-indicator";
  el.textContent = `Задание ${current} из ${total}`;
  return el;
}

export function renderReviewProgressIndicator(current: number, total: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "label progress-indicator review-progress-indicator";
  el.textContent = `Повторение: ${current} из ${total}`;
  return el;
}
```
New completion-state function (Pitfall 2 fix support), same file, same convention:
```typescript
export function renderProgressIndicatorComplete(total: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "label progress-indicator progress-indicator-complete";
  el.textContent = `Задание ${total} из ${total}`; // clamp, never total+1
  return el;
}
```

---

### `src/ui/components/FeedbackBanner.ts` (component, transform)

**Analog:** itself — re-skin only (CSS classNames unchanged: `feedback-banner`, `correct`, `incorrect`), no TS logic change needed. The bounce-in/shake animations are pure CSS keyframes applied to the existing `.correct`/`.incorrect` classes in `style.css` — this file requires ZERO edits this phase.

---

### `src/ui/components/FatalError.ts` (component, transform)

**Analog:** itself — re-skin only. `.fatal-error` class + `h1`/`p` structure unchanged; only `style.css` values (error color, spacing) change.

---

### `src/ui/screens/TheoryScreen.ts` (screen, request-response)

**Analog:** itself (65 lines, read in full) — structure fully unchanged, only CSS classNames' computed styles change. The `.theory-buttons` row and `button`/`.accent` classes are the re-skin target; no TS edits required beyond what `main.ts`'s thinking-indicator wiring touches externally (this file's `onUnderstoodChoice` callback signature is untouched).

**Button pattern already established here** (lines 50-58) — reference for any NEW button this phase might add (none required, but the convention for future additions):
```typescript
const understoodButton = document.createElement("button");
understoodButton.type = "button";
understoodButton.textContent = "Понятно";
understoodButton.addEventListener("click", () => onUnderstoodChoice(true));
```

---

### `src/ui/screens/SessionEndScreen.ts` (screen, transform)

**Analog:** itself (56 lines, read in full) — comment at line 8 ("No visual polish this phase — Phase 5 owns that") confirms this file is an explicit, pre-flagged re-skin target. Structure (`.session-end-screen`, `.child-section`, `.parent-section`, `.headline`) stays; only spacing/typography/color values change per UI-SPEC's "hero section" 2xl/3xl spacing activation. `rublesEarned` display (line 36) is the existing analog for the NEW top-bar ruble chip's read pattern — same `state.currentRewards`-sourced value, same plain-text `${N} ₽`-shaped interpolation, just a second render site.

---

### `src/ui/exercise-renderers/{textInput,singleChoice,matching,orderBuilder}.ts` (component, request-response)

**Analog for all 4:** each other — near-identical `.task-card` / `.submit-row` / `button.accent` shape shared across all four files (confirmed by reading all 4 in full). Re-skin only; zero TS logic changes needed except verifying chip/option touch-target classes (`.option`, `.bank-chip`, `.sequence-chip`, `.match-left`, `.match-right`) are NOT accidentally caught by the new 52px CTA-only height rule (RESEARCH.md Pitfall 3).

**Shared submit-button pattern (all 4 files, identical shape)** — e.g. `textInput.ts` lines 27-31:
```typescript
const submitButton = document.createElement("button");
submitButton.type = "button";
submitButton.className = "accent";
submitButton.textContent = "Проверить";
submitButton.disabled = true;
```
This is the exact element the 52px-height + chunky-shadow CSS rule (D-06/UI-SPEC Shape Language) must target — scope the new CSS rule to `.submit-row button.accent` (present in all 4 renderers) rather than a bare `button.accent` selector, so theory's understood/selected toggles (also `.accent`/`.selected`) and order-builder's placed sequence chips (`.sequence-chip.accent`) do NOT inherit the 52px CTA exception.

---

## Shared Patterns

### Button base + accent/chunky styling
**Source:** `src/style.css` lines 98-122
**Apply to:** every screen and exercise-renderer file (all button elements) — single shared CSS rule set, zero per-file TS changes needed for the visual re-skin itself.

### createElement/textContent-only discipline
**Source:** project-wide, confirmed clean via grep across all `src/ui/**` files read this session (zero `innerHTML` occurrences)
**Apply to:** all new files this phase (`ThinkingIndicator.ts`, `RewardToast.ts`) and any edits to existing files — MUST continue, security-relevant (RESEARCH.md Security Domain section).

### Thinking-indicator disable/await/finally shape
**Source:** `src/main.ts` lines 94-104 (theory), 135-156 (exercise submit), 271-283 ("Показать итоги")
**Apply to:** all 3 call sites — insert the new indicator element inside the EXISTING try/finally, do not restructure the unsubscribe/resubscribe logic (Pitfall 3's single-dispatch-window invariant).

### Darker-shade border/shadow pairs (D-04 "chunky" technique)
**Source:** `05-UI-SPEC.md` Color + Shape Language sections (exact hex pairs already resolved, do not re-derive)
**Apply to:** every colored surface — buttons, cards, chips, banners — as new CSS custom properties (`--color-*-dark`) referenced in `style.css`.

### Progress/completion signal reuse
**Source:** `src/main.ts` line 118 (`engine.getCurrentExercise()` already used by main-content block)
**Apply to:** the top-bar block's Pitfall 2 fix — reuse this exact call/result rather than inventing a second "is lesson complete" check.

## No Analog Found

None — every file this phase touches has a direct, exact, or near-exact analog already in the codebase (either itself, in the case of re-skins, or a sibling file in the case of the two genuinely new components). This is expected: Phase 5 is a pure visual re-skin + two small additive components on top of an already-complete functional app (per RESEARCH.md's framing).

## Metadata

**Analog search scope:** `src/`, `src/ui/**`, `src/core/lessonEngine.ts`, `src/core/answer-checking/checkTextInput.ts`, `src/core/rewards/rewardEngine.ts`, `tests/ui/components/`
**Files scanned:** 20 (14 classified files + 6 supporting reads for correction of RESEARCH.md Assumption A1)
**Pattern extraction date:** 2026-07-03

**Correction to upstream RESEARCH.md:** Assumption A1 / Open Question 1 (exact `HandleAnswerResult` field name for reward amount) is now RESOLVED by direct read: no such field exists. `HandleAnswerResult extends CheckResult { praiseRu?: string }` — reward amounts are computed and folded into `state.currentRewards` entirely inside `LessonEngine.handleAnswer()`, never returned to the caller. The reward-toast trigger must use a before/after `state.currentRewards` diff around the `handleAnswer()` await (safe in this specific case per the single-dispatch-window invariant already established in `main.ts`), not a result-field read as RESEARCH.md's Pitfall 4 code example suggested. The planner should use the corrected pattern documented above under `src/main.ts`, not RESEARCH.md's original code example.
