// Deterministic order-builder ordered-token comparison (CHECK-02, EXERCISE-04).
// Pure function: NO network, NO agent, NO fuzzy matching.
// Element-wise array comparison (WR-04) — a join(" ") string comparison would
// false-positive/negative on tokens containing embedded spaces, since two
// different token arrays can join to the same string (e.g. ["a b", "c"] vs
// ["a", "b c"] both join to "a b c").
import type { OrderBuilderExercise } from "../lesson/lessonSchema";
import type { CheckResult } from "./checkTextInput";

export function checkOrderBuilder(
  exercise: OrderBuilderExercise,
  sequence: string[],
): CheckResult {
  const correct = exercise.answerCheck.correctOrder;
  const isCorrect =
    sequence.length === correct.length && sequence.every((token, i) => token === correct[i]);
  return { isCorrect, source: "core" };
}
