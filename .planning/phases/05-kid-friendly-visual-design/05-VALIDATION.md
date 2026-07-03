---
phase: 5
slug: kid-friendly-visual-design
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-03
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x, `jsdom` environment |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- tests/ui` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/ui`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-* | 01 | 1 | UI-01/UI-02 | Shared thinking-indicator + ruble balance + 2 UAT bug fixes in main.ts | unit | `vitest run tests/main.test.ts tests/ui/components/ThinkingIndicator.test.ts tests/ui/components/ProgressIndicator.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-* | 02 | 2 | UI-01 | Per-screen/renderer visual re-skin applies new CSS tokens | unit + e2e | `vitest run tests/ui` + `npm test` (full, incl. e2e) | ✅ (existing tests extended) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/main.test.ts` — new file; `main.ts`'s `render()` branching logic has zero direct unit-test coverage today (only indirect e2e coverage) — required for the 2 D-12 bug-fix regression tests
- [ ] `tests/ui/components/ThinkingIndicator.test.ts` — new file for the shared thinking-indicator component (textContent, className)
- [ ] Extend `tests/ui/components/ProgressIndicator.test.ts` — add a completion-state case (no "N+1 из N" overshoot)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Overall visual "bright, blocky, kid-friendly" feel and absence of anything resembling Roblox branding | UI-01 | Subjective visual/aesthetic judgment — not a DOM assertion | Run `npm run dev`, walk through theory → all 4 exercise types → session-end screen; confirm colors/shapes/motion match 05-UI-SPEC.md and no Roblox-like asset/logo appears |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-03 (autonomous run)
