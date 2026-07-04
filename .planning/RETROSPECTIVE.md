# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-07-04
**Phases:** 5 | **Plans:** 14 (13 planned + 1 gap-closure) | **Sessions:** ~4

### What Was Built
- Deterministic lesson core: theory, all 4 exercise types, exact-match checking, synchronous localStorage persistence
- Topic-mastery FSM, same-session review queue, fixed-rule reward ledger with farm-proof dedup
- Shared `callAgent()` trust boundary (validate→retry-once→fallback) and 2 agents on it (Answer Checker, Theory Tutor)
- 3 more agents (Reward Advisor, Progress Advisor, Parent Report Generator) reusing the same gateway unchanged
- Kid-friendly bright/blocky visual re-skin across every screen, WCAG AA contrast, and a terminal-phase gap-closure (RU+EN task-card instructions, specified in Phase 1, never rendered until Phase 5's verification caught it)

### What Worked
- **The `callAgent()` gateway genuinely generalized** — built once in Phase 3 for 2 agents, reused unchanged by 3 more in Phase 4 with zero modification. Confirms the "5 independent thin wrappers over 1 gateway" architecture bet paid off rather than needing per-agent special-casing.
- **Code review caught real bugs before they shipped, every phase it ran**: Phase 2 (2 critical logic bugs — scalar-vs-array reward loss, stale review-queue reopen check), Phase 3 (3 criticals — ambiguous tool_use trust, unguarded confidence, silent error swallowing), Phase 5 (1 critical — WCAG contrast regression from the new color palette). The review→fix→re-verify loop worked as designed every time.
- **Goal-backward phase verification (not just "did the tasks run") caught a real terminal-phase blocker**: Phase 5's verifier didn't just trust that UI-02 was already marked "Complete" in REQUIREMENTS.md — it re-checked the actual code against ROADMAP's literal success criteria and found RU+EN instructions were validated data that was never rendered, a gap dating back to Phase 1 that no earlier phase's verification caught. Since Phase 5 was the last phase in the milestone, this was the last chance to catch it — verifying "does the code do what the goal says" rather than "did SUMMARY.md claim success" is what made the difference.
- **Live human-verify checkpoints (actually running the app in a browser, not rubber-stamping) found 2 more real gaps** in Phase 5's own final plan: Reward Advisor's praise text was computed and cross-checked but never rendered anywhere, and the session-end screen had zero visual styling despite the phase's whole purpose being visual design.

### What Was Inefficient
- A quota/connection interruption mid-Phase-4 (during Plan 02's execution) required manual recovery — the plan's actual work (code + tests) had completed, but the SUMMARY.md commit never landed before the interruption. Recovery was straightforward (verify tests pass, commit the orphaned SUMMARY, continue) but cost a round-trip.
- The Phase 5 UI-SPEC's own "Bilingual text note" incorrectly asserted the RU+EN instruction rendering was "unchanged from Phase 1" and already working — an unverified inherited assumption that, if trusted, would have let the real gap slip through unnoticed.

### Patterns Established
- **Confidence/trust gates on every agent-proposed value that affects state**: Answer Checker's `confidence >= 0.8` threshold (Phase 3, added after code review) became the template for Reward Advisor's cross-check-against-granted-events gate (Phase 4, built in from the start, not retrofitted after a review finding) — the lesson from one phase's code-review catch directly informed the next phase's initial design.
- **One shared component/gateway per cross-cutting concern, reused not duplicated**: `callAgent()` (5 agents), `ThinkingIndicator` (3 UI call sites covering 5 agent waits), `getCurrentExerciseId()`/`getCurrentSection()` (main-pass + review-pass share one resolver each) — recurring theme of building the shared primitive once and threading it through, rather than one-off implementations per call site.
- **Numeric verification over eyeballing for accessibility**: the Phase 5 WCAG contrast fix was verified with the actual relative-luminance formula (4.70:1, 5.00:1, 5.97:1), not "looks readable enough" — worth carrying forward for any future color/contrast decision.

### Key Lessons
1. Terminal-phase verification should re-derive ground truth from the actual code and the roadmap's literal wording, not trust that an earlier phase's REQUIREMENTS.md checkbox was ever actually verified against implementation — checkboxes can be marked complete based on partial delivery (data validated but never rendered, in this case).
2. A phase's own UI-SPEC/RESEARCH document asserting "X is already unchanged/working from a prior phase" is a claim, not a fact — worth a quick grep-verification before relying on it, especially near a milestone's final phase where there's no later phase to catch a wrong assumption.
3. When a human-verify checkpoint exists in a plan, actually running the app (not just reading the SUMMARY) surfaces real gaps that unit tests alone don't catch — 2 of the 3 real defects found in Phase 5 came directly from a live browser walkthrough, not from any automated test failure.

### Cost Observations
- Model mix: opus (planning), sonnet (research/execution/review/verification), haiku (plan-checking/UI-checking) — roughly matching each subagent role's complexity to model capability rather than defaulting everything to the most expensive model.
- Sessions: ~4 across the milestone, including one autonomous multi-phase run (Phase 4 discuss→plan→execute→Phase 5 discuss→plan→execute→gap-closure→milestone-complete) conducted without the user present, self-verifying via live browser checks in place of human sign-off at checkpoints.
- Notable: the autonomous run's own self-verification (browser walkthroughs, numeric contrast checks, re-running full test suites before trusting subagent claims) caught defects a purely trust-the-subagent-report approach would have missed — verification discipline mattered more than model choice for catching real bugs.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~4 | 5 | First milestone — established the deterministic-core/agent-boundary architecture and the review→verify→gap-closure discipline from scratch |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|---------------------|
| v1.0 | 252 | not measured (no coverage tool configured) | 0 (stayed within TS/Vite/Vitest/Zod/@anthropic-ai/sdk throughout) |

### Top Lessons (Verified Across Milestones)

1. Terminal-phase (or milestone-close) verification must re-derive ground truth from actual code, not trust prior checkboxes — established this milestone, awaiting a second milestone to confirm it generalizes.
2. Agent-proposed values that affect state need an explicit core-side trust gate from day one, not as a reactive code-review fix — established this milestone via the Phase 3→Phase 4 pattern transfer.
