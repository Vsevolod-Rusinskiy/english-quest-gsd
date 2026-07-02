---
status: complete
phase: 01-deterministic-core-lesson-rendering-persistence
source: [01-VERIFICATION.md]
started: 2026-07-02T11:00:00Z
updated: 2026-07-02T14:30:00Z
---

## Current Test

number: 5
name: single-choice and order-builder playable (no real lesson data for these types)
expected: (see below)
awaiting: none — all 5 tests executed by Claude via live preview browser (Vite dev server, real DOM, real localStorage), not jsdom simulation. User has not yet reviewed results.

## Tests

### 1. Full lesson playable in a real browser
expected: Theory screen shows rule + example + both buttons; each exercise shows prompt, input UI, "Задание N из 19"; correct answers show "Верно!"; lesson-complete state appears at exercise 19
result: PASS — theory screen rendered rule/example/both buttons; exercise 1 rendered prompt + input + "Задание 1 из 19"; wrong answer showed "Не совсем. Попробуй ещё раз." with a hint and preserved the typed input; correct answer showed "Верно!" and advanced to exercise 2. Full 19-exercise traversal already covered by `tests/e2e/fullLessonTraversal.test.ts` (re-verified passing); this session additionally confirmed exercises 1-2 manually in a real browser.

### 2. Reload the browser (Cmd/Ctrl+R) mid-lesson
expected: App resumes at the exact same exercise index, not back at theory
result: PASS — after answering exercise 1 and advancing to exercise 2, `location.reload()` in the real browser restored "Задание 2 из 19" exactly, not theory.

### 3. localStorage tamper-reset
expected: Open devtools → Local Storage, confirm key `english-quest-progress-v1` with `{schemaVersion:1,data:{...}}`; edit to invalid JSON, reload — app silently resets to a fresh working lesson, no crash, no stack trace
result: PASS — confirmed real key/shape via `localStorage.getItem`. Set value to `{not valid json`, reloaded — app reset cleanly to the theory screen, no console errors, no crash.

### 4. D-06 fail-loudly on broken lesson data
expected: Temporarily break `public/Lesson-1A.json` (delete `theory` field), reload — clear "Не удалось загрузить урок." message appears, lesson does not render
result: PASS — with `theory` field removed, reload showed "Не удалось загрузить урок." plus a readable Zod message ("Invalid input: expected object, received undefined → at theory") and a recovery instruction. File restored from backup afterward, verified byte-identical to original.

### 5. single-choice and order-builder playable (no real lesson data for these types)
expected: Play a single-choice exercise and an order-builder exercise via a dev harness or temporarily-wired fixture. single-choice: tap exactly one option (accent-marked), submit grades it. order-builder: tap words from "Слова:" into "Твой ответ:" in order, tap back out (no dragging), submit grades the assembled order
result: PASS (with 2 minor non-blocking findings) — temporarily wired `tests/fixtures/single-choice.fixture.json` and `order-builder.fixture.json` into `public/Lesson-1A.json` (backed up, restored afterward, byte-identical). single-choice: tapped "eggs", it accent-highlighted, submit graded correctly, advanced. order-builder: tapped word-bank chips in order (What, are, you, doing, tonight), they moved into "Твой ответ:" in the correct sequence, no drag-and-drop wiring present, submit graded correctly, lesson reached "Урок завершён!".
  - **Minor finding A:** the "Верно!"/feedback banner from the previous exercise is still visible when the next exercise first renders, before the new exercise is submitted (banner isn't cleared on exercise-advance, only on next submit).
  - **Minor finding B:** the progress indicator shows "Задание 3 из 2" at lesson-complete instead of clamping to the total or switching to a completion-only display.
  - Both are cosmetic/interaction-polish issues, not grading or persistence bugs. Neither affects the deterministic-core correctness this phase targets.

## Summary

total: 5
passed: 5
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

### Gap 1: Stale feedback banner not cleared on exercise advance
status: open
severity: minor
description: When advancing from one exercise to the next, the previous exercise's feedback banner ("Верно!" / "Не совсем...") remains visible until the new exercise is submitted.
recommendation: Fix now as a small Phase 1 polish item, or defer to Phase 5 (Kid-Friendly Visual Design) since it's presentation-layer, not logic. Does not block Phase 1 completion — no requirement (THEORY/EXERCISE/CHECK/PERSIST) covers banner-clearing timing.

### Gap 2: Progress indicator overshoots total at lesson completion
status: open
severity: minor
description: At lesson-complete, the progress indicator displays "Задание {N+1} из {N}" (e.g. "3 из 2" in the 2-exercise test lesson) instead of clamping at N or switching to a dedicated completion state.
recommendation: Fix now (small logic fix, arguably in EXERCISE-05 scope) or defer to Phase 5. Does not block Phase 1 completion — the underlying traversal and completion logic (`lesson-complete` state, "Урок завершён!") work correctly; only the numeric display overshoots.
