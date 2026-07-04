---
phase: 04-progress-advisor-reward-advisor-parent-report
review_path: .planning/phases/04-progress-advisor-reward-advisor-parent-report/04-REVIEW.md
fixed_at: 2026-07-03T22:10:00Z
fix_scope: warnings
findings_in_scope: 4
fixed: 4
skipped: 4
status: warnings_fixed
---

# Phase 4: Code Review Fix Report

Applied directly (autonomous run, no blockers found — all 4 warnings were low-risk
clarity/correctness fixes with an obvious correct answer, no product judgment call needed).

## Fixed

- **WR-01** (`src/core/agents/progressAdvisor.ts`): Documented why the fixed motivational
  fallback sentence is exempt from the "never fabricate" rule (content-free, no personalized
  claim).
- **WR-02** (`src/core/lessonEngine.ts`): Documented that `correctCount` is deliberately
  "currently correct" (final-outcome-per-exercise), not a lifetime sum of every correct attempt.
- **WR-03** (`src/core/agents/rewardAdvisor.ts`): Empty/whitespace-only `celebrationRu` from a
  genuine agent response is now normalized to `undefined`, matching the "no praise" fallback
  shape, so a caller using `?? fallback` can't render an empty praise bubble. Regression test
  added.
- **WR-04** (`src/core/lessonEngine.ts`): Documented that `strugglingTopics` is
  lifetime-cumulative (topicStats persists across sessions), not session-scoped — acceptable for
  this single-lesson MVP.
- **IN-01** (`src/core/personalization/difficultyGuardrails.ts`): Replaced the non-null-assertion
  `RANK`-lookup with a plain `ORDER` array index, removing the implicit-safety assertion.

Full suite: 228/228 passing (227 + 1 new regression test), `tsc --noEmit` clean.

Commits: `d854cb3` (review report), `011e3fc` (fixes).

## Skipped (not urgent — cosmetic/deferred by design, matches IN-03's own "no action required now")

- IN-02 (`handleSessionEnd()` complexity) — readability nit, no correctness risk; revisit if the
  function grows further.
- IN-03 (unbounded `rewardHistory` serialization) — explicitly "no action required now" per the
  reviewer's own note; only relevant once `rewardHistory` grows large across many sessions.
- IN-04 (magic numbers in `confidenceScore.ts`) — cosmetic naming nit, formula already documented
  in the file header comment.
