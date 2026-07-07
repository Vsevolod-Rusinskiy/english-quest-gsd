---
phase: 260707-pu4
plan: 01
subsystem: ui
tags: [css, flexbox, dom, vitest, layout]

# Dependency graph
requires:
  - phase: 260707-krq
    provides: "Top-bar progress bar, streak chip, and topic-mastery summary (UX-PROGRESS-04) that introduced the regression"
provides:
  - "Two-row top-bar layout (.top-bar-row-1 identity/reward, .top-bar-row-2 progress) so a visible-width progress bar and 6 top-bar elements no longer fight for space in one flex row"
  - "renderTopicMasterySummary(topicStats) returns null (not an always-rendered element) for empty topicStats, guarded by the caller like renderStreakChip"
affects: [ui, kid-friendly-visual-design]

tech-stack:
  added: []
  patterns:
    - "Nullable-component-return + caller guard (if (el) row.appendChild(el)) for conditionally-shown top-bar elements — now used by both StreakChip and TopicMasterySummary"

key-files:
  created: []
  modified:
    - src/ui/components/TopicMasterySummary.ts
    - tests/ui/components/TopicMasterySummary.test.ts
    - src/main.ts
    - src/style.css
    - tests/main.test.ts

key-decisions:
  - "renderTopicMasterySummary's empty-state early-return happens before any DOM element is created (not built-then-discarded), matching the plan's exact action spec"
  - ".top-bar-row-2 (and everything in it) is only built inside the existing theoryUnderstood branch — row1 always renders regardless, preserving pre-existing behavior that title/chips show on every screen"

requirements-completed: [UX-TOPBAR-FIX]

coverage:
  - id: D1
    description: "renderTopicMasterySummary({}) returns null instead of an always-rendered 'освоено 0 / 0 тем' zero-state"
    requirement: "UX-TOPBAR-FIX"
    verification:
      - kind: unit
        ref: "tests/ui/components/TopicMasterySummary.test.ts#returns null (never throws) for an empty topicStats"
        status: pass
    human_judgment: false
  - id: D2
    description: "Top bar renders as two rows: row 1 (title + ruble chip + streak chip when present), row 2 (progress text + progress bar + topic-mastery when non-null)"
    requirement: "UX-TOPBAR-FIX"
    verification:
      - kind: unit
        ref: "tests/main.test.ts#renders the top bar as two rows and hides .topic-mastery when topicStats is empty"
        status: pass
    human_judgment: false
  - id: D3
    description: ".progress-bar has real width (flex: 1 1 auto) so it no longer content-collapses to 0 as a flex item"
    requirement: "UX-TOPBAR-FIX"
    verification:
      - kind: unit
        ref: "tests/main.test.ts (full suite, all progress-variant tests still pass with the new CSS)"
        status: pass
    human_judgment: true
    rationale: "jsdom does not compute real layout/pixel widths — the CSS flex:1 1 auto rule itself can only be confirmed visually in a real browser at a narrow viewport, which is out of scope for the automated gate per the plan's <verification> section."
  - id: D4
    description: "All existing top-bar behavior preserved unchanged: 3 progress variants (main/review/complete), ruble chip, streak chip (>=2 threshold)"
    requirement: "UX-TOPBAR-FIX"
    verification:
      - kind: unit
        ref: "npx vitest run (full suite, 294/294 tests pass)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-07-07
status: complete
---

# Quick Task 260707-pu4: Fix Top-Bar Layout Regression Summary

**Split the single flat `.top-bar` flex row into two stacked rows (identity/reward + progress) and gave `.progress-bar` real flex width, fixing a content-collapse-to-0 regression from quick task 260707-krq's 6-element top bar; also made the topic-mastery summary return `null` (not an always-rendered zero-state) before any topic has been touched.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-07T15:39:35Z
- **Completed:** 2026-07-07T15:41:41Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `renderTopicMasterySummary` now returns `HTMLElement | null`, returning `null` before creating any element when `topicStats` is empty — the "освоено 0 / 0 тем" line no longer renders before a topic is touched.
- `render()` in `main.ts` restructures `.top-bar` into `.top-bar-row-1` (title + ruble chip + streak chip, always built) and `.top-bar-row-2` (progress text + progress bar + topic-mastery, built only when `theoryUnderstood`) — all 3 progress-variant branches (review/complete/main) preserved exactly, only the append target moved.
- `.progress-bar` gets `flex: 1 1 auto` so it can no longer content-collapse to `width:0` as a flex item — the core regression fix. `.top-bar` becomes a column flex container; `.top-bar-row-1`/`.top-bar-row-2` carry the row-level flex rules; `.topic-mastery` drops `width:100%`/`margin-top` so it sizes to content inline in row2.
- New `main.ts` test confirms the two-row DOM structure and that `.topic-mastery` is absent at exercise-start (empty `topicStats`).

## Task Commits

Each task was committed atomically:

1. **Task 1: renderTopicMasterySummary returns null for empty topicStats** - `0ea1768` (fix)
2. **Task 2: Restructure render()'s top-bar into two rows + guard nullable summary** - `abee6b4` (fix)
3. **Task 3: CSS two-row layout + give progress bar real width; add main.ts DOM-structure test** - `60d0bd1` (fix)

**Plan metadata:** commit pending (docs: complete plan — handled by orchestrator)

## Files Created/Modified
- `src/ui/components/TopicMasterySummary.ts` - Return type changed to `HTMLElement | null`; early-returns `null` for empty `topicStats` before creating any element.
- `tests/ui/components/TopicMasterySummary.test.ts` - Empty-case test now asserts `null` return instead of zero-state textContent; added truthy guards to the other two tests for the now-nullable return.
- `src/main.ts` - `render()`'s `.top-bar` now builds `row1`/`row2` child divs; topic-mastery append guarded with `if (masteryEl)`.
- `src/style.css` - `.top-bar` becomes `flex-direction: column`; new `.top-bar-row-1`/`.top-bar-row-2` rules; `.progress-bar` gets `flex: 1 1 auto`; `.topic-mastery` drops `width:100%`/`margin-top`.
- `tests/main.test.ts` - New test asserting the two-row structure and absent `.topic-mastery` at exercise-start.

## Decisions Made
- Kept the empty-state early-return in `renderTopicMasterySummary` structured exactly as the plan specified: compute `entries` first, return `null` before any `createElement` call — avoids building-then-discarding an element.
- Row2 (and everything inside it) stays nested inside the existing `theoryUnderstood` conditional, matching pre-existing behavior (progress-bar/text only ever showed post-theory) — row1 (title/chips) always renders, unchanged from before.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Layout regression fixed and covered by unit tests (DOM structure/presence); full `npx vitest run` (294/294) and `npx tsc --noEmit` both pass clean.
- Manual/visual confirmation in a real narrow-viewport browser (that the progress bar is visibly full-width and the two rows read cleanly) is out of automated-gate scope per the plan's `<verification>` section — flagged as `human_judgment: true` in the coverage block (D3) for the verifier to route to a human/UAT step if desired.

---
*Phase: 260707-pu4*
*Completed: 2026-07-07*

## Self-Check: PASSED

All created/modified files verified present on disk; all 3 task commit hashes (`0ea1768`, `abee6b4`, `60d0bd1`) verified present in git log.
