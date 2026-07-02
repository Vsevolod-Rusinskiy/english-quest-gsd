# Phase 2: Progress Tracking, Review Queue & Reward Engine - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 9 (new + modified)
**Analogs found:** 9 / 9 (all have a strong same-codebase analog — Phase 1 is now real, tested code, not greenfield)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/core/state/progressSchema.ts` (MODIFY) | model (Zod schema) | transform | itself (Phase 1 version) | exact — extend in place |
| `src/core/state/initialState.ts` (MODIFY) | model/factory | transform | itself (Phase 1 version) | exact — extend in place |
| `src/core/state/store.ts` (MODIFY) | store/reducer | event-driven | itself (Phase 1 version) | exact — extend `Action` union + `reduce()` |
| `src/core/progress/topicStatusMachine.ts` (NEW) | service (pure FSM function) | transform | `src/core/answer-checking/checkSingleChoice.ts` | role-match (pure deterministic function, no I/O, single default export pattern) |
| `src/core/rewards/rewardEngine.ts` (NEW) | service (pure rule engine) | transform | `src/core/answer-checking/checkTextInput.ts` (+ `normalize.ts` for composed pure helpers) | role-match (pure deterministic function composing sub-checks, `CheckResult`-style return shape) |
| `src/core/progress/reviewQueue.ts` (NEW, if split out) | service (pure query/scan function) | transform | `src/core/lesson/lessonLoader.ts` (array scan/filter over lesson exercises) | role-match (filters `Exercise[]` by field, same data shape it reads) |
| `src/core/lessonEngine.ts` (MODIFY) | controller/orchestrator | event-driven, request-response | itself (Phase 1 version) | exact — extend `handleAnswer()` |
| `tests/core/progress/topicStatusMachine.test.ts` (NEW) | test | transform | `tests/core/answer-checking/checkSingleChoice.test.ts` | exact — table-driven pure-function unit test pattern |
| `tests/core/rewards/rewardEngine.test.ts` (NEW) | test | transform | `tests/core/answer-checking/checkSingleChoice.test.ts` + `tests/core/state/persistence.test.ts` (for dedup/ledger-style assertions) | role-match |
| `tests/core/progress/reviewQueue.test.ts` (NEW) | test | transform | `tests/core/answer-checking/checkSingleChoice.test.ts` | role-match |
| `tests/core/state/progressSchema.test.ts` (NEW/EXTEND — none currently exists) | test | transform | `tests/core/state/persistence.test.ts` (schema-shape/reset-on-mismatch assertions) | role-match |
| `tests/core/lessonEngine.test.ts` (EXTEND) | test | event-driven | itself (Phase 1 version, already read in full for `handleAnswer` coverage) | exact |

## Pattern Assignments

### `src/core/state/progressSchema.ts` (MODIFY — model)

**Analog:** itself, current Phase 1 version (read in full above)

**Current shape to extend** (lines 1-41):
```typescript
import * as z from "zod";

export const StudentProfileSchema = z.object({
  studentId: z.literal("primary"),
});

export const ExerciseStatSchema = z.object({
  attempts: z.number(),
  correct: z.number(),
});

export const CurrentPositionSchema = z.object({
  theoryUnderstood: z.boolean(),
  currentExerciseIndex: z.number(),
});

