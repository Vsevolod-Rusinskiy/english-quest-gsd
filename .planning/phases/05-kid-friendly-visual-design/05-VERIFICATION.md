---
phase: 05-kid-friendly-visual-design
verified: 2026-07-03T23:35:00Z
status: gaps_found
score: 3/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "The lesson screen shows a top bar (lesson name, ruble balance, progress) at all times, plus a lesson title and a task card with RU+EN instructions for every exercise"
    status: failed
    reason: >
      The top bar / lesson title / ruble balance / progress portions of this Success
      Criterion are fully implemented and verified. However the "task card with RU+EN
      instructions for every exercise" clause is not implemented: no exercise renderer,
      ExerciseScreen.ts, or main.ts ever reads or displays the lesson JSON's
      `instructionRu`/`instructionEn` fields. Every task card (text-input, single-choice,
      matching, order-builder) renders only `exercise.prompt`, which is an English-only
      string (e.g. "He ___ at home today. (work)"). `instructionRu`/`instructionEn` exist
      at the Section level in the Zod schema (lessonSchema.ts lines 92-93) and are present
      as real, populated data in public/Lesson-1A.json (e.g. section
      "grammar-present-simple-continuous": instructionRu "Поставь глагол в скобках..."),
      but `grep -rn "instructionRu|instructionEn" src/` returns zero renderer/main.ts hits
      — the field is validated and loaded, never rendered. This is REQUIREMENTS.md UI-02's
      own wording ("карточку задания с инструкцией RU+EN") and ROADMAP Phase 5 Success
      Criterion 2's explicit clause, both currently marked complete despite this gap. The
      gap predates Phase 5 (introduced in Phase 1, also specified in 01-UI-SPEC.md line 130
      as a Phase-1 structural requirement and never implemented then either), but Phase 5 is
      the terminal phase of the v1.0 milestone and its own ROADMAP success criteria include
      this clause verbatim — no later phase exists to defer it to.
    artifacts:
      - path: "src/ui/exercise-renderers/textInput.ts"
        issue: "Renders only exercise.prompt (EN-only); no instructionRu/instructionEn line"
      - path: "src/ui/exercise-renderers/singleChoice.ts"
        issue: "Renders only exercise.prompt (EN-only); no instructionRu/instructionEn line"
      - path: "src/ui/exercise-renderers/matching.ts"
        issue: "Renders only exercise.prompt (EN-only); no instructionRu/instructionEn line"
      - path: "src/ui/exercise-renderers/orderBuilder.ts"
        issue: "Renders only exercise.prompt (EN-only); no instructionRu/instructionEn line"
      - path: "src/ui/screens/ExerciseScreen.ts"
        issue: "Thin dispatcher to renderExercise(); does not read section.instructionRu/instructionEn either"
    missing:
      - "Thread the current section's instructionRu/instructionEn (from lesson.sections[].instructionRu/instructionEn, matched to the exercise's section) into each of the 4 exercise renderers or a shared task-card wrapper, rendered as two sequential Body-size lines above the prompt, per 01-UI-SPEC.md line 130 and 05-UI-SPEC.md's own 'Bilingual text note' (which incorrectly asserts this is already 'unchanged from Phase 1' / working)"
---

# Phase 5: Kid-Friendly Visual Design Verification Report

