---
phase: 01-deterministic-core-lesson-rendering-persistence
fixed_at: 2026-07-02T10:53:10Z
review_path: .planning/phases/01-deterministic-core-lesson-rendering-persistence/01-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-07-02T10:53:10Z
**Source review:** .planning/phases/01-deterministic-core-lesson-rendering-persistence/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (2 critical, 5 warning — `fix_scope: critical_warning`, Info findings excluded)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: `localStorage.setItem` failure in `StateStore.dispatch` is unhandled and silently freezes the app

**Files modified:** `src/core/state/persistence.ts`
**Commit:** 592c0a6
**Applied fix:** Wrapped the `localStorage.setItem` call in `save()` with a try/catch. On failure (quota exceeded, private-browsing mode, blocked storage), logs a `console.warn` and returns normally instead of throwing — `dispatch()` continues to notify listeners and `render()` still runs, so the UI no longer wedges on a storage write failure.

### CR-02: `checkMatching` accepts duplicate-`leftId` payloads that under-specify the answer

**Files modified:** `src/core/answer-checking/checkMatching.ts`
**Commit:** da4176c
**Applied fix:** Added `userPairs.length === actual.size` to the correctness conjunction, rejecting any `userPairs` array whose raw length doesn't match the number of distinct `leftId` keys — closing the duplicate-collapse false-positive gap exactly as suggested in the review.

### WR-01: `handleAnswer` trusts unchecked type assertions for the answer payload

**Files modified:** `src/core/lessonEngine.ts`
**Commit:** 154f0d0
**Applied fix:** Added a runtime shape guard in every branch of the exercise-type switch (`text-input`/`single-choice` require `typeof answer === "string"`; `matching` requires an array of objects with a `leftId` key; `order-builder` requires an array of strings). A mismatched payload now throws a clear `Error` naming the exerciseId and expected shape instead of silently mis-behaving. Verified clean with `tsc --noEmit` (had to add an explicit `as string[]` cast on the order-builder branch after the type guard, since `Array.isArray` alone doesn't fully narrow a `MatchingPair[] | string[]` union — confirmed no runtime behavior change).

### WR-02: Persisted progress has no `lessonId` binding — stale/mismatched saves silently desync from current lesson content

**Files modified:** `src/core/state/progressSchema.ts`, `src/core/state/initialState.ts`, `src/core/state/persistence.ts`, `src/main.ts`
**Commit:** 311595e
**Applied fix:** Added an optional `lessonId: z.string().optional()` field to `ProgressStateSchema` (optional to keep pre-existing stored blobs valid). `initialState()` and `load()` now accept an optional `lessonId`/`currentLessonId` parameter; `load()` resets to `initialState(currentLessonId)` when the stored blob's `lessonId` is defined and doesn't match the currently-loaded lesson's id. `main.ts` now calls `loadProgress(lesson.lessonId)` so the check is live at boot. All existing call sites that invoke `initialState()`/`load()` with zero arguments (in tests) remain valid since the parameter is optional.

### WR-03: Wrong-answer retry discards all in-progress user input on the same exercise

**Files modified:** `src/main.ts`
**Commit:** 8d36c04
**Applied fix:** Implemented review option (b): `onSubmit` no longer calls the full `render()` on an incorrect answer. Since an incorrect answer never dispatches `advance_position`, the exercise DOM subtree built by `renderExerciseScreen` is left untouched (input value, matching pair selections, order-builder sequence all survive); only the feedback banner is swapped in place (`.feedback-banner` removed and re-appended under the same `main` node). `render()` is still called in full on a correct answer, since the position advances and a new exercise (or the lesson-complete screen) needs to be built. Added and ran an ad-hoc verification test confirming the `<input>` DOM node identity and typed value both survive a wrong-answer submit (removed after confirming — not part of the committed change, since it duplicates existing e2e coverage patterns and wasn't part of the review's file list). Full test suite (68 tests) still passes.

### WR-04: `checkOrderBuilder` uses string-join comparison, which can false-positive/false-negative on tokens containing spaces

**Files modified:** `src/core/answer-checking/checkOrderBuilder.ts`
**Commit:** 116e3ef
**Applied fix:** Replaced `sequence.join(" ") === correctOrder.join(" ")` with an element-wise comparison: `sequence.length === correct.length && sequence.every((token, i) => token === correct[i])`, exactly as suggested in the review. Existing `checkOrderBuilder` unit tests still pass.

### WR-05: Two independent copies of the lesson JSON with no single source of truth

**Files modified:** `Lesson-1A.json` (deleted), `tests/core/lessonEngine.test.ts`, `tests/ui/screens/TheoryScreen.test.ts`, `tests/core/answer-checking/checkMatching.test.ts`, `tests/core/answer-checking/checkTextInput.test.ts`, `tests/core/lesson/lessonSchema.test.ts`
**Commits:** 22da990 (test path updates), a4b01bb (root file deletion — follow-up commit after the initial `--files` invocation did not stage the deletion; verified via `git log --all -- Lesson-1A.json` and re-committed explicitly)
**Applied fix:** Kept `public/Lesson-1A.json` as the single source of truth (the one actually served by Vite/fetched at runtime). Updated the five test files that previously read the root-level copy via `resolve(process.cwd(), "Lesson-1A.json")` to instead read `resolve(process.cwd(), "public/Lesson-1A.json")`. Deleted the root-level `Lesson-1A.json` duplicate. Full test suite (68 tests across 15 files) passes against the single remaining copy.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-02T10:53:10Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