export const ProgressStateSchema = z.object({
  studentProfile: StudentProfileSchema,
  lessonId: z.string().optional(),
  lessonHistory: z.array(z.unknown()),
  exerciseStats: z.record(z.string(), ExerciseStatSchema),
  currentPosition: CurrentPositionSchema,
  currentRewards: z.number(),
  rewardHistory: z.array(z.unknown()),   // <-- REPLACE with z.array(RewardEventSchema)
  reviewQueue: z.array(z.unknown()),     // <-- REPLACE with z.array(z.string())
});
```

**Pattern to follow when adding new schemas:** exactly the `ExerciseStatSchema`/`CurrentPositionSchema` convention — one `z.object({...})` const per shape, named `XxxSchema`, immediately followed by `export type Xxx = z.infer<typeof XxxSchema>;` at the bottom in a single grouped export block (see lines 38-41). Add `TopicStatusSchema` (z.enum), `TopicStatSchema`, `RewardReasonSchema` (z.enum), `RewardEventSchema` in the same style, then splice `topicStats: z.record(z.string(), TopicStatSchema)` and `currentCorrectStreak: z.number()` into `ProgressStateSchema` alongside the existing fields — do not create a second top-level schema object.

**Comment convention:** the top-of-file comment (lines 1-4) documents which requirement IDs a field maps to and what's deliberately deferred. Update/replace this comment to reflect Phase 2 closing out PROGRESS-01..04/REWARD-01/02, following the same one-paragraph style.

---

### `src/core/state/initialState.ts` (MODIFY — factory)

**Analog:** itself, current Phase 1 version (read in full above)

**Full current file** (15 lines) — extend the returned object literal with `topicStats: {}` and `currentCorrectStreak: 0`, keeping every existing field/order:
```typescript
import type { ProgressState } from "./progressSchema";

export function initialState(lessonId?: string): ProgressState {
  return {
    studentProfile: { studentId: "primary" },
    lessonId,
    lessonHistory: [],
    exerciseStats: {},
    currentPosition: { theoryUnderstood: false, currentExerciseIndex: 0 },
    currentRewards: 0,
    rewardHistory: [],
    reviewQueue: [],
    // ADD: topicStats: {},
    // ADD: currentCorrectStreak: 0,
  };
}
```
No branching, no validation here — `initialState()` is a pure literal factory; keep it that way.

---

### `src/core/state/store.ts` (MODIFY — reducer)

**Analog:** itself, current Phase 1 version (read in full above)

**Action union pattern** (lines 6-9) — add new fields to the *existing* `exercise_attempt` action (per Pitfall 3 in RESEARCH.md — do NOT add 3 more action types):
```typescript
export type Action =
  | { type: "theory_step"; understood: boolean }
  | { type: "exercise_attempt"; exerciseId: string; isCorrect: boolean }
  | { type: "advance_position" };
```
Extend `exercise_attempt`'s payload to carry the full `evaluateAttempt()` result (topic deltas, reviewQueue deltas, reward events) as additional fields on the same discriminated-union member, e.g.:
```typescript
| {
    type: "exercise_attempt";
    exerciseId: string;
    isCorrect: boolean;
    topicUpdates: Record<string, TopicStat>;      // per-topic deltas from D-01 loop
    reviewQueueAdditions: string[];                // exerciseIds to append (D-02)
    rewardEvents: RewardEvent[];                   // 0+ events to append to ledger (D-03/04/05)
    correctStreakDelta: number;                    // new currentCorrectStreak value (D-04)
  }
```

**`dispatch()` — do not touch** (lines 30-36): the synchronous `save()`-after-`reduce()`-then-notify-listeners sequence is the exact invariant Pitfall 3 says must be preserved. New logic must fold into a **single** `reduce()` branch per user action, not add new `dispatch()` call sites.

**`reduce()` switch-case pattern** (lines 38-69) — one `case` per action `type`, returning a new object via spread (`{ ...state, field: newValue }`), mirroring the existing `exercise_attempt` case (lines 45-57):
```typescript
case "exercise_attempt": {
  const prevStat = state.exerciseStats[action.exerciseId] ?? { attempts: 0, correct: 0 };
  return {
    ...state,
    exerciseStats: {
      ...state.exerciseStats,
      [action.exerciseId]: {
        attempts: prevStat.attempts + 1,
        correct: prevStat.correct + (action.isCorrect ? 1 : 0),
      },
    },
  };
}
```
Extend this exact case (not a new case) to also fold in `topicStats`, `reviewQueue`, `rewardHistory`/`currentRewards`, and `currentCorrectStreak` from the enriched payload, using the same spread-immutability style. Add a new `case "advance_position":`-style default branch only if a genuinely new action type is unavoidable — prefer enriching the existing case.

---

### `src/core/progress/topicStatusMachine.ts` (NEW — pure FSM function)

**Analog:** `src/core/answer-checking/checkSingleChoice.ts` (13 lines, read in full above)

**Pattern to copy — top-of-file doc comment + pure function, no I/O, no class:**
```typescript
// Deterministic single-choice option-id comparison (CHECK-02, EXERCISE-02).
// Pure function: NO network, NO agent, NO fuzzy matching.
import type { SingleChoiceExercise } from "../lesson/lessonSchema";
import type { CheckResult } from "./checkTextInput";

