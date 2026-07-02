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
