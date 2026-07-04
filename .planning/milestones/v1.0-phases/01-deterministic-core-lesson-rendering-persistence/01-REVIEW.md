---
phase: 01-deterministic-core-lesson-rendering-persistence
reviewed: 2026-07-02T00:00:00Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - public/Lesson-1A.json
  - src/core/answer-checking/checkMatching.ts
  - src/core/answer-checking/checkOrderBuilder.ts
  - src/core/answer-checking/checkSingleChoice.ts
  - src/core/answer-checking/checkTextInput.ts
  - src/core/answer-checking/normalize.ts
  - src/core/lesson/lessonLoader.ts
  - src/core/lesson/lessonSchema.ts
  - src/core/lessonEngine.ts
  - src/core/state/initialState.ts
  - src/core/state/persistence.ts
  - src/core/state/progressSchema.ts
  - src/core/state/store.ts
  - src/main.ts
  - src/ui/components/FatalError.ts
  - src/ui/components/FeedbackBanner.ts
  - src/ui/components/ProgressIndicator.ts
  - src/ui/exercise-renderers/matching.ts
  - src/ui/exercise-renderers/orderBuilder.ts
  - src/ui/exercise-renderers/renderExercise.ts
  - src/ui/exercise-renderers/singleChoice.ts
  - src/ui/exercise-renderers/textInput.ts
  - src/ui/screens/ExerciseScreen.ts
  - src/ui/screens/TheoryScreen.ts
  - tests/core/answer-checking/checkMatching.test.ts
  - tests/core/answer-checking/checkOrderBuilder.test.ts
  - tests/core/answer-checking/checkSingleChoice.test.ts
  - tests/core/lessonEngine.test.ts
  - tests/e2e/fullLessonTraversal.test.ts
  - tests/fixtures/order-builder.fixture.json
  - tests/fixtures/single-choice.fixture.json
  - tests/ui/exercise-renderers/matching.test.ts
  - tests/ui/exercise-renderers/orderBuilder.test.ts
  - tests/ui/exercise-renderers/singleChoice.test.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

Reviewed the deterministic core (answer checking, lesson schema/loader, state store/persistence), the boot/render orchestration in `main.ts`, and all four exercise renderers plus their tests. The architecture's stated invariants (no `innerHTML`, no fuzzy matching in the core checkers, `save()` called only from `StateStore.dispatch`, exhaustive `switch` over exercise types) all hold up under inspection, and `tsc --noEmit` is clean. However, several correctness and robustness gaps were found:

- `StateStore.dispatch` calls `localStorage.setItem` synchronously with no error handling — any quota-exceeded or private-browsing failure throws mid-dispatch, silently freezing the UI on the next answer submission.
- Persisted progress has no `lessonId` binding, so a stale `localStorage` blob from a different/updated lesson can silently desync `currentExerciseIndex` and `exerciseStats` against the currently loaded lesson content.
- `checkMatching` compares `Map` sizes rather than raw array lengths, letting a `userPairs` array with duplicate `leftId` entries pass with fewer distinct pairs than required.
- On every wrong-answer retry, `main.ts`'s `render()` fully rebuilds the exercise DOM from scratch, discarding whatever partial answer the user had entered (text input is cleared, matching pairs and order-builder sequence reset) even though the same exercise index remains on screen.
- The lesson JSON exists as two independent copies (`Lesson-1A.json` at repo root and `public/Lesson-1A.json`), read by different tests/runtime paths, with nothing to guarantee they stay in sync.
- `npm run lint` is non-functional: ESLint 9 is installed but only a legacy `.eslintrc.cjs` exists (no `eslint.config.js`), so lint has not actually been gating this code.

None of these are exploitable security vulnerabilities (the app is a static, backend-less, single-user localStorage app with no network input beyond a same-origin lesson JSON fetch), but the persistence/error-handling gaps and the matching false-positive are correctness risks that should be fixed before this ships as a reliability-sensitive core.

## Critical Issues

### CR-01: `localStorage.setItem` failure in `StateStore.dispatch` is unhandled and silently freezes the app

