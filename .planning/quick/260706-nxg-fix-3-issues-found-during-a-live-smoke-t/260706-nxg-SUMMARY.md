---
phase: quick-260706-nxg
plan: 01
subsystem: ui
tags: [typescript, vitest, agent-gateway, ui-polish, topic-labels]

requires:
  - phase: quick-260705-rl5
    provides: Cloudflare Worker key-proxy that made a live end-to-end smoke test possible in the first place

provides:
  - src/core/topics/topicLabels.ts - a topic-id -> Russian display-label lookup with a raw-id fallback that never throws
  - SessionEndScreen and parentReportGenerator fallback template routing all topic strings through topicLabel()
  - callAgent TIMEOUT_MS raised 8000 -> 12000 to match observed real Worker latency
  - TheoryScreen rendering rule/explanation text as one <p> per sentence instead of one dense paragraph

affects: [ui-polish, agent-gateway, session-end, theory-screen]

tech-stack:
  added: []
  patterns:
    - "Topic-id -> Russian label lookup module (TOPIC_LABELS record + topicLabel() with `?? id` fallback) as the standard place to translate internal snake_case ids into user-facing text"
    - "splitSentences() render-time helper for breaking long Russian text into per-sentence <p> elements without touching source data shape"

key-files:
  created:
    - src/core/topics/topicLabels.ts
    - tests/core/topics/topicLabels.test.ts
  modified:
    - src/ui/screens/SessionEndScreen.ts
    - src/core/agents/parentReportGenerator.ts
    - src/core/agents/callAgent.ts
    - src/ui/screens/TheoryScreen.ts
    - tests/core/agents/parentReportGenerator.test.ts
    - tests/ui/screens/TheoryScreen.test.ts

key-decisions:
  - "topicLabel() lives in src/core/topics/ as a pure, side-effect-free lookup — no new architecture, no Lesson-1A.json schema change"
  - "callAgent TIMEOUT_MS raised to 12000 (not higher) to bound worst-case two-attempt wait at 24s while giving real ~6.4-7s Worker latency comfortable headroom"
  - "TheoryScreen's splitSentences() is applied uniformly to both theory.rule and the active explanation text (round-0 pre-written AND live agent/fallback text), keeping rendering consistent regardless of text source"

requirements-completed: [SMOKE-FIX-01, SMOKE-FIX-02, SMOKE-FIX-03]

coverage:
  - id: D1
    description: "topicLabel() maps all 8 known topic-ids to distinct Russian labels and returns the raw id unchanged (never throws) for unknown/empty input"
    requirement: "SMOKE-FIX-01"
    verification:
      - kind: unit
        ref: "tests/core/topics/topicLabels.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "SessionEndScreen's Следующий фокус line and parentReportGenerator's fallback template both render Russian topic labels instead of raw snake_case ids"
    requirement: "SMOKE-FIX-01"
    verification:
      - kind: unit
        ref: "tests/core/agents/parentReportGenerator.test.ts#agent failure (both attempts, REPORT-02) -> resolves to a TEMPLATE report deterministically interpolating all 6 snapshot fields, source:'core'"
        status: pass
    human_judgment: false
  - id: D3
    description: "callAgent's per-attempt timeout is 12000ms, matching observed real Worker latency headroom; retry-then-fallback structure unchanged"
    requirement: "SMOKE-FIX-02"
    verification:
      - kind: unit
        ref: "tests/core/agents/callAgent.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "TheoryScreen renders multi-sentence explanation/rule text as multiple <p> elements (one per sentence), single-sentence text as exactly one <p>, with full text recoverable from textContent"
    requirement: "SMOKE-FIX-03"
    verification:
      - kind: unit
        ref: "tests/ui/screens/TheoryScreen.test.ts"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-06
status: complete
---

# Quick Task 260706-nxg: Fix 3 Live Smoke-Test Issues Summary

**Topic-id -> Russian label lookup closes two UI text leaks, callAgent timeout raised to match real Worker latency, and TheoryScreen now renders one paragraph per sentence.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-06T14:08:00Z (approx, first commit 2bd8a26)
- **Completed:** 2026-07-06T14:23:51Z
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- Created `src/core/topics/topicLabels.ts` mapping all 8 `Lesson-1A.json` topicImpact ids to short Russian display labels, with a `topicLabel()` helper that falls back to the raw id string on any lookup miss and never throws.
- Wired `topicLabel()` into both leak points found during the live smoke test: `SessionEndScreen`'s "Следующий фокус" line and `parentReportGenerator`'s deterministic fallback template (strugglingTopics/reviewTopics/recommendation).
- Raised `callAgent`'s `TIMEOUT_MS` from 8000 to 12000, matching the ~6.4-7s real Cloudflare Worker latency observed live, reducing avoidable fallbacks and long session-end waits.
- Added a `splitSentences()` render-time helper to `TheoryScreen` so multi-sentence rule/explanation text renders as multiple `<p>` elements (one per sentence) instead of one dense paragraph, applied uniformly to round-0 pre-written text and live agent/fallback text.

