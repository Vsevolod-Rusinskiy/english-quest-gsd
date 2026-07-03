import type { ProgressState } from "./progressSchema";

export function initialState(lessonId?: string): ProgressState {
  return {
    studentProfile: {
      studentId: "primary",
      confidenceScore: 0,
      difficultyMode: "normal",
      lastRecommendedFocus: null,
      motivationSignals: [],
    },
    lessonId,
    lessonHistory: [],
    exerciseStats: {},
    currentPosition: {
      theoryUnderstood: false,
      currentExerciseIndex: 0,
      reviewPassIndex: 0,
      simplifyRoundCount: 0,
    },
    currentRewards: 0,
    rewardHistory: [],
    reviewQueue: [],
    topicStats: {},
    currentCorrectStreak: 0,
    wordStats: {},
    exerciseTypeStats: {},
    currentErrorStreak: 0,
  };
}
