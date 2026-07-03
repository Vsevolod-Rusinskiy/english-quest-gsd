---
phase: 03-agent-gateway-answer-checker-theory-tutor
review_path: .planning/phases/03-agent-gateway-answer-checker-theory-tutor/03-REVIEW.md
fixed_at: 2026-07-03T08:02:00Z
fix_scope: critical_only
findings_in_scope: 3
fixed: 3
skipped: 10
status: critical_fixed
---

# Phase 3: Code Review Fix Report

Applied manually (not via `gsd-code-fixer`) after discussing CR-02's confidence-threshold
product decision with the user directly, since it required a product judgment call rather
than a mechanical fix.

## Fixed

- **CR-01** (`src/core/agents/callAgent.ts`): `callAgent` now rejects any response with
  `!= 1` `tool_use` blocks instead of silently taking the first one via `.find()`.
- **CR-02** (`src/core/agents/answerChecker.ts`): Added a core-side confidence floor
  (`CORRECT_CONFIDENCE_THRESHOLD = 0.8`, user-chosen). `isCorrect: true` from the agent is
  now only trusted when `confidence >= 0.8`; below that it's downgraded to `false` while
  `errorType`/`confidence`/`hintRu` still pass through so the child still gets a hint.
- **CR-03** (`src/core/agents/callAgent.ts`): Both attempt errors are now logged via
  `console.error` before falling back, so a genuine code defect no longer looks identical
  to a transient network blip in production.

Regression tests added: `tests/core/agents/answerChecker.test.ts` (confidence
above/below-threshold cases) and `tests/core/agents/callAgent.test.ts` (ambiguous
multi-tool_use rejection, error logging on double failure). Full suite: 170/170 passing,
`tsc --noEmit` clean.

Commit: `7cb5b90` fix(03): code review fixes - confidence gate (CR-02), reject ambiguous
tool_use (CR-01), log gateway failures (CR-03)

## Skipped (deferred by user decision — not urgent for Phase 3 completion)

- WR-01 through WR-06 (async/void type mismatch in `TheoryScreen`, untested timeout
  budget, fallback-object type-safety trap, non-discriminated `CheckResult` union, silent
  empty-explanation fallback, unused `level`/`canSimplifyMore` schema fields)
- IN-01 through IN-04 (DI-seam typing looseness, missing confidence-threshold test
  coverage — now partially addressed by the regression tests above — validation-logic
  duplication in `handleAnswer`, duplicated fallback-construction boilerplate)

See `03-REVIEW.md` for full detail on each. None block Phase 3 completion; revisit before
Phase 4 adds a 3rd/4th/5th agent (IN-04 in particular compounds with more agent wrappers).
