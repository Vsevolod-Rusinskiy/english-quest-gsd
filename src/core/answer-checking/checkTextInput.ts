// Deterministic text-input exact-match (CHECK-01, EXERCISE-01).
// Pure function: NO network, NO agent, NO fuzzy matching.
import type { TextInputExercise } from "../lesson/lessonSchema";
import { normalize } from "./normalize";

export interface CheckResult {
  isCorrect: boolean;
  source: "core";
}

export function checkTextInput(exercise: TextInputExercise, rawAnswer: string): CheckResult {
  const normalizedAnswer = normalize(rawAnswer);
  const isCorrect = exercise.answerCheck.acceptedAnswers.some(
    (accepted) => normalize(accepted) === normalizedAnswer,
  );
  return { isCorrect, source: "core" };
}
