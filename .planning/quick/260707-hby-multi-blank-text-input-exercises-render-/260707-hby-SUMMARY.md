---
phase: quick-260707-hby
plan: 01
subsystem: ui
tags: [text-input, multi-blank, exercise-renderer, answer-checking, wcag, i18n-hint]
provides:
  - One inline input per blank for multi-blank text-input exercises (fixes false rejection of correct blank-only answers)
  - Reconstruction of the single answer string from per-blank values (blank[0] + interior segments + blank[i]) fed to the unchanged onSubmit/checkTextInput contract
  - Gray muted Russian instruction line (hint style) across all 4 exercise renderers
affects: [exercise-rendering, answer-correctness, lesson-content-ex004]
tech-stack:
  patterns: ["Presentational per-blank rendering + core-side reconstruction — the deterministic answer-check contract (checkTextInput/normalize/onSubmit) is untouched; only how the raw string is assembled changed"]
key-files:
  created:
    - tests/helpers/multiBlankAnswers.ts
  modified:
    - src/ui/exercise-renderers/textInput.ts
    - src/ui/exercise-renderers/singleChoice.ts
    - src/ui/exercise-renderers/matching.ts
    - src/ui/exercise-renderers/orderBuilder.ts
    - src/style.css
    - public/Lesson-1A.json
    - tests/ui/exercise-renderers/textInput.test.ts
    - tests/e2e/reviewPassFeedback.test.ts
    - tests/e2e/fullLessonTraversal.test.ts
    - tests/main.test.ts
key-decisions:
  - "Split prompt on the literal '___' token; blankCount<=1 keeps the original single-input-below-prompt path byte-for-byte (15/18 exercises), blankCount>=2 renders inline inputs per blank"
  - "Reconstruction joins blank values with the INTERIOR printed segments only (parts[1..blankCount-1]); ex002/ex003 already matched their acceptedAnswers, ex004 needed 'are you doing' added to its acceptedAnswers (lesson DATA, not a schema change)"
  - "RU instruction line styled via a shared .instruction-ru class (14px, --color-muted #6b6b6b = 5.03:1 on the cream bg, passes WCAG AA); English line stays the primary black task line"
  - "Multi-blank inputs render inline (display:inline-block, width:auto) so the sentence reads on one line, per user preference over full-width stacked boxes"
requirements-completed: [SMOKE-FIX-MULTIBLANK, SMOKE-FIX-RU-HINT]
duration: ~35min (incl. executor interruption recovery)
completed: 2026-07-07
status: complete
---

# Quick Task 260707-hby: Multi-blank inline inputs + gray RU instruction hint

**Render one inline input per blank in multi-blank text-input exercises (fixing a live-found false rejection of correct blank-only answers), reconstruct the answer for the unchanged deterministic checker, and style the Russian instruction line as a muted gray hint across all 4 renderers.**

## The bug this fixes
Exercises with 2+ "___" blanks (ex002/ex003/ex004) rendered as ONE input box, but the expected answer string bundled in words already printed between the blanks (e.g. "usually"). A child filling only the blanks ("don't have" for "They ___ usually ___ a big meal") got FALSELY REJECTED — the answer didn't match "don't usually have". Live-observed, with a confusing agent hint ("add usually between don't and have" — already printed on screen).

## What was done
- **textInput.ts:** split prompt on "___"; single-blank keeps the original layout, multi-blank renders inline inputs interleaved with the printed segments; submit reconstructs `blank[0] + parts[1] + blank[1] + ...` (interior segments only) into the single string passed to the unchanged `onSubmit`. Submit disabled until all blanks filled; first blank focused.
- **Data:** added "are you doing" to `eq-1a-ex004`'s acceptedAnswers (its reconstruction; ex002/ex003 already matched). No schema change.
- **Styling:** `--color-muted: #6b6b6b` token + `.instruction-ru` (14px gray) class on the RU line in all 4 renderers; `.inline-blank` inline-block rule so multi-blank inputs flow within the sentence.
- **Tests:** new textInput unit tests (each 2-blank exercise reconstructs to a checkTextInput-accepted answer from blank-only input; interior words visible; submit gating; single-blank unchanged). New shared `tests/helpers/multiBlankAnswers.ts` per-blank fill helper; rewired the 3 DOM-driven e2e/main tests (reviewPassFeedback, fullLessonTraversal, main) to fill one input per blank.

## Executor-interruption recovery
The gsd-executor died mid-run ("API Error: Connection closed") after committing only Task 1 (d8817d6, the multi-blank rendering). The orchestrator verified state via git log/status, then completed Task 2 (data + RU-hint styling), Task 3 (tests), fixed the 4 e2e/main tests that broke on the single-input→per-blank change, and added the inline-CSS refinement — committed as 16d9993, 2941fcf, 43c64cb.

## Verification
- 270/270 tests pass; `npx tsc --noEmit` clean; `public/Lesson-1A.json` schema shape unchanged (only ex004 acceptedAnswers extended).
- **Live browser walkthrough:** all 3 two-blank exercises now accept the blank-only answers (Do/get up, don't/have, are/doing) with first-try correctness and advance; RU instruction confirmed gray (rgb(107,107,107)) at 14px; two inputs confirmed inline on one row (getBoundingClientRect same top).

## Commits
- `d8817d6` fix — multi-blank inline rendering (Task 1, by executor before interruption)
- `16d9993` feat — ex004 accepted answer + gray RU hint (Task 2)
- `2941fcf` test — multi-blank tests + e2e per-blank fill helpers (Task 3)
- `43c64cb` style — inline .inline-blank layout (user-requested refinement)

## Self-Check: PASSED
All modified/created files present; 270/270 tests green; live-verified in browser.