**Phase Goal:** The lesson experience looks and feels like a bright, blocky, Roblox-inspired kids' app across theory, exercises, rewards, and the parent report
**Verified:** 2026-07-03T23:35:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Truths below are the 4 ROADMAP Phase 5 Success Criteria (the authoritative must-haves per Step 2a), cross-checked against PLAN frontmatter must_haves from both 05-01-PLAN.md and 05-02-PLAN.md, and against the FINAL post-review-fix codebase state (commit `c7e5295` / `5a52452`, working tree clean).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every screen in the lesson (theory, all 4 exercise types, review, reward, parent report) uses a consistent childish, blocky, brightly colored visual style with large rounded buttons, with no Roblox branding/logos/assets | VERIFIED | `src/style.css` tokens match 05-UI-SPEC.md exactly (bg `#fff8e7`, accent `#2e7df7`/`#1e5fc7`, error `#e8544a`, success `#3dbb5e`, highlight `#ffc93c`, 14px radius everywhere, 3px darker-shade borders). All 4 exercise renderers (`textInput.ts`, `singleChoice.ts`, `matching.ts`, `orderBuilder.ts`) use `.option`/`.match-left`/`.match-right`/`.bank-chip`/`.sequence-chip`, all styled in style.css lines 212-223. `TheoryScreen.ts` buttons carry `.theory-toggle`. `SessionEndScreen.ts`'s `.child-section`/`.parent-section` are styled (style.css lines 344-374) — this was a genuine gap found and fixed during Task 3's human-verify checkpoint (commit `2683083`), now present. No Roblox brand red (`#E2231A`) or logo/asset references found anywhere in style.css or src/. |
| 2 | The lesson screen shows a top bar (lesson name, ruble balance, progress) at all times, plus a lesson title and a task card with RU+EN instructions for every exercise | FAILED | Top bar / lesson title / ruble balance / progress are all verified (main.ts lines 61-106, `.ruble-balance` chip live-reads `state.currentRewards`, `renderProgressIndicatorComplete` fixes overshoot). BUT: no exercise renderer or `ExerciseScreen.ts` renders `instructionRu`/`instructionEn` — every task card shows only `exercise.prompt` (English-only). `instructionRu`/`instructionEn` are real, populated Section-level fields in `Lesson-1A.json`/lessonSchema.ts, never consumed by any renderer. See gap in frontmatter. |
| 3 | Waiting states for any agent call (Answer Checker, Theory Tutor, Progress Advisor, Reward Advisor, Parent Report Generator) show a calm, on-brand "thinking" indicator rather than a blank screen or generic spinner | VERIFIED | `renderThinkingIndicator()` (`ThinkingIndicator.ts`) is a single shared component, wired at 3 call sites in `main.ts` (theory buttons line 128, exercise submit line 176, "Показать итоги" line 355) — these 3 call sites cover all 5 agents: Answer Checker + Progress Advisor + Reward Advisor all resolve inside `engine.handleAnswer()`/`engine.handleSessionEnd()`, Theory Tutor inside `engine.handleTheoryStep()`, Parent Report Generator inside `handleSessionEnd()`. `role="status"`/`aria-live="polite"`, text "Секунду, думаю…" per copy contract. `prefers-reduced-motion` fallback present (style.css lines 311-316). Confirmed via `tests/main.test.ts` (Test D) and live browser walkthrough (05-02-SUMMARY.md Task 3). |
| 4 | Wrong answers are presented with a non-punitive, encouraging tone consistent with the rest of the visual style | VERIFIED | Copy unchanged ("Не совсем. Попробуй ещё раз.") — calm per UI-SPEC. Visual treatment: `gentle-shake` keyframe (translateX -4px/4px/-2px/0, 300ms, single pass, no `infinite`) rather than a harsh/punitive animation; `.feedback-banner.incorrect` uses a soft 3px border only, never a full-bleed red fill (style.css lines 250-254). Text contrast fixed to WCAG AA (`--color-error-dark #c23b32`, numerically verified 5.00:1 against `--color-bg`, exceeds the 4.5:1 threshold) — CR-01 fix confirmed present in the final committed state, not just claimed. |

