---
phase: 05-kid-friendly-visual-design
reviewed: 2026-07-03T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/style.css
  - src/main.ts
  - src/ui/components/ThinkingIndicator.ts
  - src/ui/components/RewardToast.ts
  - src/ui/components/ProgressIndicator.ts
  - src/ui/components/FeedbackBanner.ts
  - src/ui/screens/TheoryScreen.ts
  - tests/main.test.ts
  - tests/ui/components/ThinkingIndicator.test.ts
  - tests/ui/components/ProgressIndicator.test.ts
  - tests/ui/components/FeedbackBanner.test.ts
  - tests/ui/screens/TheoryScreen.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-03
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This phase re-skins the app with a bright, kid-friendly palette and adds three
new small components (ThinkingIndicator, RewardToast) plus D-12 bug fixes and
`praiseRu` wiring in `main.ts`/`FeedbackBanner.ts`. The two D-12 fixes were
traced end-to-end and are correct: the progress-indicator overshoot fix
(`renderProgressIndicatorComplete` gated on `engine.getCurrentExercise() ===
null`, the same completion signal the main-content block uses) cannot show
"N+1 из N" under any reachable state, and the feedback-banner leak fix (nulling
`feedback` immediately after the one render it was captured for, in both the
main-pass-correct and review-pass-correct branches) closes the exact stale-banner
path the regression test targets. The `praiseRu` cross-check gate in
`lessonEngine.ts` (only surfaced when `source === "agent"` AND the agent's
suggested reason matches a reward the core actually granted) is respected by
`main.ts` — `result.praiseRu` flows straight into `feedback.praiseRu` with no
bypass logic added in this phase. `createElement`/`textContent` discipline is
clean across every touched file; there is no `innerHTML` anywhere in the diff.

The one concrete defect is in the new color palette: the phase changed
`--color-success` and `--color-error` (the exact colors `.feedback-banner`
uses for its text) to values that fail WCAG AA text contrast against the new
`--color-bg`, and in the success case made an already-marginal Phase 1 value
measurably worse. Given the feedback banner is the primary channel for telling
a child whether their answer was right or wrong, this is a real regression,
not a nitpick — see CR-01.

## Critical Issues

### CR-01: Feedback-banner text colors fail WCAG AA contrast against the new background (regression introduced this phase)

**File:** `src/style.css:17-28` (tokens), `src/style.css:237-247` (`.feedback-banner.correct`/`.incorrect`)
**Issue:** This phase changed `--color-bg` from `#ffffff` to `#fff8e7` and
`--color-success`/`--color-error` from `#16a34a`/`#dc2626` to `#3dbb5e`/`#e8544a`.
`.feedback-banner.correct { color: var(--color-success) }` and
`.feedback-banner.incorrect { color: var(--color-error) }` set the text color
on the banner container, which is inherited by every child text node
(`"Верно!"`, the "Не совсем..." message, the hint `<p>`, and the new
`.praise-text` element — none of them override `color`). Measured contrast
ratios (WCAG relative luminance formula) against the new `--color-bg`:

- Success (`#3dbb5e` on `#fff8e7`): **2.34:1** (Phase 1 baseline on white was
  already a failing 3.30:1 — this phase made it worse, not better)
- Error (`#e8544a` on `#fff8e7`): **3.42:1** (Phase 1 baseline on white was a
  passing 4.83:1 — this phase regressed a previously-compliant color)

Both fail WCAG AA's 4.5:1 threshold for normal-size text (14px `.praise-text`,
16px body text are all "normal", not "large" text, so the 3:1 large-text
exception does not apply). This is the primary correct/incorrect signal
surfaced to a child user — insufficient contrast directly undermines the
app's core learning-feedback mechanic, not just a cosmetic nit.

**Fix:** Darken `--color-success`/`--color-error` (or introduce dedicated
`-dark` text variants, following the same pattern already used for
`--color-accent-dark`/`--color-highlight-dark`/`--color-error-dark`/
`--color-success-dark` which exist in `:root` but are currently only used for
borders) and use the `-dark` variant for the `color:` declaration specifically,
keeping the brighter value for borders/backgrounds only:

```css
.feedback-banner.correct {
  border-color: var(--color-success);
  color: var(--color-success-dark);
  animation: bounce-in 350ms ease-out;
}

.feedback-banner.incorrect {
  border-color: var(--color-error);
  color: var(--color-error-dark);
  animation: gentle-shake 300ms ease-in-out;
}
```
Verify `--color-success-dark` (`#2c9647`) and `--color-error-dark` (`#c23b32`)
against `#fff8e7` after the change and adjust further if either still falls
short of 4.5:1.

## Warnings

### WR-01: Primary-button text (white-on-accent) is below AA contrast for its font size

