---
phase: 2
slug: progress-tracking-review-queue-reward-engine
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-02
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x (already installed and configured — Phase 1 scaffold) |
| **Config file** | `vite.config.ts` (`test` block, no separate `vitest.config.ts`) |
| **Quick run command** | `npm run test:core` (`vitest run tests/core` — Phase 2 logic is 100% pure functions under `tests/core/`, no jsdom needed) |
| **Full suite command** | `npm test` (`vitest run`, 68 tests / 15 files as of Phase 1 completion) |
| **Estimated runtime** | ~10 seconds (no new DOM/network I/O introduced) |

---

## Sampling Rate

- **After every task commit:** `npm run test:core`
- **After every plan wave:** `npm test` (full suite — catches any regression in Phase 1's `handleAnswer` integration)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-xx | 02 | TBD | PROGRESS-01 | — | N/A | unit | `npx vitest run tests/core/state/ -t "exercise_attempt"` | ❌ W0 | ⬜ pending |
| 02-0x-xx | 02 | TBD | PROGRESS-02 | — | N/A | unit | `npx vitest run tests/core/progress/topicStatusMachine.test.ts` | ❌ W0 | ⬜ pending |
| 02-0x-xx | 02 | TBD | PROGRESS-03 | — | N/A | unit | `npx vitest run tests/core/progress/reviewQueue.test.ts` | ❌ W0 | ⬜ pending |
| 02-0x-xx | 02 | TBD | PROGRESS-04 | — | N/A | unit + e2e | `npx vitest run tests/e2e/reviewQueuePass.test.ts` | ❌ W0 | ⬜ pending |
| 02-0x-xx | 02 | TBD | REWARD-01 | T-02-01 | Dedup (exerciseId,reason) prevents farming; malformed persisted state rejected via Zod, not silently accepted | unit | `npx vitest run tests/core/rewards/rewardEngine.test.ts` | ❌ W0 | ⬜ pending |
| 02-0x-xx | 02 | TBD | REWARD-02 | — | N/A | unit | `npx vitest run tests/core/state/progressSchema.test.ts -t "RewardEventSchema"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact Task IDs assigned by the planner when PLAN.md is generated.*

---

## Wave 0 Requirements

- [ ] `tests/core/progress/topicStatusMachine.test.ts` — table-driven test covering all 4 D-06 FSM transitions + "3 correct-in-a-row from any status" rule + multi-topic-loop case (Pitfall 2)
- [ ] `tests/core/rewards/rewardEngine.test.ts` — dedup (D-03), session-global streak firing at 5/10/15 (D-04), `weak_topic_closed` firing once off the FSM transition (D-05), mutual exclusion of `first_try_correct`/`correct_after_hint`
- [ ] `tests/core/progress/reviewQueue.test.ts` — population scan (D-02: multi-exercise-per-topic, dedup, exclusion of already-correct exercises) and consumption (dequeue on completion regardless of correctness)
- [ ] Extend/create `tests/core/state/progressSchema.test.ts` — `TopicStatSchema`/`RewardEventSchema` validate; a Phase-1-shaped legacy blob missing the new fields correctly resets via `load()` (Pitfall 1)
- [ ] Extend `tests/core/lessonEngine.test.ts` — `handleAnswer` computes the full per-answer update as one function and dispatches once, not multiple times (Pitfall 3 guard)
- [ ] No new framework install — Vitest is fully set up from Phase 1

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* This phase is logic-only (no UI, no agent), so no browser-only or human-judgment checks apply — unlike Phase 1, there's no visual/interaction surface requiring live-browser UAT.

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, not bare `vitest`)
- [ ] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