export function checkSingleChoice(
  exercise: SingleChoiceExercise,
  selectedOptionId: string,
): CheckResult {
  const isCorrect = selectedOptionId === exercise.answerCheck.correctOptionId;
  return { isCorrect, source: "core" };
}
```

**Apply the same shape to `nextTopicStatus()`:** top comment cites the requirement IDs (PROGRESS-02) and the CONTEXT.md decision ID (D-06) it implements — not an external doc, exactly like `checkSingleChoice.ts` cites CHECK-02/EXERCISE-02 from SPEC.md. One named export function, explicit input/output types exported alongside it (mirrors how `CheckResult` is defined in the sibling `checkTextInput.ts` and re-imported). RESEARCH.md's Pattern 1 code example (already table-driven, already typed) can be dropped in near-verbatim — just add the file header comment in this house style.

---

### `src/core/rewards/rewardEngine.ts` (NEW — pure rule engine)

**Analog:** `src/core/answer-checking/checkTextInput.ts` + `normalize.ts` (composition of a pure core function with pure helper functions)

Let me note the composition pattern: `checkTextInput.ts` defines the exported `CheckResult` type once and other checkers (`checkSingleChoice.ts`, `checkMatching.ts`, `checkOrderBuilder.ts`) import it — establishing a single shared result-shape type owned by one file and reused across siblings. `rewardEngine.ts` should follow the same convention: define `RewardReason`/`RewardEvent`-adjacent computation types once here (or re-export the Zod-inferred `RewardEvent` type from `progressSchema.ts` rather than redefining), and keep `computeRewardEvents()` as the single pure entry point, with `alreadyGranted()` (dedup, RESEARCH.md Pattern 2) as an unexported helper — mirroring how `normalize.ts` provides an unexported-from-the-checker-surface helper consumed only by `checkTextInput.ts`.

**Dedup pattern to copy (RESEARCH.md Pattern 2, already concretely specified):**
```typescript
function alreadyGranted(
  rewardHistory: RewardEvent[],
  exerciseId: string,
  reason: RewardReason,
): boolean {
  return rewardHistory.some((r) => r.exerciseId === exerciseId && r.reason === reason);
}
```

**ID generation:** use native `crypto.randomUUID()` inline where `RewardEvent.rewardEventId` is constructed — no new dependency (RESEARCH.md "Don't Hand-Roll" table).

---

### `src/core/progress/reviewQueue.ts` (NEW — pure scan/query function, may be inlined into `topicStatusMachine.ts`'s module or `lessonEngine.ts` instead of a separate file; planner's call per CONTEXT.md discretion)

**Analog:** `src/core/lesson/lessonLoader.ts` (array/field scan over `Exercise[]`) — read its filter/lookup style before writing `enqueueReviewItems()`.

**Exact function already specified in RESEARCH.md Pattern 4** (copy near-verbatim, add file-header comment in house style citing PROGRESS-03/D-02):
```typescript
function enqueueReviewItems(
  allExercises: Exercise[],
  topic: string,
  exerciseStats: Record<string, ExerciseStat>,
  currentQueue: string[],
): string[] {
  const eligible = allExercises
    .filter((ex) => ex.topicImpact.includes(topic))
    .filter((ex) => (exerciseStats[ex.exerciseId]?.correct ?? 0) === 0)
    .map((ex) => ex.exerciseId)
    .filter((id) => !currentQueue.includes(id));
  return [...currentQueue, ...eligible];
}
```

---

### `src/core/lessonEngine.ts` (MODIFY — orchestrator)

**Analog:** itself, current Phase 1 version (read in full above)

**Integration point — `handleAnswer()`** (lines 34-84): the exhaustive `switch (exercise.type)` producing a `CheckResult`, followed by exactly two `dispatch()` calls (lines 79-82), is the locked integration seam:
```typescript
this.store.dispatch({ type: "exercise_attempt", exerciseId, isCorrect: result.isCorrect });
if (result.isCorrect) {
  this.store.dispatch({ type: "advance_position" });
}
return result;
```
**Required change (per RESEARCH.md Pitfall 3):** insert a call to the new pure `evaluateAttempt(state, exercise, result, attemptNumber)` between the checker `switch` and the *first* `dispatch()`, then pass its returned deltas into that same enriched `exercise_attempt` action object — do not add extra `dispatch()` calls. `this.store.getState()` (already available via `this.store`) supplies the `state` argument; `exercise` is already resolved at the top of the function (line 35); `attemptNumber` should be derived from `state.exerciseStats[exerciseId]?.attempts ?? 0` before the dispatch (mirrors how `checkTextInput`'s callers already read prior state before mutating).

**Constructor/`exercises` array — do not mutate** (lines 18-22, Pitfall 4): `this.exercises = lesson.sections.flatMap(...)` is the single source of truth for the main sequence; reviewQueue consumption must be modeled as a second cursor/lookup exposed via a new method (e.g. `getCurrentExerciseId()`), not by pushing review items into `this.exercises`.

---

### Test files (NEW/EXTEND)

**Analog for all new pure-function unit tests:** `tests/core/answer-checking/checkSingleChoice.test.ts` (34 lines, read in full above) — the house style is:
1. Load/parse a hand-authored JSON fixture via `readFileSync` + `resolve(process.cwd(), "tests/fixtures/...")` for any test needing exercise/lesson-shaped input (see lines 7-8).
2. A `describe("<fixture>.fixture.json")` block asserting the fixture itself validates against its Zod schema (Pitfall-1-style provenance note) — copy this pattern if new fixtures are hand-authored for multi-topic `topicImpact[]` (RESEARCH.md Pitfall 2 requires this).
3. A `describe("<functionName>", () => { ... })` block with one `it()` per behavior branch, plain `expect(fn(...)).toEqual({...})` assertions, zero mocking — pure-function tests need no `beforeEach`/spies.

**Analog for `StateStore`/ledger/dedup-style assertions:** `tests/core/state/persistence.test.ts` (92 lines, read in full above) — copy its `beforeEach(() => localStorage.clear())` + `vi.spyOn(Storage.prototype, "setItem")` pattern (lines 66-79) for any Phase 2 test asserting "exactly one `save()`/dispatch per user action" (Pitfall 3 guard test in `tests/core/lessonEngine.test.ts`), and its round-trip `save()`-then-`load()` `toEqual` pattern (lines 12-18) for asserting `topicStats`/`rewardHistory` survive persistence.

**Analog for `lessonEngine.test.ts` extension:** the file itself (already partially read) — new tests should follow its existing `beforeEach(() => localStorage.clear())` + fresh `StateStore(initialState())` + fresh `LessonEngine(lesson, store)` per-test setup (lines 44-54), and its `lessonWithFixtureTypes` composed-fixture pattern (lines 27-41) if a multi-topic exercise fixture needs injecting into a real lesson for an end-to-end `evaluateAttempt()`-through-`handleAnswer()` test.

---

## Shared Patterns

### Pure-function-first, no classes for logic modules
**Source:** `src/core/answer-checking/checkSingleChoice.ts`, `checkTextInput.ts`, `checkMatching.ts`, `checkOrderBuilder.ts`
**Apply to:** `topicStatusMachine.ts`, `rewardEngine.ts`, `reviewQueue.ts` (or wherever that logic lands)
All four Phase 1 checkers are plain exported functions, not classes, taking a typed exercise + answer and returning a small typed result object (`CheckResult`). Phase 2's new logic modules must follow the same shape: `nextTopicStatus(...)`, `computeRewardEvents(...)`, `enqueueReviewItems(...)` are all plain functions, no `class`, no internal mutable state — only `LessonEngine` and `StateStore` are classes in this codebase, and both already exist.

### Zod schema-per-shape + inferred type export
**Source:** `src/core/state/progressSchema.ts` lines 7-19, 38-41
**Apply to:** New `TopicStatusSchema`/`TopicStatSchema`/`RewardReasonSchema`/`RewardEventSchema` additions
One `XxxSchema = z.object({...})` (or `z.enum([...])`) const per concept, immediately paired with `export type Xxx = z.infer<typeof XxxSchema>;`. All type exports for a file are grouped in one block at the file's end (see progressSchema.ts lines 38-41) rather than inline per-schema.

### `save()`-on-`dispatch()`, exactly once per user action
**Source:** `src/core/state/store.ts` lines 30-36; enforced by `tests/core/state/persistence.test.ts` lines 66-79
**Apply to:** `lessonEngine.ts`'s `handleAnswer()` modification, `store.ts`'s `reduce()` extension
Never call `store.dispatch()` more than the existing two call sites per `handleAnswer()` invocation (RESEARCH.md Pitfall 3). All four new state slices (topicStats, reviewQueue, rewardHistory, currentCorrectStreak) fold into the single enriched `exercise_attempt` dispatch.

### Reset-on-schema-mismatch (not default-fill) for `localStorage` reads
**Source:** `src/core/state/persistence.ts` lines 14-50; `tests/core/state/persistence.test.ts` lines 25-42
**Apply to:** New `TopicStatSchema`/`RewardEventSchema` fields — author them as **required** (not `.optional()`/`.default()`), matching RESEARCH.md's Pitfall 1 recommendation, so a Phase-1-shaped legacy blob correctly fails `safeParse()` and resets via the existing `load()` path rather than silently producing partially-typed state.

### Fixture-file provenance pattern for hand-authored test data
**Source:** `tests/core/answer-checking/checkSingleChoice.test.ts` lines 7-15 (`tests/fixtures/single-choice.fixture.json` + a schema-validates-itself `describe` block)
**Apply to:** Any new multi-topic `topicImpact[]` fixture needed to close RESEARCH.md Pitfall 2 (real `Lesson-1A.json` never has >1 topic per exercise)

## No Analog Found

None — every new/modified file in this phase has a strong same-codebase analog from Phase 1, since Phase 2 is architecturally a pure extension of already-proven patterns (Zod schema, StateStore reducer, pure checker functions, Vitest fixture-based unit tests). RESEARCH.md's own summary confirms this: "zero new dependencies and zero new architectural layers."

## Metadata

**Analog search scope:** `src/core/**`, `tests/core/**` (full read of `progressSchema.ts`, `store.ts`, `lessonEngine.ts`, `initialState.ts`, `persistence.ts`, `checkSingleChoice.ts`, `lessonSchema.ts`, `persistence.test.ts`, `lessonEngine.test.ts` (partial), `checkSingleChoice.test.ts`)
**Files scanned:** 12 source files read in full/partial, `find` listing of all 23 existing `src/`/`tests/` TypeScript files for classification context
**Pattern extraction date:** 2026-07-02
