import type { ProgressState } from "./progressSchema";

export function initialState(): ProgressState {
  return {
    studentProfile: { studentId: "primary" },
    lessonHistory: [],
    exerciseStats: {},
    currentPosition: { theoryUnderstood: false, currentExerciseIndex: 0 },
    currentRewards: 0,
    rewardHistory: [],
    reviewQueue: [],
  };
}
