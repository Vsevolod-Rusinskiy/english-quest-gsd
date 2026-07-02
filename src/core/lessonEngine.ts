// Theory -> exercise orchestrator (Phase 1 slice + Phase 2 progress/reward wiring).
// Cites THEORY-01, THEORY-02, EXERCISE-01..05, CHECK-01, CHECK-02,
// PROGRESS-01/02/03, REWARD-01/02.
import type { Lesson, Exercise } from "./lesson/lessonSchema";
import type { StateStore } from "./state/store";
import { checkTextInput, type CheckResult } from "./answer-checking/checkTextInput";
import { checkSingleChoice } from "./answer-checking/checkSingleChoice";
import { checkMatching } from "./answer-checking/checkMatching";
import { checkOrderBuilder } from "./answer-checking/checkOrderBuilder";
import type { MatchingPair } from "../ui/exercise-renderers/matching";
import { evaluateAttempt } from "./progress/evaluateAttempt";

export type AnswerPayload = string | MatchingPair[] | string[];

export class LessonEngine {
  readonly lesson: Lesson;
  readonly store: StateStore;
  readonly exercises: Exercise[];

  constructor(lesson: Lesson, store: StateStore) {
    this.lesson = lesson;
    this.store = store;
    this.exercises = lesson.sections.flatMap((section) => section.exercises);
  }

  get totalExercises(): number {
    return this.exercises.length;
  }

  // Review-pass cursor (PROGRESS-04, D-02, Pitfall 4). The main exercises
  // array is NEVER mutated — the review pass is a second cursor resolved by
  // looking up reviewQueue ids against this.exercises. Chosen model: since
  // completing a review item ALWAYS dequeues it (correct or not, D-02), the
  // head of reviewQueue is always the current review item — reviewPassIndex
  // stays at 0 and is intentionally left unused (kept in the schema for
  // forward-compatibility only, per the plan's explicit discretion clause).
  isReviewPass(): boolean {
    const state = this.store.getState();
    return (
      state.currentPosition.currentExerciseIndex >= this.totalExercises &&
      state.reviewQueue.length > 0
    );
  }

  getCurrentExerciseId(): string | null {
    const state = this.store.getState();
    const { currentExerciseIndex } = state.currentPosition;
    if (currentExerciseIndex < this.totalExercises) {
      return this.exercises[currentExerciseIndex].exerciseId;
    }
    if (state.reviewQueue.length > 0) {
      // Pitfall 5: reuse the ORIGINAL exerciseId, never a synthetic id, so
      // reward dedup (exerciseId, reason) correctly recognizes a re-visited
      // exercise instead of farming a second first_try_correct.
      return state.reviewQueue[0];
    }
    return null;
  }

  getCurrentExercise(): Exercise | null {
    const id = this.getCurrentExerciseId();
    if (id === null) return null;
    return this.exercises.find((e) => e.exerciseId === id) ?? null;
  }

  // Phase 1 has no Theory Tutor branch — both "понятно" and "не понятно" advance
  // to the first exercise (THEORY-02 literal).
  handleTheoryStep(_understood: boolean): void {
    this.store.dispatch({ type: "theory_step", understood: true });
  }

  handleAnswer(exerciseId: string, answer: AnswerPayload): CheckResult {
    const exercise = this.exercises.find((e) => e.exerciseId === exerciseId);
    if (!exercise) {
      throw new Error(`Unknown exerciseId: ${exerciseId}`);
    }

    // NO agent call in any branch (CHECK-02) — every type routes to a Plan 02
    // deterministic core checker. Each branch validates the payload shape at
    // runtime before forwarding it, so a mismatched caller gets a clear Error
    // instead of a silent, nonsensical undefined-based comparison (WR-01).
    let result: CheckResult;
    switch (exercise.type) {
      case "text-input":
        if (typeof answer !== "string") {
          throw new Error(`handleAnswer: expected string for exerciseId ${exerciseId}`);
        }
        result = checkTextInput(exercise, answer);
        break;
      case "single-choice":
        if (typeof answer !== "string") {
          throw new Error(`handleAnswer: expected string for exerciseId ${exerciseId}`);
        }
        result = checkSingleChoice(exercise, answer);
        break;
      case "matching":
        if (
          !Array.isArray(answer) ||
          answer.some((p) => typeof p !== "object" || p === null || !("leftId" in p))
        ) {
          throw new Error(`handleAnswer: expected MatchingPair[] for exerciseId ${exerciseId}`);
        }
        result = checkMatching(exercise, answer as MatchingPair[]);
        break;
      case "order-builder":
        if (!Array.isArray(answer) || answer.some((t) => typeof t !== "string")) {
          throw new Error(`handleAnswer: expected string[] for exerciseId ${exerciseId}`);
        }
        result = checkOrderBuilder(exercise, answer as string[]);
        break;
      default: {
        const _exhaustive: never = exercise;
        throw new Error(`Unhandled exercise type: ${JSON.stringify(_exhaustive)}`);
      }
    }

    // Phase 2: compute the ENTIRE per-answer update (topic loop, FSM, review
    // queue, rewards) as one pure evaluateAttempt() call, then fold it into
    // this SAME dispatch (Pitfall 3) — the conditional advance_position
    // dispatch below is Phase 1's existing second call site, unchanged.
    const state = this.store.getState();
    const priorAttempts = state.exerciseStats[exerciseId]?.attempts ?? 0;
    const delta = evaluateAttempt(state, exercise, result, priorAttempts, this.exercises);

    // Plan 03 (PROGRESS-04, D-02): a review-pass answer dequeues the completed
    // item REGARDLESS of correctness — same single exercise_attempt dispatch,
    // no separate action type. Determined BEFORE the dispatch since the
    // dequeue check reads the current (pre-dispatch) reviewQueue head.
    const wasReviewPass = this.isReviewPass() && this.getCurrentExerciseId() === exerciseId;

    this.store.dispatch({
      type: "exercise_attempt",
      exerciseId,
      isCorrect: result.isCorrect,
      topicUpdates: delta.topicUpdates,
      reviewQueueAdditions: delta.reviewQueueAdditions,
      rewardEvents: delta.rewardEvents,
      nextCorrectStreak: delta.nextCorrectStreak,
      reviewDequeueId: wasReviewPass ? exerciseId : undefined,
    });
    // Main-pass correct answer: advance currentExerciseIndex (unchanged Phase 1
    // behavior). Review-pass answers never advance_position — the review cursor
    // is entirely reviewQueue-length-driven (dequeue above IS the advance).
    if (result.isCorrect && !wasReviewPass) {
      this.store.dispatch({ type: "advance_position" });
    }
    return result;
  }
}
