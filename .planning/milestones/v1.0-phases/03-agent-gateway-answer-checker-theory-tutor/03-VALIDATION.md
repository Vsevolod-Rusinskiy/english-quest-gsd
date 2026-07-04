---
phase: 3
slug: agent-gateway-answer-checker-theory-tutor
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-02
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x (already configured, `jsdom` environment) |
| **Config file** | `vite.config.ts` (existing, no changes needed) |
| **Quick run command** | `npm run test:core` (`vitest run tests/core`) |
| **Full suite command** | `npm test` (`vitest run`, includes `tests/e2e`) |
| **Estimated runtime** | ~15s (agent calls are mocked in tests — no real network I/O in the test suite) |

---

## Sampling Rate

- **After every task commit:** `npm run test:core`
- **After every plan wave:** `npm test` (full suite — this phase converts `handleAnswer`/`handleTheoryStep` to `async`, touching 5 existing e2e test files)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-0x-xx | 03 | TBD | RELY-01 | T-03-03 | Malformed/wrong-enum agent JSON rejected by Zod before use | unit | `vitest run tests/core/agents/callAgent.test.ts` | ❌ W0 | ⬜ pending |
| 03-0x-xx | 03 | TBD | RELY-02 | T-03-03 | Agent failure (malformed JSON/timeout/network/Zod-invalid) → exactly one retry → fallback, no crash | unit | `vitest run tests/core/agents/callAgent.test.ts -t retry` | ❌ W0 | ⬜ pending |
| 03-0x-xx | 03 | TBD | RELY-03 | — | Every agent-call event records `source` + failure flag | unit | `vitest run tests/core/state/store.test.ts -t source` | ❌ W0 | ⬜ pending |
| 03-0x-xx | 03 | TBD | CHECK-03 | T-03-02 | Ambiguous text-input routes to Answer Checker, returns verdict+errorType; agent input is untrusted user data, not instruction | unit | `vitest run tests/core/agents/answerChecker.test.ts` | ❌ W0 | ⬜ pending |
| 03-0x-xx | 03 | TBD | CHECK-04 | T-03-03 | Answer Checker failure → fallback (`isCorrect:false, errorType:"unknown"`) | unit | `vitest run tests/core/agents/answerChecker.test.ts -t fallback` | ❌ W0 | ⬜ pending |
| 03-0x-xx | 03 | TBD | THEORY-03 | — | Round 1 core-only; rounds 2-3 agent-backed; 3+ soft transition | unit + integration | `vitest run tests/core/lessonEngine.test.ts -t theory` | ❌ W0 (extends existing) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact Task IDs assigned by the planner when PLAN.md is generated.*

---

## Wave 0 Requirements

- [ ] `tests/core/agents/callAgent.test.ts` — new; stubbed/mocked Anthropic client (constructor-injected, not the real SDK — tests run offline/deterministic); covers success-first-try, malformed-JSON-then-success-on-retry, timeout-then-fallback, Zod-invalid-then-fallback
- [ ] `tests/core/agents/answerChecker.test.ts` — new; fixture ambiguous text-input answer + mocked agent responses for success and fallback paths
- [ ] Extend `tests/core/lessonEngine.test.ts` — cover THEORY-03's full round sequencing; existing Phase-1-stub theory tests will need updating since `handleTheoryStep`'s behavior fundamentally changes
- [ ] Async-conversion fallout: `tests/core/lessonEngine.test.ts`, `tests/e2e/reviewQueuePass.test.ts`, `tests/e2e/fullLessonTraversal.test.ts`, `tests/e2e/lessonWalkingSkeleton.test.ts`, `tests/e2e/reviewPassFeedback.test.ts` all call `handleAnswer`/`handleTheoryStep` synchronously today — need `await` + `async` test callbacks once these become `async`. This is refactor work on existing tests that blocks the full suite from passing green, must be scoped into the plan.
- [ ] `npm install @anthropic-ai/sdk@^0.109.0` — new dependency, not yet installed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real live agent call succeeds end-to-end against the actual router | CHECK-03, THEORY-03 | Automated tests mock the Anthropic client by design (deterministic, offline, no cost/quota burn) — a real network call against `api.llmrouter.ru` with a real key is the only way to confirm the live integration actually works, not just the mocked contract | With `.env` populated (`VITE_LLM_BASE_URL`/`VITE_LLM_API_KEY`), run `npm run dev`, answer a text-input exercise with a near-miss (not exact-match) answer, and confirm a real Answer Checker verdict renders. Separately, tap "Не понятно" 2-3 times on the theory screen and confirm a real Theory Tutor explanation renders on rounds 2-3. |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, not bare `vitest`)
- [ ] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
