---
phase: quick-260706-ogs
plan: 01
subsystem: core
tags: [personalization, trust-boundary, guardrail, vitest]

requires:
  - phase: quick-260706-nxg
    provides: "TOPIC_LABELS (src/core/topics/topicLabels.ts) source-of-truth topic-id -> Russian label map"
provides:
  - "applyRecommendedFocusGuardrail pure function — core-side trust gate validating Progress Advisor's recommendedFocus against TOPIC_LABELS keys"
  - "handleSessionEnd() now routes recommendedFocus through the guardrail before it reaches parentReportGenerator, the session_end dispatch, and SessionEndResult"
affects: [personalization, session-end, parent-report]

tech-stack:
  added: []
  patterns:
    - "Second core-side agent-output guardrail (mirrors applyDifficultyGuardrails): pure function, no network/state access, caller-supplied fallback on validation miss, never throws"

key-files:
  created:
    - src/core/personalization/recommendedFocusGuardrail.ts
    - tests/core/personalization/recommendedFocusGuardrail.test.ts
  modified:
    - src/core/lessonEngine.ts
    - tests/core/lessonEngine.test.ts

key-decisions:
  - "Guardrail validates against Object.keys(TOPIC_LABELS) only — no second/duplicated topic-id list introduced"
  - "The SAME fallbackRecommendedFocus already computed for callProgressAdvisor's input is reused as the guardrail's fallback argument, not a second value"
  - "progressAdvisorSource/progressAdvisorFailed dispatch fields left untouched — they still derive from advisorResult.source, unrelated to the guardrail"

patterns-established:
  - "Pattern: any unconstrained-string agent output field that reaches user/parent-facing text gets its own pure guardrail module at the handleSessionEnd() call site, validated against the existing source-of-truth lookup table (TOPIC_LABELS), never a new list"

requirements-completed: [PERSONAL-03, SMOKE-FIX-02]

coverage:
  - id: D1
    description: "New pure guardrail function applyRecommendedFocusGuardrail validates a candidate recommendedFocus against TOPIC_LABELS keys, returning the caller-supplied fallback on any miss (invalid id, empty string, hallucinated prose), never throwing"
    requirement: "PERSONAL-03"
    verification:
      - kind: unit
        ref: "tests/core/personalization/recommendedFocusGuardrail.test.ts#valid id passthrough"
        status: pass
      - kind: unit
        ref: "tests/core/personalization/recommendedFocusGuardrail.test.ts#invalid id -> fallback: the live-observed hallucinated mixed-language string returns the fallback verbatim"
        status: pass
      - kind: unit
        ref: "tests/core/personalization/recommendedFocusGuardrail.test.ts#empty string -> fallback"
        status: pass
      - kind: unit
        ref: "tests/core/personalization/recommendedFocusGuardrail.test.ts#never throws"
        status: pass
    human_judgment: false
  - id: D2
    description: "handleSessionEnd() wires the guardrail after callProgressAdvisor resolves and routes the validated finalRecommendedFocus into all three downstream consumers: parentReportGenerator's recommendation input, the session_end dispatch (persisted lastRecommendedFocus), and the returned SessionEndResult"
    requirement: "SMOKE-FIX-02"
    verification:
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#PERSONAL-03 (T-ogs-01/T-ogs-02): a hallucinated non-topic-id recommendedFocus from Progress Advisor is replaced by the deterministic fallback everywhere it flows"
        status: pass
      - kind: unit
        ref: "tests/core/lessonEngine.test.ts#D-07 (THE critical case): callParentReportGenerator is invoked with recommendation equal to Progress Advisor's ALREADY-RESOLVED recommendedFocus"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-06
status: complete
---

# Quick Task 260706-ogs: Fix missing core-side trust gate for Progress Advisor's recommendedFocus Summary

**Added a pure `applyRecommendedFocusGuardrail` function mirroring `applyDifficultyGuardrails`, wired into `handleSessionEnd()` so a hallucinated/free-form `recommendedFocus` string from Progress Advisor is replaced by the deterministic fallback before reaching any user/parent-facing consumer.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-06T14:30:00Z
- **Completed:** 2026-07-06T14:42:07Z
- **Tasks:** 2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Closed the last unvalidated agent-output field in the codebase: `recommendedFocus` (`progressAdvisorSchema.ts`'s deliberately unconstrained `z.string()`) now passes through a core-side trust gate before it can reach `SessionEndScreen`'s "Следующий фокус" line or `parentReportGenerator`'s recommendation field.
- New guardrail validates against `Object.keys(TOPIC_LABELS)` — the same source-of-truth map used by `topicLabel()` for display, with zero duplicated topic-id lists.
- Wired at exactly the seam where `applyDifficultyGuardrails()` already gates `suggestedDifficulty`, replacing `advisorResult.recommendedFocus` at all three downstream sites: `callParentReportGenerator`'s input, the `session_end` dispatch, and the returned `SessionEndResult`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the recommendedFocus guardrail pure function + unit tests** - `82bcb48` (feat)
2. **Task 2: Wire the guardrail into handleSessionEnd() and extend lessonEngine tests** - `34a4249` (feat)

**Plan metadata:** (pending orchestrator docs commit)

## Files Created/Modified
- `src/core/personalization/recommendedFocusGuardrail.ts` - New pure guardrail: validates a candidate `recommendedFocus` against `TOPIC_LABELS` keys, returns fallback on any miss, never throws
- `tests/core/personalization/recommendedFocusGuardrail.test.ts` - Unit tests: valid-id passthrough, hallucinated-string -> fallback, empty-string -> fallback, never-throws, fallback identity
- `src/core/lessonEngine.ts` - Imports and calls `applyRecommendedFocusGuardrail` right after `callProgressAdvisor` resolves in `handleSessionEnd()`; replaces all three downstream uses of `advisorResult.recommendedFocus` with the guardrailed `finalRecommendedFocus`
- `tests/core/lessonEngine.test.ts` - New test proving a hallucinated `recommendedFocus` is replaced by the fallback at the `session_end` dispatch (persisted `lastRecommendedFocus`), the `callParentReportGenerator` input, and the returned `SessionEndResult`

## Decisions Made
- Reused the existing `fallbackRecommendedFocus` local (already computed in Step 1 of `handleSessionEnd()` and passed to `callProgressAdvisor`) as the guardrail's fallback argument — no second fallback value was introduced.
- Left `progressAdvisorSource`/`progressAdvisorFailed` dispatch fields untouched since they derive from `advisorResult.source`, an entirely separate concern from the `recommendedFocus` value itself.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both PERSONAL-03 and SMOKE-FIX-02 requirements are satisfied. `progressAdvisorSchema.ts` remains untouched (`recommendedFocus` still `z.string()`, unconstrained by design — validation lives in the core per CLAUDE.md's "agent proposes, core validates before use" boundary). `Lesson-1A.json` unchanged. Full suite (264 tests) and `tsc --noEmit` both clean. No blockers for future work.

---
*Phase: quick-260706-ogs*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: src/core/personalization/recommendedFocusGuardrail.ts
- FOUND: tests/core/personalization/recommendedFocusGuardrail.test.ts
- FOUND: .planning/quick/260706-ogs-fix-missing-core-side-trust-gate-progres/260706-ogs-SUMMARY.md
- FOUND commit: 82bcb48
- FOUND commit: 34a4249
