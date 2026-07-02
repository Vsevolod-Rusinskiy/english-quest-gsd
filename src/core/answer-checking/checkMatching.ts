// Deterministic matching pair-id set comparison (CHECK-02, EXERCISE-03).
// Pure function: NO network, NO agent, NO fuzzy matching.
import type { MatchingExercise } from "../lesson/lessonSchema";
import type { CheckResult } from "./checkTextInput";

interface Pair {
  leftId: string;
  rightId: string;
}

function toPairMap(pairs: Pair[]): Map<string, string> {
  return new Map(pairs.map((p) => [p.leftId, p.rightId]));
}

export function checkMatching(exercise: MatchingExercise, userPairs: Pair[]): CheckResult {
  const expected = toPairMap(exercise.answerCheck.pairs);
  const actual = toPairMap(userPairs);

  const isCorrect =
    expected.size === actual.size &&
    userPairs.length === actual.size && // reject duplicate/collapsed leftId entries
    [...expected.entries()].every(([leftId, rightId]) => actual.get(leftId) === rightId);

  return { isCorrect, source: "core" };
}
