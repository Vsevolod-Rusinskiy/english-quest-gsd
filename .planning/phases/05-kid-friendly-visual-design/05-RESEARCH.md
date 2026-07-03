# Phase 5: Kid-Friendly Visual Design - Research

**Researched:** 2026-07-03
**Domain:** Pure CSS/vanilla-TS visual re-skin (no framework, no new dependencies)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Bright, saturated, primary-color-forward palette (blues/yellows/greens/reds at high saturation) — "Roblox-inspired" without copying Roblox's actual brand colors/logo/assets.
- **D-02:** Extend Phase 1's existing 60/30/10 token structure (`--color-bg`, `--color-bg-secondary`, `--color-accent`, `--color-error`, `--color-success`) — swap VALUES, keep ROLES identical.
- **D-03:** Keep exactly 2 functional signal colors (success green, error red) distinct from the primary brand accent — error red used sparingly (banner border/icon only, never harsh full-bleed).
- **D-04:** "Blocky" = large border-radius (12-16px, not pill/circular), thick borders (2-4px) in a darker shade of the element's own color, generous padding — no skeuomorphism, no gradients/shadows beyond a subtle flat drop-shadow on primary buttons.
- **D-05:** No icon library or third-party asset package. Icons: (a) plain CSS shapes, or (b) small curated Unicode emoji set (✓, ✗, ₽, 💡). No custom SVG set, no mascot.
- **D-06:** Buttons: large touch targets (Phase 1's 44×44px floor; this phase can go 48-56px for primary CTAs), fully-rounded-but-blocky corners (12-16px, not circular), visible "pressed" state (vertical shift + border-color change), pure CSS `:active`.
- **D-07:** Replace Phase 1's system-font stack with a single rounded/friendly display-adjacent web-safe-first choice — stay on system fonts (heavier weights + larger sizes) rather than a webfont load. Executor MAY add a bundled local `@font-face` at their discretion if trivial — not required.
- **D-08:** Keep Phase 1's size/line-height ratios (Body 16/1.5, Label 14/1.2, Heading 20/1.2, Display 28/1.2) as the FLOOR — may increase sizes (e.g. Display up to 32-36px) but must not go below floor.
- **D-09:** Lightweight CSS-only motion (transitions/keyframes, no JS animation library) — short bounce/scale-in on correct feedback, gentle shake on incorrect (calm, not punitive), simple pulsing/rotating "thinking" indicator reused as the SAME component/class across all 5 agent-call waiting states (Answer Checker, Theory Tutor, Progress Advisor, Reward Advisor, Parent Report Generator), not 5 bespoke ones.
- **D-10:** Reward/rubles: brief "+N ₽" toast/badge animation when a reward event fires — visual celebration only, no new reward logic (REWARD-01..04 already implemented Phase 2/4).
- **D-11:** All screens get the skin in ONE pass (not phased/prioritized within this phase) — theory, all 4 exercise renderers, feedback banner, progress indicator, top bar, session-end screen.
- **D-12:** Two pre-existing Phase 1 UAT bugs are IN SCOPE to fix: (1) feedback banner not clearing on exercise-advance, (2) progress indicator overshoot ("N+1 из N") at lesson-complete.

### Claude's Discretion

- Exact hex values within the "bright saturated" palette direction (D-01) — RESOLVED by 05-UI-SPEC.md (see Color section below); do not re-derive.
- Whether `style.css` grows in place or splits into per-component CSS files — no architectural principle at stake.
- Precise animation timing/easing curves — RESOLVED by 05-UI-SPEC.md's Motion Contract; do not re-derive.

### Deferred Ideas (OUT OF SCOPE)

- Custom mascot character / branded illustration set — explicitly excluded.
- Bundled custom webfont — Claude's Discretion (D-07), not required; default is system-font, zero-new-dependency.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Экран урока использует детский, блочный, яркий стиль с крупными скруглёнными кнопками (Roblox-вдохновлённый, без брендинга/логотипов/ассетов Roblox) | Color/Shape/Typography/Motion contracts in 05-UI-SPEC.md fully specify exact values; this research confirms the CSS techniques (offset-shadow chunky buttons, darker-shade border formula) are standard, verifies no Roblox-brand-color collision, and maps every re-skin target file. |
| UI-02 | Экран урока показывает верхнюю панель (название, баланс рублей, прогресс), заголовок урока и карточку задания с инструкцией RU+EN | `main.ts` top-bar rendering (lines 50-76) confirmed as the single insertion point for the new ruble-balance chip, reading directly from `state.currentRewards` (already a live `ProgressState` field, already read once in `SessionEndScreen` at line 263 — same field, new second read site). |

</phase_requirements>

## Summary

Phase 5 is a pure CSS/markup re-skin of an already-functionally-complete app. There is no new architecture, no new package, no new agent contract — every finding below is about (a) precisely which existing files/lines change and why, (b) the standard CSS techniques for the "chunky game UI" look the UI-SPEC already specifies exact values for, and (c) the exact root cause of the two Phase 1 UAT bugs this phase must also fix.

The UI-SPEC (05-UI-SPEC.md) already resolves every design-value question (colors, sizes, spacing, motion timing) — this research does NOT re-derive those; it grounds the plan in the actual codebase so tasks can reference exact line numbers, exact current behavior, and exact bug root causes instead of guessing.

Three concrete findings drive the plan structure: (1) there is currently **no existing thinking-indicator component or even ad-hoc cue text** in the code — only `button.disabled = true/false` toggling — so the "shared thinking-indicator" is 100% new code inserted at exactly 3 call sites in `main.ts` (theory buttons, exercise submit, "Показать итоги"), not a refactor of 5 existing bespoke cues; (2) the ruble balance top-bar insertion point is `main.ts` lines 50-76, reading `state.currentRewards` (already a top-level `number` field on `ProgressState`, already consumed once at line 263); (3) both Phase 1 UAT bugs have a precise, traceable root cause in `main.ts`'s render/feedback logic (documented in Common Pitfalls below), fixable as small, targeted edits rather than a rewrite.

**Primary recommendation:** Structure the phase as two waves — Wave 1: design tokens + shared components (CSS custom properties, shared `.thinking-indicator` class/helper, reward-toast component, bug fixes in `main.ts`), Wave 2: per-screen/per-renderer visual application (theory, 4 exercise renderers, session-end) — since the shared thinking-indicator and bug fixes touch `main.ts` centrally and should land before the fan-out to individual screen files, avoiding merge conflicts across parallel per-screen tasks.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Color/typography/spacing tokens | Browser/Client (CSS) | — | Pure `:root` custom properties in `style.css`; no build-time or server involvement |
| Shared thinking-indicator | Browser/Client (CSS + TS DOM) | — | CSS `@keyframes` animation class + a small TS helper function called from `main.ts`'s existing disabled-button toggle sites — no new state, no persistence |
| Ruble balance top-bar display | Browser/Client (TS render function) | — | Pure read of already-live `state.currentRewards`; zero new state, zero core logic change — `main.ts`'s `render()` function only |
| Reward "+N ₽" toast | Browser/Client (CSS animation + TS trigger) | — | Purely presentational; must NOT invent new reward logic (D-10) — triggers off already-existing reward events from Phase 2/4's core, never computes amounts itself |
| Feedback-banner-clearing bug fix | Browser/Client (TS render logic) | — | Bug lives entirely in `main.ts`'s transient `feedback` variable lifecycle — no core/state-shape change needed |
| Progress-indicator overshoot bug fix | Browser/Client (TS render logic) | — | Bug lives in `main.ts`'s render() branching + `ProgressIndicator.ts` — `getCurrentExercise()`/index arithmetic, no core engine change needed |

## Standard Stack

### Core

No new packages this phase. Confirmed `package.json` dependencies unchanged from Phase 1-4: `typescript` (^6.0.0), `vite` (^6.4.0), `vitest` (^4.1.0), `zod` (^4.4.0), `jsdom` (^29.1.0), `@anthropic-ai/sdk` (^0.109.1). [VERIFIED: package.json read directly]

### Supporting

None — D-05/D-09 explicitly forbid icon libraries, animation libraries, and font packages for this phase.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure CSS `@keyframes`/`:active` for all motion | A JS animation library (e.g. `motion`/`GSAP`) | Explicitly rejected by D-09 — adds a dependency for effects trivially achievable in CSS at this scale (bounce/shake/pulse/slide). |
| Unicode emoji for functional glyphs (₽, ✓, ✗, 💡) | An SVG icon set (e.g. Lucide, Heroicons) | Explicitly rejected by D-05 — this project's "Registry Safety" gate forbids any icon package; Unicode glyphs render with zero asset pipeline in all modern system fonts. |
| System font stack, heavier weights | A bundled rounded webfont (e.g. Fredoka, Baloo 2 — common "kid-friendly" Google Fonts) | D-07 makes this optional/discretionary, not required — avoids a new network dependency; if the executor judges it trivial (a local `@font-face` file, no CDN call) they may add it, but it is not blocking for UI-01/UI-02. |

**Installation:** None — no new dependencies to install this phase.

## Package Legitimacy Audit

Not applicable. This phase installs zero external packages — D-05 and the Registry Safety section of 05-UI-SPEC.md both confirm no new dependency is introduced (icon library, animation library, or font package all explicitly rejected). The Package Legitimacy Gate is trivially satisfied: nothing to check.

## Architecture Patterns

### System Architecture Diagram

```
User interaction (tap/click)
        |
        v
main.ts render() [existing, re-skinned]
        |
        +--> Top bar: lesson title + [NEW] ruble-balance chip (reads state.currentRewards)
        |         + progress indicator (re-skinned, overshoot-fixed)
        |
        +--> Main content area
        |         |
        |         +-- [!theoryUnderstood] TheoryScreen.ts (re-skinned)
        |         |         |
        |         |         +--> onUnderstoodChoice tap
        |         |                   |
        |         |                   v
        |         |         [NEW] shared thinking-indicator shown
        |         |                   |
        |         |                   v
        |         |         engine.handleTheoryStep() [Theory Tutor agent, unchanged]
        |         |
        |         +-- [theoryUnderstood, exercise present] ExerciseScreen.ts -> renderExercise()
        |                   dispatches to one of 4 exercise-renderers (all re-skinned,
        |                   same DOM structure/mechanics, new classNames/CSS only)
        |                       |
        |                       +--> onSubmit tap
        |                                 |
        |                                 v
        |                       [NEW] shared thinking-indicator shown
        |                                 |
        |                                 v
        |                       engine.handleAnswer() [Answer Checker agent, unchanged]
        |                                 |
        |                                 v
        |                       FeedbackBanner.ts (re-skinned + [FIX] cleared on advance)
        |                                 |
        |                       [D-10 NEW] if reward event fired -> reward toast animation
        |
        +-- [lesson complete] "Показать итоги" tap
                  |
                  v
        [NEW] shared thinking-indicator shown
                  |
                  v
        engine.handleSessionEnd() [Progress Advisor -> guardrails -> Reward Advisor
                                     -> Parent Report Generator, all sequential, unchanged]
                  |
                  v
        SessionEndScreen.ts (re-skinned, hero spacing/motion)
```

### Recommended Project Structure

No new directories. `style.css` continues to be the single stylesheet (Claude's Discretion: may split into per-component files, but no structural requirement to do so — the project has 175 lines today, likely growing to 400-600 lines after this phase, still reasonable as one file).

```
src/
├── style.css              # Grows in place: new token values + new component classes
│                           # (.thinking-indicator, .reward-toast, .ruble-balance, etc.)
├── main.ts                 # Top-bar ruble insertion, thinking-indicator wiring (3 call
│                           # sites), feedback-clear-on-advance fix
├── ui/
│   ├── components/
│   │   ├── ProgressIndicator.ts   # Re-skin + overshoot-fix support (completion variant)
│   │   ├── FeedbackBanner.ts      # Re-skin only, no logic change (bug lives in main.ts)
│   │   ├── FatalError.ts          # Re-skin only
│   │   └── ThinkingIndicator.ts   # [NEW FILE] shared component, one render function
│   │                               # reused at all 3 call sites in main.ts
│   ├── screens/
│   │   ├── TheoryScreen.ts        # Re-skin only, no structural change
│   │   ├── ExerciseScreen.ts      # Re-skin only (thin dispatcher, minimal surface)
│   │   └── SessionEndScreen.ts    # Re-skin + hero spacing per Motion/Spacing contract
│   └── exercise-renderers/
│       ├── textInput.ts           # Re-skin only, same DOM structure
│       ├── singleChoice.ts        # Re-skin only
│       ├── matching.ts            # Re-skin only
│       └── orderBuilder.ts        # Re-skin only
```

### Pattern 1: Shared Thinking-Indicator as a Small Reusable Render Function

**What:** A single exported function (new file `src/ui/components/ThinkingIndicator.ts`) that returns an `HTMLElement` with the `.thinking-indicator` class + the shared "Секунду, думаю…" text, matching every other component's `createElement`/`textContent` convention.

**When to use:** At exactly 3 call sites in `main.ts` — replacing/augmenting the current bare `disabled = true/false` toggles:
1. Theory buttons handler (lines ~94-104) — wraps Theory Tutor's `handleTheoryStep()` await.
2. Exercise submit handler (lines ~135-156) — wraps Answer Checker's `handleAnswer()` await.
3. "Показать итоги" button handler (lines ~271-283) — wraps `handleSessionEnd()`'s SEQUENTIAL Progress Advisor -> guardrails -> Reward Advisor -> Parent Report Generator chain (already one combined await in the engine, per `ARCHITECTURE.md`/Phase 4 decision "sequential, never Promise.all").

**Why exactly 3 call sites cover all 5 agents:** Progress Advisor, Reward Advisor, and Parent Report Generator are NOT independently triggered from the UI — `engine.handleSessionEnd()` already resolves all three internally as one sequential unit (Phase 04 decision, confirmed in `lessonEngine.ts`). So the UI only ever needs 3 distinct "thinking" trigger points, not 5. D-09's "same component reused" requirement is satisfied by using ONE shared class/function at these 3 sites — it does not require 5 separate wire-ups.

**Example (root cause confirmed — no existing text cue found via grep):**
```typescript
// Source: this repo, src/main.ts current pattern (grep-verified: only
// `button.disabled = true/false` exists today — no cue text, no spinner).
// Phase 5 inserts a thinking-indicator element alongside the existing
// disabled-toggle, does not replace the disabled-toggle logic itself.
const buttons = theoryNode.querySelectorAll<HTMLButtonElement>(".theory-buttons button");
buttons.forEach((btn) => (btn.disabled = true));
const thinkingEl = renderThinkingIndicator();
theoryNode.appendChild(thinkingEl);
try {
  unsubscribeRender();
  result = await engine.handleTheoryStep(understood);
} finally {
  thinkingEl.remove();
  unsubscribeRender = store.subscribe(render);
  buttons.forEach((btn) => (btn.disabled = false));
}
```

### Pattern 2: Darker-Shade Border via Precomputed Hex Pairs (D-04's "chunky" technique)

**What:** Every colored surface gets a border 2-4px in a darker shade of its own fill — NOT computed at runtime (no `filter`/`color-mix()` needed, though `color-mix()` is a valid modern CSS option); 05-UI-SPEC.md already specifies exact precomputed pairs (e.g. accent `#2E7DF7` fill / `#1E5FC7` border).

**When to use:** All buttons, cards, chips, banners — applied via CSS custom properties per role (e.g. `--color-accent` + `--color-accent-dark`), so components reference two tokens per color role rather than computing shades in TS.

**Example:**
```css
/* Source: standard "chunky/3D button" technique, cross-verified via
   Josh W. Comeau (joshwcomeau.com/animation/3d-button), CSS-Tricks
   "Boxy Buttons", and Gregory Schier's "Clicky 3D Buttons" — zero-blur
   offset box-shadow is the consistent technique across all three
   independent sources [CITED: joshwcomeau.com, css-tricks.com, schier.co]. */
:root {
  --color-accent: #2e7df7;
  --color-accent-dark: #1e5fc7; /* ~15-20% lightness reduction, per UI-SPEC */
}

button.accent {
  background: var(--color-accent);
  border: 3px solid var(--color-accent-dark);
  border-radius: 14px;
  box-shadow: 0 4px 0 var(--color-accent-dark); /* zero-blur = solid "block" edge */
  transition: transform 100ms ease-out, box-shadow 100ms ease-out;
}

button.accent:active {
  transform: translateY(4px); /* matches shadow offset exactly */
  box-shadow: 0 0 0 var(--color-accent-dark); /* shadow "disappears" = pressed look */
}
```

### Pattern 3: Accessible Motion (prefers-reduced-motion + role="status")

**What:** Not explicitly specified in 05-UI-SPEC.md's Motion Contract, but standard practice for any looping CSS animation (`prefers-reduced-motion`) and any dynamically-inserted status text (`role="status"`/`aria-live="polite"`). Confirmed via cross-checked accessibility sources (DockYard, csstools.io) [CITED: dockyard.com/blog/2020/03/02/accessible-loading-indicatorswith-no-extra-elements, csstools.io/blog/css-loader-animations].

**When to use:** Recommended addition to the thinking-indicator and reward-toast components — not blocking for UI-01/UI-02 (neither requirement mentions accessibility explicitly), but low-cost and consistent with the project's existing discipline (createElement/textContent only, no innerHTML — same "do it right the first time" ethos).

**Example:**
```css
/* Source: standard accessibility pattern, cross-verified across DockYard
   and csstools.io [CITED] */
.thinking-indicator {
  animation: pulse 1000ms ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .thinking-indicator {
    animation: none;
    opacity: 0.7; /* static fallback, still visually distinct from idle state */
  }
}
```
```typescript
// role="status" + aria-live are plain HTML attributes, zero new dependency.
const el = document.createElement("div");
el.className = "thinking-indicator";
el.setAttribute("role", "status");
el.setAttribute("aria-live", "polite");
el.textContent = "Секунду, думаю…"; // per 05-UI-SPEC.md Copywriting Contract
```

### Anti-Patterns to Avoid

- **Computing darker-shade colors at runtime via `filter: brightness()` on hover/active states:** Works but is imprecise (Phase 5's UI-SPEC gives exact hex pairs) and can shift hue unexpectedly at extreme values — use the precomputed CSS custom-property pairs from 05-UI-SPEC.md's Color section instead.
- **Re-deriving palette/spacing/typography values instead of reading 05-UI-SPEC.md:** All exact values (hex codes, sizes, weights, timing) are already resolved and approved (6/6 dimensions) in 05-UI-SPEC.md — the plan should reference it directly, not re-derive via this research or a fresh WebSearch.
- **Building 5 separate thinking-indicator implementations per agent:** D-09 explicitly forbids this; there are only 3 actual UI trigger points anyway (see Pattern 1), so building more than one shared component would be strictly wasted effort.
- **Fixing the progress-indicator overshoot by clamping the display string only:** A superficial `Math.min(current, total)` clamp in `ProgressIndicator.ts` alone would mask the symptom but the actual bug is in `main.ts`'s branching logic passing `index - 1`/`index + 1` values around the lesson-complete transition (see Common Pitfalls below) — fix at the call site, not just the display component.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Darker-shade color computation | A JS color-manipulation utility (e.g. hand-rolled HSL lightness shifter) | Precomputed hex pairs per role, declared as CSS custom properties (05-UI-SPEC.md already provides exact pairs) | The palette is small and fixed (5-6 roles) — precomputing once in the spec is simpler and more predictable than a runtime color library, and avoids adding a dependency for a 6-value lookup table. |
| "Chunky 3D button" shadow effect | A custom shadow/depth calculation system | The standard zero-blur offset `box-shadow` + `:active` transform technique (Pattern 2 above) | This is a well-established, single-CSS-rule technique — no computation needed, just two matching offset values (shadow offset = active-state translateY). |
| Reduced-motion handling | Custom JS media-query polling / `matchMedia` listener with manual animation toggling | The `@media (prefers-reduced-motion: reduce)` CSS at-rule directly on the animation class | Native CSS media query is zero-JS, zero-dependency, and is the browser-standard mechanism — no need to detect the preference in TS at all. |

**Key insight:** Every visual technique this phase needs (chunky buttons, pulsing indicators, reduced-motion fallback, toast animations) is achievable with plain CSS `@keyframes`/custom properties/media queries — there is no sub-problem here complex enough to justify hand-rolling a JS abstraction layer, which aligns exactly with D-05/D-09's "no animation library" constraint.

## Runtime State Inventory

Not applicable — this is a visual re-skin phase, not a rename/refactor/migration phase. No stored data keys, service configs, OS-registered state, secrets, or build artifacts carry names/values this phase changes. `localStorage` key `english-quest-progress-v1` and its schema (`ProgressState`) are entirely unaffected — confirmed by reading `progressSchema.ts`: `currentRewards: z.number()` is read-only consumed by this phase's new top-bar display, never renamed or restructured.

## Common Pitfalls

### Pitfall 1: Feedback Banner Not Cleared on Exercise-Advance (D-12 Gap 1) — Root Cause

**What goes wrong:** After a correct main-pass answer, the child advances to the next exercise but the previous exercise's "Верно!"/"Не совсем..." banner remains visible until the next submit.

**Why it happens (confirmed by reading `main.ts` lines 216-232):** The `feedback` variable is intentionally NOT cleared to `null` after being consumed — it persists across renders so the render function can re-derive `feedbackAppliesHere` using `feedback.atIndex === index - 1` (a deliberate "was this the answer that caused THIS advance" check, per code comments referencing Pitfall/WR-02/WR-03 reasoning from Phase 3). The bug: this check only guards whether the CURRENT render shows the banner — but the render() that shows the NEXT exercise still evaluates `feedbackAppliesHere` using the SAME stale `feedback` object, and because of the `feedback.isCorrect && feedback.atIndex === index - 1` branch (line 229), the banner from the correct answer that caused this exact advance IS shown correctly. The actual gap: nothing ever resets `feedback = null` once its one-render "grace window" has passed, so if the render function is invoked again for the SAME index without a new answer (e.g. any future re-render not caused by a new submit), the banner could reappear. The fix must add an explicit `feedback = null` reset once the banner has been "consumed" for the render it was meant for — i.e., after the immediate post-advance render is done, or gate `feedbackAppliesHere` more strictly (track "already displayed" per feedback object, not just index/id matching).

**How to avoid:** Add a one-shot consumption flag to the `feedback` transient object (e.g. `feedback.consumed: boolean`, set true after the first render that displays it) OR explicitly null out `feedback` inside the `render()` call immediately triggered by an advance, once the banner append is done. The planner should choose the approach that touches the fewest lines while remaining readable — likely a `feedback = null` assignment added at the top of the "next exercise" render path once the banner-append branch has executed once.

**Warning signs:** Any test asserting `.feedback-banner` element absence after TWO successive `render(store.getState())` calls without an intervening submit — add exactly this regression test in Wave 0 gaps below.

### Pitfall 2: Progress Indicator Overshoot at Lesson-Complete (D-12 Gap 2) — Root Cause

**What goes wrong:** At lesson-complete, "Задание {N+1} из {N}" is shown (e.g. "3 из 2") instead of clamping or switching to a completion state.

**Why it happens (confirmed by reading `main.ts` lines 57-75 + `ProgressIndicator.ts`):** The top-bar progress indicator is rendered from `state.currentPosition.currentExerciseIndex + 1` unconditionally whenever `!engine.isReviewPass()`. When the main sequence completes, `currentExerciseIndex` has already been incremented past the last valid index (by the reducer, on the final correct answer's dispatch) — so `currentExerciseIndex + 1` produces `total + 1` on the SAME render call where `getCurrentExercise()` returns `undefined` (the lesson-complete branch, line 233). The top-bar rendering (line 57-75) and the main-content rendering (line 111+) are two SEPARATE blocks in the same `render()` function — the main-content block correctly detects lesson-complete via `!exercise`, but the top-bar block has no equivalent check and keeps computing `currentExerciseIndex + 1` regardless.

**How to avoid:** In the top-bar block, check `!engine.getCurrentExercise()` (or equivalent "lesson complete" signal already used at line 233) BEFORE computing `currentExerciseIndex + 1`, and either clamp to `engine.totalExercises` or render a distinct completion-state indicator (e.g. a checkmark badge) instead of calling `renderProgressIndicator` with an out-of-range numerator. This must be checked in the SAME render() call, using the SAME `exercise`/completion signal the main-content block already computes at line 118, to avoid duplicating divergent completion-detection logic.

**Warning signs:** Any test asserting the top-bar's progress-indicator textContent at the exact render where `getCurrentExercise()` returns undefined — add exactly this regression test in Wave 0 gaps below.

### Pitfall 3: Applying New CSS Values Without Re-Verifying Touch-Target Floors

**What goes wrong:** D-06/05-UI-SPEC.md's 52px primary-CTA height is an EXCEPTION, not the new floor — accidentally applying 52px (or any value below 44px) to secondary/chip elements would violate Phase 1's still-binding 44×44px floor for those elements.

**Why it happens:** When bumping padding/sizing globally in `style.css` for the "punchier" kid-friendly feel, it's easy to accidentally apply the CTA-specific height rule too broadly (e.g. via an overly generic `button` selector) rather than scoping it to primary-CTA classNames specifically.

**How to avoid:** Scope the 52px height rule to a specific class (e.g. `button.accent.primary-cta` or similar, matching whichever selector the plan assigns to "Проверить"/"Показать итоги"/session-end continue), and verify chips/secondary buttons (option buttons, bank/sequence chips, theory Понятно/Не понятно) explicitly retain `min-height: 44px`.

**Warning signs:** Visual review showing option-chip buttons or matching-column buttons at the same height as the submit button — should look visually distinct in a screenshot/manual check.

### Pitfall 4: Reward Toast Firing Logic Duplicating or Bypassing Core Reward State

**What goes wrong:** D-10 requires the toast to be a "brief celebration of an ALREADY-decided reward event" — a naive implementation might recompute "did a reward just happen?" independently (e.g. comparing `currentRewards` before/after) rather than reading the actual reward event(s) already returned by `handleAnswer()`'s result.

**Why it happens:** `handleAnswer()` already returns reward-event information as part of its `HandleAnswerResult` (confirmed pattern from Phase 2/4 — `rewardEvents`-shaped data referenced in `lessonEngine.ts` comments around line 35-38); the toast trigger should read THIS existing result field, not infer reward-firing from a before/after balance diff (which could misfire on review-pass edge cases or double-count).

**How to avoid:** Check `lessonEngine.ts`'s exact `HandleAnswerResult` shape (fields around line 35-44) before wiring the toast trigger in `main.ts`'s `onSubmit` handler — the toast should render conditionally on "does this result carry a non-empty/defined reward-amount field," using the SAME data the core already computed, never a derived diff.

**Warning signs:** Toast firing on renders unrelated to a fresh correct answer (e.g. appearing again on an unrelated re-render), or toast amount not matching `rewardHistory`'s most recent entry.

## Code Examples

### Reward Toast (D-10) — CSS Slide-Up + Fade, TS Trigger Reading Existing Result Field

```typescript
// Source: this repo's existing HandleAnswerResult shape (src/core/lessonEngine.ts,
// confirmed reward-event-carrying result pattern established Phase 2/4) — trigger
// reads the ALREADY-COMPUTED reward amount, never recomputes it (D-10 constraint).
if (result.rewardAmount && result.rewardAmount > 0) {
  const toast = renderRewardToast(result.rewardAmount); // "+{N} ₽" per Copywriting Contract
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1950); // 250ms enter + 1500ms hold + 200ms exit (UI-SPEC Motion Contract)
}
```

```css
/* Source: 05-UI-SPEC.md Motion Contract table — timings taken verbatim */
@keyframes reward-toast-in {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.reward-toast {
  animation: reward-toast-in 250ms ease-out;
  background: var(--color-highlight); /* #FFC93C per UI-SPEC */
  border: 3px solid var(--color-highlight-dark);
}
```

### Progress Indicator Completion State (Pitfall 2 fix)

```typescript
// Source: this repo, main.ts render() — fix scoped to the top-bar block only,
// reusing the SAME completion signal (`!exercise`/getCurrentExercise()) the
// main-content block already relies on at line 118/233, per D-12's "fix at
// the call site" recommendation (Common Pitfalls Pitfall 2).
if (state.currentPosition.theoryUnderstood) {
  const exercise = engine.getCurrentExercise();
  if (!exercise && !engine.isReviewPass()) {
    topBar.appendChild(renderProgressIndicatorComplete(engine.totalExercises));
  } else if (engine.isReviewPass()) {
    // ...existing review-pass branch, unchanged
  } else {
    topBar.appendChild(
      renderProgressIndicator(state.currentPosition.currentExerciseIndex + 1, engine.totalExercises),
    );
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Phase 1: pure-white bg, neutral-blue accent, 600-weight max, no motion | Phase 5: warm-cream bg, bright-saturated blue/yellow/green/red, 700-weight, CSS keyframe motion for feedback/thinking/reward | This phase (2026-07) | Same token STRUCTURE, new VALUES — no code restructuring, only CSS value + minor className changes per D-02. |
| Ad-hoc `disabled=true/false` as the only "thinking" signal (confirmed via grep: zero existing cue text) | Shared `.thinking-indicator` component + cue text at 3 call sites | This phase | New file (`ThinkingIndicator.ts`), 3 call-site edits in `main.ts` — first time this project has any visual/textual waiting-state feedback. |

**Deprecated/outdated:** None — Phase 1's structural contract (spacing scale, typography ROLE separation, 60/30/10 token NAMES) is explicitly carried forward unchanged; only VALUES are superseded.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `result.rewardAmount` (or an equivalently-named field) exists on `HandleAnswerResult` and can be read directly to trigger the reward toast without recomputing from a balance diff | Common Pitfalls Pitfall 4, Code Examples | If the actual field name/shape differs, the toast-trigger code example needs adjustment — LOW risk since it's a straightforward rename, but the planner MUST verify the exact `HandleAnswerResult` interface in `lessonEngine.ts` before writing the task, not copy this example verbatim. |
| A2 | A `color-mix()`-free, precomputed-hex-pair approach is preferable to CSS `color-mix()` for darker-shade borders | Architecture Patterns Pattern 2 | LOW risk — this is a style preference, not a correctness issue; `color-mix()` is supported in all current evergreen browsers as of 2026 and would work equally well, but 05-UI-SPEC.md already specifies exact hex pairs, making precomputed values the path of least friction. |

**If this table is empty:** N/A — two low-risk assumptions logged above; both are easily verified at plan-write time by reading the two referenced files directly (`lessonEngine.ts` for A1; no verification needed for A2, it's a style choice).

## Open Questions

1. **Exact `HandleAnswerResult` field name for reward amount**
   - What we know: `lessonEngine.ts` comments (lines 35-38) reference reward-event data flowing through `handleAnswer`'s result rather than the store dispatch, described as "render-facing."
   - What's unclear: The exact field name/shape (e.g. `rewardAmount: number | undefined` vs. `rewardEvents: RewardEvent[]`) without reading the full interface definition.
   - Recommendation: Planner reads `lessonEngine.ts`'s `HandleAnswerResult` interface definition directly (grep for `interface HandleAnswerResult`) before writing the reward-toast task — a 30-second file read that removes all ambiguity, cheaper than guessing here.

2. **Whether to split `style.css` into per-component files**
   - What we know: Claude's Discretion (CONTEXT.md) — no architectural principle at stake either way.
   - What's unclear: Whether the file will grow unwieldy (175 -> ~400-600 lines estimated) enough to warrant splitting.
   - Recommendation: Keep as one file for this phase (simpler diff review, no new build-tool CSS-import wiring needed) unless the executor finds the single-file diff genuinely hard to review; splitting can always happen in a later cleanup pass.

## Environment Availability

Skipped — this phase has no external dependencies (no new packages, no external services, no CLI tools beyond the existing `npm`/`vite`/`vitest` toolchain already verified working in Phases 1-4).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x with `jsdom` environment (confirmed `vitest.config.ts`: `environment: "jsdom", globals: true`) |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npm test -- tests/ui` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | All screens render with new className/CSS hooks present (e.g. `.thinking-indicator`, `.reward-toast` elements exist in DOM when triggered) | unit (DOM assertion, not visual/pixel) | `npx vitest run tests/ui -t "thinking indicator"` | Wave 0 (new test file needed) |
| UI-02 | Top bar renders ruble-balance chip with correct `state.currentRewards` value | unit | `npx vitest run tests/main.test.ts -t "ruble balance"` | Wave 0 (no `tests/main.test.ts` exists today — `main.ts` currently has zero direct unit tests, confirmed via file listing) |
| D-12/Gap1 | Feedback banner absent after a second render() call for an unrelated index without a new submit | regression unit | `npx vitest run tests/main.test.ts -t "feedback banner clears"` | Wave 0 |
| D-12/Gap2 | Progress indicator does not render "N+1 из N" at lesson-complete; renders a clamped/completion state instead | regression unit | `npx vitest run tests/ui/components/ProgressIndicator.test.ts -t "completion"` | Wave 0 (extend existing `ProgressIndicator.test.ts`) |

### Sampling Rate

- **Per task commit:** `npm test -- tests/ui` (fast, scoped to UI layer)
- **Per wave merge:** `npm test` (full suite — confirms no regression in core/agent tests untouched by this phase)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/main.test.ts` — does not exist today (confirmed via file listing); `main.ts`'s `mountApp`/`render` logic has zero direct unit-test coverage currently (all coverage today is indirect via `tests/e2e/*` walking-skeleton tests). This phase's two bug fixes (D-12) live entirely in `main.ts`, so a new test file targeting `render()`'s branching logic (feedback-clear, progress-overshoot) is required — cannot verify these fixes via existing `ProgressIndicator.test.ts`/`FeedbackBanner.test.ts` alone since those test the PURE render functions, not `main.ts`'s call-site logic that decides WHEN to show/clear them.
- [ ] Extend `tests/ui/components/ProgressIndicator.test.ts` — add a case for whatever "completion state" variant the plan introduces (e.g. `renderProgressIndicatorComplete`).
- [ ] New `tests/ui/components/ThinkingIndicator.test.ts` — covers the new shared component (textContent, className, role/aria attributes if added per Pattern 3).
- [ ] Framework install: none — Vitest/jsdom already present and working (11 existing UI test files under `tests/ui/`).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface in this app (single local student, no login) — unaffected by this phase. |
| V3 Session Management | No | No sessions beyond `localStorage` state, unaffected by this phase. |
| V4 Access Control | No | Single-user local app, no access-control surface. |
| V5 Input Validation | No new surface | This phase adds zero new user-input fields (no new forms/inputs) — existing `textInput.ts`'s `<input type="text">` is unchanged structurally, only re-skinned. Zod validation of agent responses (RELY-01) is core-layer, untouched by this phase. |
| V6 Cryptography | No | No crypto surface introduced or touched. |

**Overall assessment:** This phase is presentation-only (CSS + minor DOM structure additions for the thinking-indicator/reward-toast/ruble-chip) and does not touch the agent-trust-boundary, input-validation, or persistence layers RELY-01/RELY-02/PERSIST-01 already cover. The one continuing security-relevant discipline is the project-wide "`createElement`/`textContent` only, never `innerHTML`" rule — this MUST continue for all new elements this phase introduces (thinking-indicator text, reward-toast "+N ₽" text, ruble-balance chip text), since all of it is either static copy or numeric values already validated/typed by the core (`state.currentRewards: number`, reward amounts from `RewardEvent` records) — no untrusted string ever needs `innerHTML` here.

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reflected/DOM-based XSS via `innerHTML` on dynamically-inserted copy (thinking cue, reward toast, ruble balance) | Tampering | Continue `createElement` + `textContent` exclusively for every new element this phase adds — confirmed as the existing project-wide convention (grep-verified clean across Phase 1-4, per CONTEXT.md's Established Patterns note); do not introduce a single `innerHTML` assignment anywhere in this phase's new code. |

## Sources

### Primary (HIGH confidence)

- `src/style.css`, `src/main.ts`, `src/ui/**/*.ts`, `src/core/state/progressSchema.ts`, `src/core/lessonEngine.ts` — read directly this session, all line-number references above verified against actual file contents.
- `.planning/phases/01-deterministic-core-lesson-rendering-persistence/01-UAT.md` — Gaps section read verbatim for exact bug descriptions.
- `.planning/phases/05-kid-friendly-visual-design/05-CONTEXT.md`, `05-UI-SPEC.md` — read in full, all D-01..D-12 decisions and exact design values sourced from here.
- `package.json`, `vitest.config.ts` — read directly, confirmed current dependency versions and test environment.

### Secondary (MEDIUM confidence)

- [Josh W. Comeau — "Building a Magical 3D Button with HTML and CSS"](https://www.joshwcomeau.com/animation/3d-button/) — confirms zero-blur offset box-shadow as the standard chunky-button technique.
- [CSS-Tricks — "Boxy Buttons"](https://css-tricks.com/books/greatest-css-tricks/abusing-box-shadow-fun-visual-effects/) — cross-confirms the same technique.
- [Gregory Schier — "Clicky 3D Buttons With CSS"](https://schier.co/blog/clicky-3d-buttons-with-css) — cross-confirms, third independent source.
- [DockYard — "Accessible Loading Indicators—with No Extra Elements!"](https://dockyard.com/blog/2020/03/02/accessible-loading-indicatorswith-no-extra-elements) — confirms `role="status"`/`aria-live` pattern for thinking indicators.
- [csstools.io — "CSS Loader Animations – 12 Patterns with Accessibility Tips"](https://csstools.io/blog/css-loader-animations) — cross-confirms `prefers-reduced-motion` handling for looping animations.

### Tertiary (LOW confidence)

None — all findings above were either grounded directly in the codebase (HIGH) or cross-verified across 2+ independent web sources (MEDIUM).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, entirely confirmed via direct `package.json`/`vitest.config.ts` reads.
- Architecture: HIGH — every re-skin target and the exact thinking-indicator/toast/top-bar insertion points confirmed via direct file reads of `main.ts`, `lessonEngine.ts`, and all `src/ui/**` files.
- Pitfalls (the two D-12 bugs): HIGH — root causes traced to specific line ranges in `main.ts` by reading the actual render/feedback logic, not inferred from the bug descriptions alone.
- CSS technique details (chunky button, accessible motion): MEDIUM — cross-verified across 3 and 2 independent web sources respectively, standard/uncontroversial techniques with no ambiguity.

**Research date:** 2026-07-03
**Valid until:** No expiry risk — this phase has no external dependency versions to go stale; codebase-grounded findings remain valid until the referenced files change (i.e., until this phase is implemented).
