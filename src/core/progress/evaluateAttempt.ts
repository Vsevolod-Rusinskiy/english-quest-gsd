// Single per-answer aggregator (PROGRESS-01/02/03, REWARD-01/02, D-01/D-02/D-06).
// Pure function: NO I/O, NO dispatch, NO save — composes the Plan 01 FSM +
// review-queue scan with the Plan 02 reward engine into ONE delta object, so
// LessonEngine.handleAnswer can fold everything into a single enriched
// exercise_attempt dispatch (Pitfall 3 — exactly one save/render per answer).
import type { Exercise } from "../lesson/lessonSchema";
import type { CheckResult } from "../answer-checking/checkTextInput";
import type {
  ProgressState,
  TopicStat,
  RewardEvent,
  WordStat,
  ExerciseTypeStat,
} from "../state/progressSchema";
import { nextTopicStatus } from "./topicStatusMachine";
import { enqueueReviewItems } from "./reviewQueue";
import { computeRewardEvents } from "../rewards/rewardEngine";

export interface EvaluateAttemptResult {
  topicUpdates: Record<string, TopicStat>;
  reviewQueueAdditions: string[];
  rewardEvents: RewardEvent[];
  nextCorrectStreak: number;
  // Phase 4 Plan 02 (D-11/D-12, PERSONAL-01): per-word/per-exercise-type
  // deltas for the Progress Advisor's input, computed the same call as the
  // existing topicUpdates so LessonEngine folds everything into ONE dispatch.
  wordUpdates: Record<string, WordStat>;
  exerciseTypeUpdates: Record<string, ExerciseTypeStat>;
  // Session-global counter mirroring nextCorrectStreak's shape but tracking
  // consecutive INCORRECT answers (RESEARCH.md Open Question 1, resolved) —
  // feeds the confidenceScore formula's errorsInARow.
  nextErrorStreak: number;
}

const DEFAULT_TOPIC_STAT: TopicStat = {
  status: "not_started",
  attempts: 0,
  correct: 0,
  errors: 0,
  correctStreak: 0,
};

const DEFAULT_WORD_STAT: WordStat = {
  attempts: 0,
  correct: 0,
  errors: 0,
};

const DEFAULT_EXERCISE_TYPE_STAT: ExerciseTypeStat = {
  attempts: 0,
  correct: 0,
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
  // CR-01: collect ALL topics that transitioned to mastered in this loop, not
  // just the last one — a single exercise can carry multiple topicImpact
  // entries (see multi-topic.fixture.json) that independently cross the
  // mastery threshold in the same call. A single nullable value here would
  // silently drop every mastery but the last-processed one, permanently
  // losing the weak_topic_closed reward for the earlier topic(s).
  const masteredTopics: string[] = [];

  // D-01: loop ALL topicImpact entries, never index [0] (Pitfall 2).
  // WR-01: read from the in-progress topicUpdates accumulator first, falling
  // back to the pre-dispatch snapshot only on the topic's first iteration.
  // Nothing in the schema forbids a duplicate topic within a single
  // exercise's topicImpact — without this, a second occurrence of the same
  // topic would recompute from the same stale `prev`, discarding the first
  // iteration's increment and any FSM transition it produced.
  for (const topic of exercise.topicImpact) {
    const prev = topicUpdates[topic] ?? state.topicStats[topic] ?? DEFAULT_TOPIC_STAT;
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
      masteredTopics.push(topic);
    }
  }

  // D-12/Pitfall 4 (THE critical case): loop ALL targetWords entries, never
  // targetWords[0] only — the real eq-1a-ex019 matching exercise has 8.
  // Mirrors the topicImpact loop's exact accumulator-first-fallback-to-state
  // discipline (read from the in-progress accumulator first, falling back to
  // the pre-dispatch state snapshot only on the word's first iteration) so a
  // schema-legal duplicate word within one exercise's targetWords accumulates
  // correctly instead of dropping the first occurrence.
  const wordUpdates: Record<string, WordStat> = {};
  for (const word of exercise.targetWords) {
    const prev = wordUpdates[word] ?? state.wordStats[word] ?? DEFAULT_WORD_STAT;
    wordUpdates[word] = {
      attempts: prev.attempts + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
      errors: prev.errors + (isCorrect ? 0 : 1),
    };
  }

  // exerciseTypeStats: a simple (non-looped) single-key update, same
  // fallback-on-read convention as topicStats/wordStats (Pitfall 5).
  const exerciseTypeUpdates: Record<string, ExerciseTypeStat> = {};
  const prevTypeStat = state.exerciseTypeStats[exercise.type] ?? DEFAULT_EXERCISE_TYPE_STAT;
  exerciseTypeUpdates[exercise.type] = {
    attempts: prevTypeStat.attempts + 1,
    correct: prevTypeStat.correct + (isCorrect ? 1 : 0),
  };

  // Session-global "consecutive incorrect" counter — mirrors
  // computeRewardEvents' existing nextCorrectStreak computation exactly, but
  // tracks the opposite direction (increments on incorrect, resets on correct).
  const nextErrorStreak = isCorrect ? 0 : state.currentErrorStreak + 1;

  const { rewardEvents, nextCorrectStreak } = computeRewardEvents({
    exerciseId: exercise.exerciseId,
    isCorrect,
    priorAttempts,
    rewardHistory: state.rewardHistory,
    currentCorrectStreak: state.currentCorrectStreak,
    masteredTopics,
  });

  // Only the newly-added ids are the "additions" the reduce branch should append.
  const additionsOnly = reviewQueueAdditions.filter((id) => !state.reviewQueue.includes(id));

  return {
    topicUpdates,
    reviewQueueAdditions: additionsOnly,
    rewardEvents,
    nextCorrectStreak,
    wordUpdates,
    exerciseTypeUpdates,
    nextErrorStreak,
  };
}
