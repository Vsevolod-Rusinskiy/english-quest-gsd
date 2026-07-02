// Theory -> exercise orchestrator (Phase 1 slice). Cites THEORY-01, THEORY-02,
// EXERCISE-01..05, CHECK-01, CHECK-02.
import type { Lesson, Exercise } from "./lesson/lessonSchema";
import type { StateStore } from "./state/store";
import { checkTextInput, type CheckResult } from "./answer-checking/checkTextInput";
import { checkSingleChoice } from "./answer-checking/checkSingleChoice";
import { checkMatching } from "./answer-checking/checkMatching";
import { checkOrderBuilder } from "./answer-checking/checkOrderBuilder";
import type { MatchingPair } from "../ui/exercise-renderers/matching";

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
    // deterministic core checker.
    let result: CheckResult;
    switch (exercise.type) {
      case "text-input":
        result = checkTextInput(exercise, answer as string);
        break;
      case "single-choice":
        result = checkSingleChoice(exercise, answer as string);
        break;
      case "matching":
        result = checkMatching(exercise, answer as MatchingPair[]);
        break;
      case "order-builder":
        result = checkOrderBuilder(exercise, answer as string[]);
        break;
      default: {
        const _exhaustive: never = exercise;
        throw new Error(`Unhandled exercise type: ${JSON.stringify(_exhaustive)}`);
      }
    }

    this.store.dispatch({ type: "exercise_attempt", exerciseId, isCorrect: result.isCorrect });
    if (result.isCorrect) {
      this.store.dispatch({ type: "advance_position" });
    }
    return result;
  }
}