**File:** `src/core/state/persistence.ts:42-45` (called from `src/core/state/store.ts:30-36`)
**Issue:** `save()` calls `localStorage.setItem(...)` with no try/catch. `setItem` throws a `DOMException` ("QuotaExceededError") in Safari private browsing mode, when storage quota is exceeded, or when third-party storage is blocked. Because `dispatch()` calls `save(this.state)` *before* notifying listeners, a thrown exception here means:
1. `this.state` has already been mutated in memory (the reducer ran), but
2. the exception propagates up through the `onSubmit` handler in `main.ts` (an event-listener callback), so it becomes an unhandled promise-less synchronous throw that aborts the click handler,
3. `listeners` are never called, so `render()` never runs again — the UI silently stops responding to any further input after the failure, with no `FatalError` screen and no console error surfaced to the user.

This directly violates the project's stated architecture goal ("без единого «сломанного» состояния") since a single storage write failure permanently wedges the session with no recovery path.
**Fix:**
```typescript
export function save(state: ProgressState): void {
  const blob = { schemaVersion: CURRENT_SCHEMA_VERSION, data: state };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(blob));
  } catch (err) {
    console.warn("Failed to persist progress (quota/private mode?)", err);
    // Continue without persistence rather than crashing the dispatch cycle;
    // consider surfacing a non-fatal banner so the user knows progress isn't saved.
  }
}
```

### CR-02: `checkMatching` accepts duplicate-`leftId` payloads that under-specify the answer

**File:** `src/core/answer-checking/checkMatching.ts:11-24`
**Issue:** `toPairMap` builds a `Map` keyed by `leftId`, so duplicate entries collapse to the last value written. The correctness check then compares `expected.size === actual.size` (map sizes, i.e. *distinct* key counts) rather than the raw `userPairs.length`. A `userPairs` array containing duplicate `leftId`s — e.g. `[{leftId:"a",rightId:"wrong"}, {leftId:"a",rightId:"1"}, {leftId:"b",rightId:"2"}]` — collapses to a 2-entry map that exactly matches a 2-pair expected set and is marked **correct**, despite the array itself never specifying a mapping for every left item exactly once. Since `LessonEngine.handleAnswer` receives `answer as MatchingPair[]` via an unchecked type assertion (see WR-01) and performs no shape validation before calling `checkMatching`, this is a real gap in the "no fuzzy matching, exact deterministic check" contract (CHECK-02) — the check is supposed to be a strict pairId set comparison, but it is not actually strict against malformed/duplicate input.
**Fix:**
```typescript
export function checkMatching(exercise: MatchingExercise, userPairs: Pair[]): CheckResult {
  const expected = toPairMap(exercise.answerCheck.pairs);
  const actual = toPairMap(userPairs);

  const isCorrect =
    expected.size === actual.size &&
    userPairs.length === actual.size && // reject duplicate/collapsed leftId entries
    [...expected.entries()].every(([leftId, rightId]) => actual.get(leftId) === rightId);

  return { isCorrect, source: "core" };
}
```

## Warnings

### WR-01: `handleAnswer` trusts unchecked type assertions for the answer payload

**File:** `src/core/lessonEngine.ts:44-55`
**Issue:** Every branch of the exercise-type `switch` casts the caller-supplied `answer: AnswerPayload` with `as string`, `as MatchingPair[]`, or `as string[]` — there is no runtime validation that the payload actually matches the exercise's declared `type` before it is forwarded to the deterministic checker. Today the only caller is `renderExercise.ts`, which does correctly dispatch by `exercise.type`, so the assertions currently hold in practice. But `handleAnswer` is a public method on `LessonEngine` with no defensive guard of its own, so any future caller (or a bug in the dispatch wiring) could silently pass a mismatched shape (e.g. a `string` to `checkMatching`) and get nonsensical `undefined`-based comparisons rather than a clear error.
**Fix:** Add a lightweight runtime shape check per branch (or a small Zod schema per payload type) so a mismatched payload throws a clear `Error` instead of silently mis-behaving:
```typescript
case "matching":
  if (!Array.isArray(answer) || answer.some((p) => typeof p !== "object" || !("leftId" in p))) {
    throw new Error(`handleAnswer: expected MatchingPair[] for exerciseId ${exerciseId}`);
  }
  result = checkMatching(exercise, answer as MatchingPair[]);
  break;
```

