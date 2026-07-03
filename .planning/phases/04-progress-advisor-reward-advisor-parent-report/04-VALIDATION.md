---
phase: 4
slug: progress-advisor-reward-advisor-parent-report
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-03
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x (jsdom environment, globals enabled) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:core` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:core`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-* | 01 | 1 | PERSONAL-01/02/03 | — | Progress Advisor guardrailed by core difficulty rules | unit | `vitest run tests/core/agents/progressAdvisor.test.ts tests/core/personalization/difficultyGuardrails.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-* | 02 | 2 | REWARD-03/04 | — | Reward Advisor praise only applied to already-granted reasons | unit + integration | `vitest run tests/core/agents/rewardAdvisor.test.ts tests/core/lessonEngine.test.ts` | ❌ W0 (schema/wrapper) | ⬜ pending |
| 04-03-* | 03 | 3 | REPORT-01/02 | — | Parent Report template fallback matches same fields | unit + e2e | `vitest run tests/core/agents/parentReportGenerator.test.ts tests/e2e/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/agents/progressAdvisorSchema.ts` + `tests/core/agents/progressAdvisor.test.ts` — mirrors `theoryTutor.test.ts` structure (agent-success, agent-failure-after-retry, wrong-shape-rejected-by-Zod)
- [ ] `tests/core/agents/rewardAdvisorSchema.ts` + `tests/core/agents/rewardAdvisor.test.ts` — same 3-case structure, plus "agent suggests a reason not in the granted rewardEvents -> praise discarded"
- [ ] `tests/core/agents/parentReportGeneratorSchema.ts` + `tests/core/agents/parentReportGenerator.test.ts` — same 3-case structure
- [ ] `tests/core/personalization/confidenceScore.test.ts` — pure formula, table-driven cases
- [ ] `tests/core/personalization/difficultyGuardrails.test.ts` — exhaustive transition matrix (no-op, 1-step-up, 1-step-down, 2-step-jump-blocked both directions, insufficient-signal no-change)
- [ ] `tests/core/progress/evaluateAttempt.test.ts` (EXTEND) — wordStats loop assertions using the real 8-word `eq-1a-ex019` matching fixture, not just 1-word fixtures
- [ ] `tests/core/lessonEngine.test.ts` (EXTEND) — Reward Advisor live-call integration (spy pattern mirrors `answerCheckerSpy`/`theoryTutorSpy`), sequential-call-order assertion for Progress Advisor → Parent Report Generator
- [ ] `tests/e2e/` — one new e2e test exercising a full session ending in the combined end-of-session screen

---

## Manual-Only Verifications

All phase behaviors have automated verification. Live-network smoke checks (real LLM router call for all 3 new agents) are UAT-style, non-gating — deterministic fallback paths (the gating behavior per PERSONAL-03/REWARD-04/REPORT-02) are fully covered by automated tests that simulate agent failure, matching Phase 3's precedent.

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-03 (autonomous run)
