// Theory -> exercise orchestrator (Phase 1 slice). Cites THEORY-01, THEORY-02,
// EXERCISE-01, EXERCISE-05, CHECK-01.
import type { Lesson, Exercise } from "./lesson/lessonSchema";
import type { StateStore } from "./state/store";
import { checkTextInput, type CheckResult } from "./answer-checking/checkTextInput";

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

  handleAnswer(exerciseId: string, rawAnswer: string): CheckResult {
    const exercise = this.exercises.find((e) => e.exerciseId === exerciseId);
    if (!exercise) {
      throw new Error(`Unknown exerciseId: ${exerciseId}`);
    }

    let result: CheckResult;
    switch (exercise.type) {
      case "text-input":
        result = checkTextInput(exercise, rawAnswer);
        break;
      case "matching":
      case "single-choice":
      case "order-builder":
        // Not yet wired (Plan 03) — honest placeholder, no fake behavior.
        throw new Error(`Answer checking for type "${exercise.type}" not yet wired (Plan 03)`);
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