**File:** `src/style.css:127-146` (`button`, `button.accent, button.selected`)
**Issue:** `button.accent`/`button.selected` render white text (`#ffffff`) on
`--color-accent` (`#2e7df7`) — measured contrast is **3.89:1**. WCAG AA allows
3:1 only for "large text" (≥18.66px at bold weight, ≥24px otherwise); the
button font-size is 14px bold, which does not qualify as large text, so the
4.5:1 threshold applies and this fails.
**Fix:** Darken `--color-accent` slightly, or switch the accent button's text
color to a darker on-brand tone, and re-measure. Since `--color-accent-dark`
(`#1e5fc7`) is already defined for borders, consider whether the *background*
should be the darker shade for `.accent`/`.selected` buttons instead, keeping
white text at an acceptable ratio.

### WR-02: No test exercises `praiseRu` end-to-end through `main.ts`

**File:** `tests/main.test.ts:40-42`
**Issue:** `tests/main.test.ts`'s `callRewardAdvisor` mock always returns
`suggestedReasons: []`, so `praiseRu` is never non-empty in any of this
file's five tests — the newly-added praise-text rendering path in
`FeedbackBanner.ts` (lines 264, 281, 302, 317 of `main.ts`) is only covered by
the isolated `FeedbackBanner.test.ts` unit test, which calls
`renderFeedbackBanner(...)` directly with a hand-passed `praiseRu` string. There
is no test proving the wiring from a real `handleAnswer()` result (with a
`source: "agent"` reward-advisor response whose `suggestedReasons` actually
matches a granted `rewardEvent`) through to the rendered `.praise-text` element
in the live DOM. This is exactly the kind of "computed but never rendered" gap
that this phase's own commit history says was already missed once (per the
`FeedbackBanner.test.ts` header comment) — an end-to-end regression here would
currently go undetected.
**Fix:** Add a test to `tests/main.test.ts` (or a new e2e-style test) that
mocks `callRewardAdvisor` to resolve `{ source: "agent", suggestedReasons:
["first_try_correct"], celebrationRu: "..." }` for an answer known to trigger
a `first_try_correct` reward event, then asserts `.praise-text` is present in
the rendered banner with the expected copy.

### WR-03: Stale `feedback` object is never cleared after the review-pass "Продолжить" click

**File:** `src/main.ts:266-271`
**Issue:** In the incorrect-review-pass branch, `continueButton`'s click
handler calls `render(store.getState())` directly but never sets
`feedback = null` (unlike the main-pass-correct and review-pass-correct
branches a few lines above, which explicitly null `feedback` right after the
one render it applies to — the documented "D-12 Gap 1 fix" pattern). In every
currently reachable state this happens to be harmless, because the stale
`feedback.isCorrect` is `false` here, and both `feedbackAppliesHere` checks
(exercise-branch and lesson-complete-branch) require either
`feedback.isCorrect === true` or an exact `exerciseId` match against the *new*
current item — which a FIFO, self-deduping review queue will not produce on
the very next render. However, this relies on an implicit invariant (the
queue never re-presents the same id back at its head immediately after
dequeuing it) that is not enforced in `main.ts` itself, and nothing prevents a
future core change (e.g., re-inserting a missed exercise back to the front of
the queue) from silently reintroducing the stale banner. The other three
consumption sites make the "null it right after use" rule explicit and easy
to audit; this one is the odd one out.
**Fix:** For consistency and defense-in-depth, null `feedback` in the
`continueButton` click handler too:
```js
continueButton.addEventListener("click", () => {
  feedback = null;
  render(store.getState());
});
```

## Info

### IN-01: `.lesson-title-block` is unused dead CSS (pre-existing, not introduced this phase)

**File:** `src/style.css:97-99`
**Issue:** No element in `src/` sets `className = "lesson-title-block"` (or
any equivalent). This rule appears unchanged in this phase's diff (only
carried through as context), so it predates Phase 5, but it's worth flagging
since this phase touched most of the surrounding file.
**Fix:** Remove if confirmed unused, or wire it up if a lesson-title block is
still planned.

### IN-02: `RewardToast` elements can outlive their `setTimeout` cleanup if the tab is backgrounded/throttled

**File:** `src/main.ts:204-206`
**Issue:** `setTimeout(() => toastEl.remove(), 1950)` is fire-and-forget with
no `clearTimeout` handle retained. In practice this is low-risk for a
single-lesson session (elements are appended to `document.body`, not `root`,
so they survive `root.textContent = ""` re-renders and always get their own
independent timer), but there's no defensive `.remove()` guard if the same
toast were somehow already removed by other means before the timer fires
(currently impossible, but there's no code comment establishing this
invariant the way other transient-state fields in this file do).
**Fix:** Optional — not urgent given current call sites, but consider a
try/guard or noting the invariant explicitly, consistent with this file's
otherwise very thorough comments on transient-state lifetime elsewhere.

---

_Reviewed: 2026-07-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
