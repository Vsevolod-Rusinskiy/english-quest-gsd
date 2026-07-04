---
phase: 05-kid-friendly-visual-design
plan: 01
subsystem: ui
tags: [css-tokens, design-system, vanilla-ts, vitest, jsdom]

# Dependency graph
requires:
  - phase: 01-deterministic-core-lesson-rendering-persistence
    provides: style.css baseline (spacing scale, typography roles, color token structure), main.ts render()/onSubmit orchestration, ProgressIndicator/FeedbackBanner components
  - phase: 04-progress-advisor-reward-advisor-parent-report
    provides: state.currentRewards running total, handleSessionEnd() sequential Progress Advisor -> Reward Advisor -> Parent Report Generator orchestration
provides:
  - Bright/blocky kid-friendly CSS token VALUES in style.css (colors, typography, spacing, chunky-button shape/motion) matching 05-UI-SPEC.md exactly
  - Shared ThinkingIndicator component reused at all 3 agent-wait call sites in main.ts
  - RewardToast component + before/after currentRewards-diff trigger in the exercise submit handler
  - Ruble-balance top-bar chip reading state.currentRewards live
  - renderProgressIndicatorComplete (Task 2/D-12 Gap 2 fix support)
  - D-12 Gap 1 fix: feedback nulled immediately after the render it was captured for
  - D-12 Gap 2 fix: top-bar reuses engine.getCurrentExercise() as the single completion signal
