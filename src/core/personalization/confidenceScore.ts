// confidenceScore (PERSONAL-01, SPEC.md §12).
// Pure function: NO network, NO agent call. This module is the sole place
// SPEC.md §12's confidenceScore formula is computed:
//   clamp(correctRatio + 0.05*streak - 0.1*errorsInARow, 0, 1)
// The Progress Advisor agent never proposes or computes this value — it is
// arithmetic decided entirely by the core, mirroring rewardEngine.ts's
// "amounts are core, never agent" discipline (PROJECT.md core/agent boundary).
export interface ConfidenceInputs {
  correctRatio: number; // total correct / total attempts across the session
  streak: number; // currentCorrectStreak at session end
  errorsInARow: number; // currentErrorStreak at session end (Open Question 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeConfidenceScore(inputs: ConfidenceInputs): number {
  const { correctRatio, streak, errorsInARow } = inputs;
  return clamp(correctRatio + 0.05 * streak - 0.1 * errorsInARow, 0, 1);
}