## Task Commits

Each task was committed atomically (TDD tasks show test -> feat commit pairs):

1. **Task 1: Create topicLabels map and use it at both leak points**
   - `2bd8a26` (test) - failing test for topicLabel()
   - `d30221c` (feat) - implement topicLabel() with 8 topic-id mappings
   - `ec9fd42` (fix) - route topic-ids through topicLabel() at both leak points + update parentReportGenerator test
2. **Task 2: Raise callAgent per-attempt timeout 8000 -> 12000**
   - `c3cc8f9` (perf) - raise callAgent TIMEOUT_MS from 8000 to 12000
3. **Task 3: Split TheoryScreen explanation text into per-sentence paragraphs**
   - `7237d60` (test) - failing test for per-sentence TheoryScreen paragraphs
   - `acfa0ac` (feat) - split TheoryScreen explanation/rule into per-sentence paragraphs

**Plan metadata:** committed separately by the orchestrator (docs commit, not included above).

## Files Created/Modified

- `src/core/topics/topicLabels.ts` - `TOPIC_LABELS` record (8 entries) + `topicLabel(id)` with `?? id` fallback
- `tests/core/topics/topicLabels.test.ts` - unit tests for known ids, distinctness, unknown-id and empty-id fallback
- `src/ui/screens/SessionEndScreen.ts` - "Следующий фокус" line now calls `topicLabel(props.recommendedFocus)`
- `src/core/agents/parentReportGenerator.ts` - `buildTemplateReport()` maps `strugglingTopics`/`reviewTopics`/`recommendation` through `topicLabel()`
- `tests/core/agents/parentReportGenerator.test.ts` - fallback-report assertions updated to expect `topicLabel()` output, not raw ids
- `src/core/agents/callAgent.ts` - `TIMEOUT_MS` constant changed from `8000` to `12000` with an updated rationale comment
- `src/ui/screens/TheoryScreen.ts` - new `splitSentences()` + `appendSentenceParagraphs()` helpers; `theory.rule` and the active explanation text now render as one `<p>` per sentence; `.display` class preserved on the first rule paragraph
- `tests/ui/screens/TheoryScreen.test.ts` - added multi-sentence (>1 `<p>`) and single-sentence (exactly 1 `<p>`) coverage; existing verbatim rule assertion switched to per-sentence substring checks

## Decisions Made

- Kept `topicLabel()` as a pure lookup with no new architecture or state — matches CONTEXT's locked decision and the project's deterministic-core/agent-boundary constraint.
- Applied `splitSentences()` uniformly to both `theory.rule` and the active explanation (covers round-0 pre-written text and live Theory Tutor agent/fallback text through the same code path), per CONTEXT's consistency discretion note.
- Left `exampleRu` as effectively a single `<p>` (examples in `Lesson-1A.json` are single-line), while still passing through the same helper machinery conceptually consistent with the rest of the render — no separate special-casing needed since single-sentence input yields exactly one paragraph.

## Deviations from Plan

None - plan executed exactly as written. All 3 tasks, their TDD RED/GREEN gates (Tasks 1 and 3), and the non-TDD Task 2 were implemented per the plan's `<action>`/`<verify>`/`<done>` blocks with no architectural changes, no new dependencies, and no `Lesson-1A.json` edits.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 3 smoke-test issues (topic-id leak, tight callAgent timeout, dense theory paragraph) are fixed and covered by unit tests.
- Full test suite (258 tests across 36 files) passes; `tsc --noEmit` is clean; `public/Lesson-1A.json` is byte-unchanged (confirmed via `git diff --exit-code`).
- No new blockers introduced. The pre-existing `CONTENT-01` gap (no real `single-choice`/`order-builder` lesson content) remains out of scope for this quick task, as noted in STATE.md.

---
*Phase: quick-260706-nxg*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: src/core/topics/topicLabels.ts
- FOUND: tests/core/topics/topicLabels.test.ts
- FOUND: src/ui/screens/SessionEndScreen.ts (modified)
- FOUND: src/core/agents/parentReportGenerator.ts (modified)
- FOUND: src/core/agents/callAgent.ts (modified)
- FOUND: src/ui/screens/TheoryScreen.ts (modified)
- FOUND: tests/core/agents/parentReportGenerator.test.ts (modified)
- FOUND: tests/ui/screens/TheoryScreen.test.ts (modified)
- FOUND commit: 2bd8a26
- FOUND commit: d30221c
- FOUND commit: ec9fd42
- FOUND commit: c3cc8f9
- FOUND commit: 7237d60
- FOUND commit: acfa0ac
