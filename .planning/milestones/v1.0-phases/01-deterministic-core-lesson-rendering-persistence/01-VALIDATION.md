---
phase: 1
slug: deterministic-core-lesson-rendering-persistence
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-02
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (installed this phase — greenfield, no test framework exists yet) |
| **Config file** | `vite.config.ts` (`test` block) — does not exist yet, created in Wave 0 |
| **Quick run command** | `npx vitest run tests/core` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds (core has zero DOM/network I/O; jsdom UI tests add a few seconds) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core`
- **After every plan wave:** Run `npx vitest run` (full suite including jsdom-based UI render tests)
- **Before `/gsd-verify-work`:** Full suite must be green, plus manual UAT check: manually mutate a saved `localStorage` blob to an old/invalid shape and confirm graceful reset (not a crash) — see PITFALLS.md "Looks Done But Isn't"
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-xx | 01 | 0 | — | — | N/A (scaffolding) | setup | `npm install && npx vitest run` | ❌ W0 | ⬜ pending |
| 01-0x-xx | 01 | TBD | THEORY-01 | — | N/A | unit + jsdom render | `npx vitest run tests/ui/screens/TheoryScreen.test.ts` | ❌ W0 | ⬜ pending |
| 01-0x-xx | 01 | TBD | THEORY-02 | — | N/A | unit | `npx vitest run tests/core/lessonEngine.test.ts -t "theory"` | ❌ W0 | ⬜ pending |
| 01-0x-xx | 01 | TBD | EXERCISE-01 | — | N/A | unit | `npx vitest run tests/core/answer-checking/checkTextInput.test.ts` | ❌ W0 | ⬜ pending |
| 01-0x-xx | 01 | TBD | EXERCISE-02 | — | N/A (hand-authored fixture — no real lesson data, see Open Questions) | unit | `npx vitest run tests/core/answer-checking/checkSingleChoice.test.ts` | ❌ W0 | ⬜ pending |
| 01-0x-xx | 01 | TBD | EXERCISE-03 | — | N/A | unit | `npx vitest run tests/core/answer-checking/checkMatching.test.ts` | ❌ W0 | ⬜ pending |
| 01-0x-xx | 01 | TBD | EXERCISE-04 | — | N/A (hand-authored fixture) | unit | `npx vitest run tests/core/answer-checking/checkOrderBuilder.test.ts` | ❌ W0 | ⬜ pending |
| 01-0x-xx | 01 | TBD | EXERCISE-05 | — | N/A | unit + jsdom render | `npx vitest run tests/ui/components/ProgressIndicator.test.ts` | ❌ W0 | ⬜ pending |
| 01-0x-xx | 01 | TBD | CHECK-01 | T-01-01 | Reject/normalize untrusted `Lesson-1A.json` input (Zod `safeParse`) | unit | `npx vitest run tests/core/answer-checking/normalize.test.ts` | ❌ W0 | ⬜ pending |
| 01-0x-xx | 01 | TBD | CHECK-02 | — | N/A | unit | `npx vitest run tests/core/answer-checking/` | ❌ W0 | ⬜ pending |
| 01-0x-xx | 01 | TBD | PERSIST-01 | T-01-02 | Zod `safeParse` on every `localStorage` read; reset to fresh state on tamper, never crash | unit (mocked `localStorage`) | `npx vitest run tests/core/state/persistence.test.ts` | ❌ W0 | ⬜ pending |
| 01-0x-xx | 01 | TBD | PERSIST-02 | — | N/A | integration (jsdom save→fresh-load cycle) | `npx vitest run tests/core/state/persistence.test.ts -t "reload"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact Task IDs assigned by the planner when PLAN.md is generated — this map defines required coverage, not final IDs.*

---

## Wave 0 Requirements

- [ ] `vite.config.ts` — Vitest `test` block, `environment: "jsdom"`, `globals: true`
- [ ] `tsconfig.json` — base TS config with `"types": ["vitest/globals"]`
- [ ] `tests/core/` and `tests/ui/` directory scaffolding
- [ ] `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"dev": "vite"`, `"build": "vite build"`
- [ ] Hand-authored fixture JSON for `single-choice`/`order-builder` exercises (Lesson-1A.json has none — see Open Questions below) — required before EXERCISE-02/EXERCISE-04 tests can be written
- [ ] Framework install: `npm install -D vitest@^4.1.0 jsdom@^29.1.0` (plus `typescript@^6.0.0`, `vite@^6.4.0` — pin below 8.x per STACK.md — and `zod@^4.4.0`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Graceful reset on tampered/old-shape `localStorage` blob | PERSIST-01 | Requires manually editing devtools storage to a shape the schema wouldn't naturally produce, then observing app behavior — not a pure unit assertion | 1) Play through part of the lesson to create saved state. 2) In browser devtools, edit `localStorage["english-quest-progress-v1"]` to invalid JSON or an old/wrong shape. 3) Reload. 4) Confirm the app resets to a fresh, working state rather than crashing or rendering a broken screen. |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags in CI/automated commands (`vitest run`, not bare `vitest`)
- [ ] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