### WR-02: Persisted progress has no `lessonId` binding — stale/mismatched saves silently desync from current lesson content

**File:** `src/core/state/persistence.ts:14-40`, `src/core/state/progressSchema.ts:21-29`
**Issue:** `load()` validates `schemaVersion` but nothing ties the saved blob to the specific lesson (`lesson.lessonId`) it was generated against. If `Lesson-1A.json` is edited (exercises reordered/added/removed, `exerciseId`s changed) while a previous `schemaVersion: 1` blob remains in a user's `localStorage`, `currentPosition.currentExerciseIndex` will be silently reinterpreted against the *new* exercise list — pointing at the wrong exercise, or (if the index now exceeds the new list length) prematurely showing "Урок завершён!" for a lesson the child never actually finished. `exerciseStats`, keyed by `exerciseId` strings, would also silently orphan/mismatch. No crash occurs (the `else` branch in `main.ts` handles an out-of-range index gracefully), which makes this a silent-data-integrity bug rather than a visible failure.
**Fix:** Add `lessonId: z.string()` to `ProgressStateSchema`/`StudentProfileSchema` (or a top-level field on the stored blob), and reset to `initialState()` in `load()` when the stored `lessonId` doesn't match the currently-loaded lesson's `lessonId`:
```typescript
if (result.data.data.lessonId !== undefined && result.data.data.lessonId !== currentLessonId) {
  return initialState();
}
```

### WR-03: Wrong-answer retry discards all in-progress user input on the same exercise

**File:** `src/main.ts:56-89`, `src/ui/exercise-renderers/textInput.ts`, `src/ui/exercise-renderers/matching.ts`, `src/ui/exercise-renderers/orderBuilder.ts`
**Issue:** After an incorrect answer, `feedback.atIndex === index` keeps the same exercise on screen (per the comment at `main.ts:80-84`), but `render()` unconditionally calls `renderExerciseScreen({ exercise, ... })` again, which calls the type-specific renderer fresh — creating a brand-new empty `<input>` for text-input, an unpaired matching board, and an empty order-builder sequence/full word bank. The child's partially-correct attempt (e.g., a typed word, 7 of 8 correctly-tapped matching pairs) is wiped every time they get something wrong, forcing them to redo the entire exercise from scratch on every retry. This works against the "hint after first error, retry same exercise" pedagogical flow implied by the `hint.firstError`/`hint.secondError` schema fields.
**Fix:** Either (a) preserve renderer-local state across a failed-submit re-render by keeping the exercise DOM node alive and only mutating the feedback banner region, or (b) have `onSubmit` clear only the feedback banner and re-enable the same DOM elements rather than calling `render()`'s full teardown/rebuild for the incorrect-answer case.

### WR-04: `checkOrderBuilder` uses string-join comparison, which can false-positive/false-negative on tokens containing spaces

**File:** `src/core/answer-checking/checkOrderBuilder.ts:7-13`
**Issue:** `sequence.join(" ") === exercise.answerCheck.correctOrder.join(" ")` compares the *joined string*, not the arrays element-wise. If any token contains an embedded space (or if a token boundary shifts, e.g. `["a b", "c"]` vs `["a", "b c"]`), both sequences join to the identical string `"a b c"` and are treated as equal even though the underlying token arrays differ. Current lesson/fixture data only uses single-word tokens so this is latent, not actively triggered, but it is a real correctness gap in what the code comment calls a "deterministic ordered-token comparison" — the implementation is not actually comparing tokens, it's comparing a lossy string projection of them.
**Fix:** Compare arrays directly instead of via string join:
```typescript
export function checkOrderBuilder(
  exercise: OrderBuilderExercise,
  sequence: string[],
): CheckResult {
  const correct = exercise.answerCheck.correctOrder;
  const isCorrect =
    sequence.length === correct.length && sequence.every((token, i) => token === correct[i]);
  return { isCorrect, source: "core" };
}
```