affects: [06-wave-2-per-screen-reskin, any-future-phase-touching-style.css-or-main.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared thinking-indicator component (one class/function, 3 call sites) rather than 5 bespoke per-agent indicators"
    - "Reward-toast trigger via before/after state.currentRewards diff around a single await (safe because handleAnswer is the only call site that can change currentRewards within that dispatch window)"
    - "Darker-shade-of-own-color border/shadow pairs precomputed as CSS custom properties, not computed at runtime"
    - "Completion-state render functions accept only the invariant they must not overshoot (renderProgressIndicatorComplete(total) has no current param)"

key-files:
  created:
    - src/ui/components/ThinkingIndicator.ts
    - src/ui/components/RewardToast.ts
    - tests/main.test.ts
    - tests/ui/components/ThinkingIndicator.test.ts
  modified:
    - src/style.css
    - src/main.ts
    - src/ui/components/ProgressIndicator.ts
    - tests/ui/components/ProgressIndicator.test.ts

key-decisions:
  - "Task 1 RED tests for the two D-12 bugs were rewritten mid-task after initial versions passed trivially against buggy code (fresh-remount and disabled-state checks don't reproduce the actual bugs) — replaced with reproductions that exercise the real code paths (Показать итоги re-render for Gap 1, full traversal to lesson-complete for Gap 2)"
  - "D-12 Gap 1's actual leak point is the lesson-complete branch's feedbackAppliesHere check (reviewQueue.length === 0 stays permanently true post-completion), not the main-pass advance render itself — fixed by nulling feedback right after the render() call that legitimately shows it"
  - "Reward-toast trigger uses a before/after currentRewards diff per 05-PATTERNS.md's correction to RESEARCH.md's Assumption A1 (HandleAnswerResult has no rewardAmount field)"

patterns-established:
  - "CSS custom-property darker-shade pairs (--color-accent/--color-accent-dark, etc.) for the chunky-button offset-shadow technique"
  - "prefers-reduced-motion fallback on any new looping CSS animation"

requirements-completed: [UI-01, UI-02]

coverage:
  - id: D1
    description: "style.css design tokens updated to 05-UI-SPEC.md's exact bright/blocky color, typography, spacing, and shape-language values"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "tests/ui/components/ThinkingIndicator.test.ts, tests/ui/components/ProgressIndicator.test.ts (component classes/colors exercised indirectly via DOM assertions)"
        status: pass
      - kind: other
        ref: "grep -n \"font-weight: 600\" src/style.css (zero matches)"
        status: pass
    human_judgment: true
    rationale: "Exact visual appearance (bright/blocky/kid-friendly feel) requires human visual review; automated tests confirm token values and class wiring but not perceived aesthetic quality."
  - id: D2
    description: "Shared ThinkingIndicator component wired at all 3 agent-wait call sites (theory, exercise submit, Показать итоги)"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "tests/main.test.ts#shows a shared thinking-indicator while awaiting the agent call, removed once settled"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ruble-balance top-bar chip reading state.currentRewards live"
    requirement: "UI-02"
    verification:
      - kind: unit
        ref: "tests/main.test.ts#shows a ruble-balance chip in the top bar reflecting state.currentRewards"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reward toast fires with the correct amount on a real reward-granting answer"
    requirement: "UI-02"
    verification:
      - kind: unit
        ref: "tests/main.test.ts#shows a reward toast matching the actual state.currentRewards delta on a rewarding answer"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-12 Gap 1 fix: feedback banner never leaks onto a render not caused by its own answer"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "tests/main.test.ts#clears the feedback banner on a later render not caused by a new submit (D-12 Gap 1)"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-12 Gap 2 fix: progress indicator never overshoots to N+1 из N at lesson-complete"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "tests/main.test.ts#never shows an overshoot progress indicator at lesson-complete (D-12 Gap 2), tests/ui/components/ProgressIndicator.test.ts#renderProgressIndicatorComplete"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-03
status: complete
---

# Phase 5 Plan 01: Visual Foundation + Shared Components + D-12 Bug Fixes Summary

**Bright/blocky CSS token overhaul in style.css, two new shared components (ThinkingIndicator, RewardToast), a live ruble-balance top-bar chip, and both Phase-1-deferred D-12 bugs (stale feedback banner, progress-indicator overshoot) fixed in main.ts.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-03T22:37:30+03:00
- **Completed:** 2026-07-03T22:49:31+03:00
- **Tasks:** 2 (TDD: RED then GREEN)
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- Updated every design-token VALUE in `src/style.css` to 05-UI-SPEC.md's bright/saturated/blocky palette, typography (14/22/32px, weight 700), 8-point spacing scale (activating 2xl/3xl), chunky offset-shadow primary-CTA treatment, and bounce-in/gentle-shake feedback motion — all scoped narrowly enough that option chips/theory toggles keep the Phase 1 44px touch-target floor
- Added `ThinkingIndicator.ts` and wired it as ONE shared component at all 3 agent-wait call sites in `main.ts` (theory buttons, exercise submit, "Показать итоги") — no bespoke per-agent indicators
- Added `RewardToast.ts` and a before/after `state.currentRewards`-diff trigger in the exercise submit handler, firing "+N ₽" on any answer that actually grants a reward
- Added a live ruble-balance top-bar chip reading `state.currentRewards` directly (same field `SessionEndScreen` already reads)
- Fixed D-12 Gap 1 (feedback banner leaking onto an unrelated later render): traced the actual leak to the lesson-complete branch's `feedbackAppliesHere` check, whose `reviewQueue.length === 0` clause stays permanently true post-completion — fixed by nulling `feedback` immediately after the `render()` call it was captured for
- Fixed D-12 Gap 2 (progress-indicator overshoot at lesson-complete): top-bar block now reuses `engine.getCurrentExercise()` — the same completion signal the main-content block already computes — instead of unconditionally rendering `currentExerciseIndex + 1`

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing tests for main.ts bug fixes, ThinkingIndicator, RewardToast, and completion-state ProgressIndicator** - `2146b1c` (test)
2. **Task 2: Implement design tokens, ThinkingIndicator, RewardToast, ruble chip, and both D-12 bug fixes (GREEN)** - `e67c8e4` (feat)

_Note: no separate refactor commit was needed — GREEN implementation required no follow-up cleanup._

## Files Created/Modified

- `src/style.css` - bright/blocky token values, new component classes (`.thinking-indicator`, `.reward-toast`, `.ruble-balance`), chunky-button/feedback-motion keyframes
- `src/main.ts` - ruble chip, 3 thinking-indicator call sites, reward-toast trigger, D-12 Gap 1 + Gap 2 fixes
- `src/ui/components/ThinkingIndicator.ts` (new) - shared agent-wait cue
- `src/ui/components/RewardToast.ts` (new) - pure "+{N} ₽" render function
- `src/ui/components/ProgressIndicator.ts` - added `renderProgressIndicatorComplete`
- `tests/main.test.ts` (new) - 5 DOM-integration tests (Tests A-E)
- `tests/ui/components/ThinkingIndicator.test.ts` (new) - 4 pure render-function tests
- `tests/ui/components/ProgressIndicator.test.ts` - extended with `renderProgressIndicatorComplete` describe block

## Decisions Made

- Rewrote Task 1's initial Test A (feedback banner) and Test D (thinking indicator) mid-task after discovering they passed trivially against the still-buggy/pre-implementation code (a fresh remount can never carry stale in-memory `feedback`; a synchronous theory-understood path has no observable async window). Replaced with reproductions that genuinely exercise the bug/behavior: Test A now drives a full lesson traversal to completion and clicks "Показать итоги" a second time to prove the stale banner doesn't reappear; Test D now delays `callAnswerChecker`'s mock resolution to create an observable window where the indicator must be present.
- Confirmed via direct code trace that D-12 Gap 1's actual defect lives in the lesson-complete branch (`feedback.atIndex === index - 1 || state.reviewQueue.length === 0`), not the main-pass advance branch RESEARCH.md initially suspected — the `reviewQueue.length === 0` clause has no time-boundedness once the lesson is complete, so any later render (e.g., a second "Показать итоги"-triggered render) would show the stale banner forever without the fix.
- Followed 05-PATTERNS.md's correction to 05-RESEARCH.md: the reward-toast trigger uses a `state.currentRewards` before/after diff around the `handleAnswer()` await, not a `result.rewardAmount` field (which does not exist on `HandleAnswerResult`).

## Deviations from Plan

None - plan executed exactly as written. The test-authoring correction described above (Rule 1 — auto-fix bugs in the test's own reproduction logic, not the implementation) was resolved entirely within Task 1's RED phase before any implementation code was written, and did not require touching any file outside the plan's declared `files_modified` list.

## Issues Encountered

- Task 1's first draft of Test A and Test D passed against pre-implementation code, which the TDD gate requires to fail (RED). Root-caused each to a mismatch between the test's chosen reproduction path and the actual bug/behavior location, then rewrote both against the real code paths (traced via reading `src/main.ts` line-by-line) until both genuinely failed for the intended reason before proceeding to Task 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `style.css` token structure, shared components, and both D-12 fixes are in place — Wave 2's per-screen re-skin plans (theory, all 4 exercise renderers, session-end) can now apply the finalized token values/classes without touching `main.ts` or `style.css`'s shared sections again, avoiding file-conflict across parallel Wave 2 plans.
- Full test suite green (239/239 passing), zero regressions in `tests/core/*`, `tests/e2e/*`, or other `tests/ui/*` files.
- No blockers for Wave 2.

---
*Phase: 05-kid-friendly-visual-design*
*Completed: 2026-07-03*

## Self-Check: PASSED

All created files verified present on disk; all task/summary commit hashes (2146b1c, e67c8e4, 130aa57) verified present in git log.
