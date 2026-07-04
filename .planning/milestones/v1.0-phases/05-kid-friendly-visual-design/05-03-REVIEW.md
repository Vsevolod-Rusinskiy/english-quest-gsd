---
phase: 05-kid-friendly-visual-design
reviewed: 2026-07-04T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/core/lessonEngine.ts
  - src/ui/exercise-renderers/renderExercise.ts
  - src/ui/exercise-renderers/textInput.ts
  - src/ui/exercise-renderers/singleChoice.ts
  - src/ui/exercise-renderers/matching.ts
  - src/ui/exercise-renderers/orderBuilder.ts
  - src/ui/screens/ExerciseScreen.ts
  - src/main.ts
  - src/style.css
  - tests/core/lessonEngine.test.ts
  - tests/ui/exercise-renderers/singleChoice.test.ts
  - tests/ui/exercise-renderers/orderBuilder.test.ts
  - tests/ui/exercise-renderers/matching.test.ts
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This is a small, well-scoped gap-closure diff that threads `instructionRu`/`instructionEn`
(Section-level bilingual instruction text) from `Lesson.sections[].instructionRu/instructionEn`
through the new `LessonEngine.getCurrentSection()` accessor into `renderExercise()` and all four
exercise renderers (`textInput`, `singleChoice`, `matching`, `orderBuilder`).

Traced `getCurrentSection()` against both the main-pass and review-pass cursor logic in detail:
it correctly reuses `getCurrentExerciseId()` (which already branches main-pass vs. review-pass)
and then does an independent, index-agnostic scan over `this.lesson.sections` keyed purely by
`exerciseId`. Since `this.exercises` (used everywhere else in the engine) is derived once from
`this.lesson.sections` in the constructor and never mutated, and `this.lesson` is `readonly`,
the two can never diverge — section resolution is correct for both passes, including a review
item originating from a section other than the one the main-pass index currently points at.
Verified against `public/Lesson-1A.json` that all 19 `exerciseId`s are globally unique across
sections, so there is no possibility of `getCurrentSection()`'s `.find()` resolving to the wrong
section via an id collision.

All four renderers use `textContent` (never `innerHTML`) for the two new instruction lines, and
all four render RU before EN, matching the `05-UI-SPEC.md` "sequential lines, no visual hierarchy"
requirement and the shared `.instruction-line` CSS rule added in `style.css`. `renderExercise.ts`
and `ExerciseScreen.ts` correctly pass the two new fields straight through without transformation.

The main defect found is a test-coverage gap: `textInput.ts` received the exact same
instruction-line change as the other three renderers, but — unlike `singleChoice.test.ts`,
`matching.test.ts`, and `orderBuilder.test.ts` — there is no `tests/ui/exercise-renderers/textInput.test.ts`
file at all (it has never existed), so the new RU/EN ordering and textContent-only guarantee for
the most-used exercise type in the lesson (9 of 19 exercises are `text-input`) is completely
unverified at the unit level.

## Warnings

### WR-01: `textInput.ts`'s new instruction-line rendering has zero test coverage

**File:** `src/ui/exercise-renderers/textInput.ts:18-26`
**Issue:** The diff adds the identical two `.instruction-line` paragraphs (RU then EN) to
`textInput.ts` as it does to `singleChoice.ts`, `matching.ts`, and `orderBuilder.ts`. The other
three renderers each got a corresponding new test case (`"renders instructionRu then instructionEn
as .instruction-line elements before the prompt paragraph"`) plus an `innerHTML` guard test. No
`tests/ui/exercise-renderers/textInput.test.ts` exists — this renderer has never had a dedicated
test file, so the new behavior ships with no automated verification for the exercise type that
makes up the largest share of the lesson (9/19 exercises, `eq-1a-ex001`–`ex009` and others are
`text-input`). A future regression in ordering, a stray `innerHTML` use, or a missing line would
not be caught by the test suite.
**Fix:** Add `tests/ui/exercise-renderers/textInput.test.ts` mirroring the pattern already used in
`singleChoice.test.ts`/`matching.test.ts`/`orderBuilder.test.ts`:
```typescript
it("renders instructionRu then instructionEn as .instruction-line elements before the prompt paragraph", () => {
  const el = renderTextInput({ exercise, instructionRu, instructionEn, onSubmit: () => {} });
  const children = Array.from(el.children);
  const instructionLines = Array.from(el.querySelectorAll(".instruction-line"));
  const promptIndex = children.findIndex((c) => c.textContent === exercise.prompt);

  expect(instructionLines).toHaveLength(2);
  expect(instructionLines[0].textContent).toBe(instructionRu);
  expect(instructionLines[1].textContent).toBe(instructionEn);
  expect(children.indexOf(instructionLines[0])).toBeLessThan(promptIndex);
  expect(children.indexOf(instructionLines[1])).toBeLessThan(promptIndex);
});

it("uses createElement/textContent only, never innerHTML", () => {
  const source = readFileSync(resolve(process.cwd(), "src/ui/exercise-renderers/textInput.ts"), "utf-8");
  expect(source).not.toMatch(/innerHTML/);
});
```

## Info

### IN-01: Review-pass `getCurrentSection()` test never crosses a section boundary

**File:** `tests/core/lessonEngine.test.ts:670-687`
**Issue:** The new "review pass: ... returns the Section that exercise originally belongs to"
test seeds `reviewQueue: ["eq-1a-ex010", "eq-1a-ex011"]`. Both ids belong to the same
`food-vocabulary` section in `public/Lesson-1A.json`, so this test cannot distinguish
"correctly resolved the exercise's own section" from "happened to return the section the
main-pass index would have suggested anyway." The implementation itself is correct (it is a pure
id-keyed lookup with no dependency on `currentExerciseIndex`), so this is not a functional bug,
but the test's assertion is weaker than its stated intent.
**Fix:** Seed `reviewQueue` with an id from a section other than the one `currentExerciseIndex`
would point to (e.g. `["eq-1a-ex001"]`, a `grammar-present-simple-continuous` exercise, while
`currentExerciseIndex` is past the end of the main sequence) to prove the resolution is genuinely
independent of the main-pass cursor position.

### IN-02: Double `getCurrentExerciseId()` resolution per render (main.ts) is redundant but harmless

**File:** `src/main.ts:153,167`; `src/core/lessonEngine.ts:102-118`
**Issue:** Each `render()` call invokes `engine.getCurrentExercise()` (line 153) and then
`engine.getCurrentSection()` (line 167), each of which independently calls
`getCurrentExerciseId()` internally and re-scans `this.exercises` / `this.lesson.sections`. Both
reads happen synchronously against the same `store.getState()` snapshot with no dispatch in
between, so there is no correctness risk — this is purely a minor duplication of work (out of
scope per the review's performance exclusion, noted here only as a maintainability observation).
**Fix:** Optional: have `getCurrentSection()` accept an already-resolved exercise id as a
parameter (or have the caller resolve the id once and pass it to both), to avoid the repeated
linear scans. Not required before shipping.

---

_Reviewed: 2026-07-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
