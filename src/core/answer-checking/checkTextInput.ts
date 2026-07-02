// Deterministic text-input exact-match (CHECK-01, EXERCISE-01).
// Pure function: NO network, NO agent, NO fuzzy matching.
import type { TextInputExercise } from "../lesson/lessonSchema";
import type { AnswerCheckerErrorType } from "../agents/answerCheckerSchema";
import { normalize } from "./normalize";

// Extended Phase 3 (CHECK-03, D-09): an exact-match failure (isCorrect:false
// from THIS function) is no longer immediately final — lessonEngine's
// text-input branch treats it as the trigger to call Answer Checker via the
// gateway, whose result also flows through this SAME CheckResult shape.
// errorType/confidence/hintRu are only populated on the agent path; the
// deterministic exact-match path (this file) never sets them.
export interface CheckResult {
  isCorrect: boolean;
  source: "core" | "agent";
  errorType?: AnswerCheckerErrorType;
  confidence?: number;
  hintRu?: string;
}

export function checkTextInput(exercise: TextInputExercise, rawAnswer: string): CheckResult {
  const normalizedAnswer = normalize(rawAnswer);
  const isCorrect = exercise.answerCheck.acceptedAnswers.some(
    (accepted) => normalize(accepted) === normalizedAnswer,
  );
  return { isCorrect, source: "core" };
}