**Score:** 3/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ui/components/ThinkingIndicator.ts` | `renderThinkingIndicator()`, shared, zero innerHTML | VERIFIED | Exists, substantive, wired at 3 call sites in main.ts, `grep -c innerHTML` = 0 |
| `src/ui/components/RewardToast.ts` | `renderRewardToast(amount)`, pure render fn | VERIFIED | Exists, substantive, wired via before/after `currentRewards` diff in main.ts submit handler, `grep -c innerHTML` = 0 |
| `src/ui/components/ProgressIndicator.ts` | `renderProgressIndicatorComplete(total)` added | VERIFIED | Exists, textContent exactly `Задание ${total} из ${total}`, wired at main.ts top-bar block gated on `engine.getCurrentExercise() === null` |
| `src/style.css` | Bright/blocky token values matching 05-UI-SPEC.md | VERIFIED | All colors/typography/spacing/shape values match spec table exactly; `font-weight: 600` fully retired (`grep -n "font-weight: 600" src/style.css` → 0 matches) |
| `src/ui/screens/SessionEndScreen.ts` + CSS | Hero-spaced, styled child/parent sections | VERIFIED | `.child-section`/`.parent-section` real CSS treatment present (found missing, then fixed during Task 3 checkpoint, commit `2683083`) |
| `src/ui/components/FeedbackBanner.ts` | Renders agent-proposed `praiseRu` when present | VERIFIED | Optional 3rd param `praiseRu`, rendered as `.praise-text` only in correct-answer banner; end-to-end test added in `tests/main.test.ts` per WR-02 fix |
| Task-card RU+EN instruction rendering | Every exercise's task card shows `instructionRu`/`instructionEn` per REQUIREMENTS UI-02 | **MISSING** | No renderer/screen file reads these fields; `grep -rn "instructionRu\|instructionEn" src/` returns only the schema definition and a test fixture, zero rendering call sites |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `main.ts` render() top-bar | `state.currentRewards` | Direct field read, same field SessionEndScreen reads | WIRED | Confirmed lines 71-74 |
| `main.ts` onSubmit handler | reward-toast trigger | before/after `currentRewards` diff around `handleAnswer()` await | WIRED | Confirmed lines 186, 202-207 |
| `main.ts` top-bar completion check | `engine.getCurrentExercise()` | Single completion signal, reused (not a second ad-hoc check) | WIRED | Confirmed lines 93-103, matches main-content block's own check at line 153 |
| All 4 exercise renderers / TheoryScreen | Shared CSS tokens in `style.css` | className-based (`.option`, `.match-left`, `.match-right`, `.bank-chip`, `.sequence-chip`, `.theory-toggle`) | WIRED | Confirmed — no renderer redefines its own color/shape values |
| `lessonEngine.ts` praiseRu gate | `FeedbackBanner.ts` `.praise-text` | `result.praiseRu` threaded through `main.ts`'s 4 call sites | WIRED | Confirmed lines 221, 264, 288, 309, 324 — was a real gap, fixed in commit `2683083` |
| Lesson JSON `instructionRu`/`instructionEn` (Section level) | Any exercise renderer / task card | none | **NOT_WIRED** | Zero consumption anywhere in `src/` outside the schema definition |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `npm test` | 244/244 passing | PASS |
| TypeScript compiles clean | `npx tsc --noEmit -p .` | zero errors | PASS |
| WCAG AA contrast (success text) | luminance-formula calc, `#238038` on `#fff8e7` | 4.70:1 (≥4.5:1) | PASS |
| WCAG AA contrast (error text) | luminance-formula calc, `#c23b32` on `#fff8e7` | 5.00:1 (≥4.5:1) | PASS |
| WCAG AA contrast (accent button text) | luminance-formula calc, white on `#1e5fc7` | 5.97:1 (≥4.5:1) | PASS |
| No debt markers in Phase 5 touched files | `grep -n "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all Phase 5 files | zero matches | PASS |
| No innerHTML in new components | `grep -c innerHTML ThinkingIndicator.ts RewardToast.ts` | 0, 0 | PASS |
| `instructionRu`/`instructionEn` rendered anywhere | `grep -rn "instructionRu\|instructionEn" src/` | zero renderer hits (schema only) | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UI-01 | 05-01-PLAN.md, 05-02-PLAN.md | Childish/blocky/bright style, no Roblox branding | SATISFIED | Truth 1 verified above |
| UI-02 | 05-01-PLAN.md, 05-02-PLAN.md | Top bar (name/rubles/progress) + lesson title + task card with RU+EN instructions | **PARTIALLY BLOCKED** | Top bar/title/rubles/progress satisfied; RU+EN instruction clause not implemented (see gap) |

No orphaned requirements — both IDs declared across the two plans match REQUIREMENTS.md's Phase 5 mapping exactly.

### Anti-Patterns Found

None in Phase 5-authored code. `.lesson-title-block` (style.css lines 100-102) is unused dead CSS but pre-dates this phase (confirmed via `git log -S`, introduced Phase 1) and was already flagged as non-urgent info-level in `05-REVIEW.md` (IN-01) — carried forward, not a new issue.

### Human Verification Required

None outstanding. The phase's own mandatory `checkpoint:human-verify` (05-02-PLAN.md Task 3) was already executed this session (live browser walkthrough), found 2 real gaps, and fixed both in-flight (commit `2683083`) — that verification is not re-litigated here. The code-review cycle (05-REVIEW.md → 05-REVIEW-FIX.md, commit `c7e5295`) closed all 4 in-scope findings (1 critical WCAG regression, 3 warnings), numerically re-verified above.

### Gaps Summary

Phase 5 delivers a real, substantive, well-tested bright/blocky visual identity across every screen — colors, shapes, motion, and the two new shared components (ThinkingIndicator, RewardToast) are genuinely wired, not stubs. The code-review cycle caught and fixed a real WCAG AA accessibility regression before this verification, and the mandatory human-verify checkpoint caught and fixed two genuine functional/visual gaps (praiseRu never rendered, SessionEndScreen unstyled) during its own execution. Both are confirmed present in the final committed, clean-tree state — not just claimed in prose.

However, one clause of ROADMAP Phase 5's own Success Criterion 2 — "a task card with RU+EN instructions for every exercise" — is not implemented anywhere in the codebase. `instructionRu`/`instructionEn` are real, schema-validated, populated fields in `Lesson-1A.json` at the Section level, but no exercise renderer, `ExerciseScreen.ts`, or `main.ts` ever reads or displays them; every task card shows only the English-only `exercise.prompt`. This gap originated in Phase 1 (whose own `01-UI-SPEC.md` line 130 specified this exact structural requirement, never implemented, and never caught by Phase 1's verification either) and Phase 5's own `05-UI-SPEC.md` incorrectly asserts in its "Bilingual text note" that this is "unchanged from Phase 1" and already rendering correctly — an unverified inherited assumption that this goal-backward check falsifies against the actual code. Since Phase 5 is the terminal phase of the v1.0 milestone, there is no later phase to defer this to, and REQUIREMENTS.md UI-02 (marked `[x]` complete) explicitly includes this clause in its own wording.

This is a scoped, mechanical gap (thread two existing string fields into 5 render call sites) — not an architectural problem — but it is a real, user-visible functional gap against this phase's own success criteria and should not be waved through as "cosmetic."

---

_Verified: 2026-07-03T23:35:00Z_
_Verifier: Claude (gsd-verifier)_
