// Deterministic order-builder ordered-token comparison (CHECK-02, EXERCISE-04).
// Pure function: NO network, NO agent, NO fuzzy matching.
// Reference: 01-RESEARCH.md Pattern 3 (join(" ") equality).
import type { OrderBuilderExercise } from "../lesson/lessonSchema";
import type { CheckResult } from "./checkTextInput";

export function checkOrderBuilder(
  exercise: OrderBuilderExercise,
  sequence: string[],
): CheckResult {
  const isCorrect = sequence.join(" ") === exercise.answerCheck.correctOrder.join(" ");
  return { isCorrect, source: "core" };
}
