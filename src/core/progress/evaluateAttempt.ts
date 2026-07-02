// Single per-answer aggregator (PROGRESS-01/02/03, REWARD-01/02, D-01/D-02/D-06).
// Pure function: NO I/O, NO dispatch, NO save — composes the Plan 01 FSM +
// review-queue scan with the Plan 02 reward engine into ONE delta object, so
// LessonEngine.handleAnswer can fold everything into a single enriched
// exercise_attempt dispatch (Pitfall 3 — exactly one save/render per answer).
import type { Exercise } from "../lesson/lessonSchema";
import type { CheckResult } from "../answer-checking/checkTextInput";
import type { ProgressState, TopicStat, RewardEvent } from "../state/progressSchema";
import { nextTopicStatus } from "./topicStatusMachine";
import { enqueueReviewItems } from "./reviewQueue";
import { computeRewardEvents } from "../rewards/rewardEngine";

export interface EvaluateAttemptResult {
  topicUpdates: Record<string, TopicStat>;
  reviewQueueAdditions: string[];
  rewardEvents: RewardEvent[];
  nextCorrectStreak: number;
}

const DEFAULT_TOPIC_STAT: TopicStat = {
  status: "not_started",
  attempts: 0,
  correct: 0,
  errors: 0,
  correctStreak: 0,
};

export function evaluateAttempt(
  state: ProgressState,
  exercise: Exercise,
  checkResult: CheckResult,
  priorAttempts: number,
  allExercises: Exercise[],
): EvaluateAttemptResult {
  const { isCorrect } = checkResult;
  const topicUpdates: Record<string, TopicStat> = {};
  let reviewQueueAdditions = [...state.reviewQueue];
  let masteredTransition: { topic: string } | null = null;

  // D-01: loop ALL topicImpact entries, never index [0] (Pitfall 2).
  for (const topic of exercise.topicImpact) {
    const prev = state.topicStats[topic] ?? DEFAULT_TOPIC_STAT;
    const newAttempts = prev.attempts + 1;
    const newCorrect = prev.correct + (isCorrect ? 1 : 0);
    const newErrors = prev.errors + (isCorrect ? 0 : 1);
    const newCorrectStreak = isCorrect ? prev.correctStreak + 1 : 0;

    const fsmResult = nextTopicStatus(prev.status, isCorrect, newErrors, newCorrectStreak);

    topicUpdates[topic] = {
      status: fsmResult.status,
      attempts: newAttempts,
      correct: newCorrect,
      errors: newErrors,
      correctStreak: newCorrectStreak,
    };

    if (fsmResult.transition === "entered_needs_review") {
      reviewQueueAdditions = enqueueReviewItems(allExercises, topic, state.exerciseStats, reviewQueueAdditions);
    } else if (fsmResult.transition === "entered_mastered") {
      masteredTransition = { topic };
    }
  }

  const { rewardEvents, nextCorrectStreak } = computeRewardEvents({
    exerciseId: exercise.exerciseId,
    isCorrect,
    priorAttempts,
    rewardHistory: state.rewardHistory,
    currentCorrectStreak: state.currentCorrectStreak,
    masteredTransition,
  });

  // Only the newly-added ids are the "additions" the reduce branch should append.
  const additionsOnly = reviewQueueAdditions.filter((id) => !state.reviewQueue.includes(id));

  return {
    topicUpdates,
    reviewQueueAdditions: additionsOnly,
    rewardEvents,
    nextCorrectStreak,
  };
}