### WR-05: Two independent copies of the lesson JSON with no single source of truth

**File:** `Lesson-1A.json` (repo root), `public/Lesson-1A.json`
**Issue:** The repo ships a full duplicate of the 383-line lesson data file at the repo root and under `public/`. They are byte-identical today, but nothing enforces that they stay in sync — `src/core/lesson/lessonLoader.ts` fetches `/Lesson-1A.json` at runtime (served from `public/` by Vite), while several tests (`tests/core/lessonEngine.test.ts`, `tests/core/answer-checking/checkMatching.test.ts`) read the root copy directly via `fs.readFileSync(resolve(process.cwd(), "Lesson-1A.json"))`. A future content edit applied to only one copy will make the test suite pass against stale/different exercise data than what the running app actually serves, silently invalidating the tests' guarantees.
**Fix:** Keep a single copy under `public/Lesson-1A.json` and have any test/tooling that needs filesystem access read from that path (`resolve(process.cwd(), "public/Lesson-1A.json")`), removing the root-level duplicate; or add a build/pretest step that copies one into the other so drift is impossible.

## Info

### IN-01: `npm run lint` does not run — ESLint 9 installed without a flat config

**File:** `.eslintrc.cjs`, `package.json`
**Issue:** `package.json` installs `eslint@^9.0.0`, which requires a flat `eslint.config.js`/`.mjs`/`.cjs` by default. Only the legacy `.eslintrc.cjs` exists in the repo. Running `npm run lint` fails immediately with "ESLint couldn't find an eslint.config.(js|mjs|cjs) file" — meaning none of the reviewed source has actually been passing (or even running) automated lint checks.
**Fix:** Add a flat `eslint.config.js` (e.g. via `typescript-eslint`'s `tseslint.config(...)` helper) and remove `.eslintrc.cjs`, or pin `eslint` to `^8.x` if flat-config migration is deferred.

### IN-02: `MatchingExercise` schema does not enforce `leftItems.length === rightOptions.length`

**File:** `src/core/lesson/lessonSchema.ts:60-66`, `src/ui/exercise-renderers/matching.ts:54`
**Issue:** The renderer computes `totalPairsNeeded = Math.min(exercise.leftItems.length, exercise.rightOptions.length)`, implicitly acknowledging the two arrays could have different lengths, but the schema places no constraint on this. If a future lesson-content edit introduces a mismatch, the extra items on the longer side become permanently unpaired/dead UI elements with no way for the user to complete them (though `totalPairsNeeded` prevents the submit button from requiring the impossible extra pairs). This is defensive code compensating for a data-shape gap rather than validating it at load time.
**Fix:** Add a Zod `.refine()` on `MatchingExerciseSchema` asserting `leftItems.length === rightOptions.length`, so a malformed lesson fails loudly at `loadLesson` (consistent with the D-06 fail-loudly principle already used elsewhere) instead of degrading silently in the renderer.

### IN-03: `Theory.maxSimplifyRounds` is defined and validated but never read by any Phase 1 code

**File:** `src/core/lesson/lessonSchema.ts:105-112`, `src/core/lessonEngine.ts`
**Issue:** `TheorySchema` requires and type-checks `maxSimplifyRounds: z.number()`, and `Lesson-1A.json` supplies `3`, but no code in the reviewed Phase 1 slice reads this field (there is no Theory Tutor branch yet, per the comment in `lessonEngine.ts:28-29`). This is consistent with the documented "Phase 1 has no Theory Tutor branch" scope note, so it's not a bug, but it is currently dead/unused data flowing through validated types with no consumer — worth a comment noting it's intentionally reserved for a later phase so a future reader doesn't assume it's wired up.
**Fix:** No functional change needed; optionally add a one-line comment near `TheorySchema.maxSimplifyRounds` cross-referencing the future phase that will consume it (as is already done for the Theory Tutor branch in `lessonEngine.ts`).

---

_Reviewed: 2026-07-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
