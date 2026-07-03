// Zod schema for ProgressState. Phase 1 established exerciseStats/currentPosition/
// lessonId; Phase 2 now types the per-topic mastery machine and reward ledger
// (PROGRESS-01/02/03, REWARD-01/02) — topicStats, currentCorrectStreak, and the
// previously-untyped rewardHistory/reviewQueue placeholders. All new fields are
// required (no defaults) so a legacy blob missing them resets via load(), rather
// than silently producing partial state.
import * as z from "zod";

export const StudentProfileSchema = z.object({
  studentId: z.literal("primary"),
});

export const ExerciseStatSchema = z.object({
  attempts: z.number(),
  correct: z.number(),
  // CR-02: tracks the outcome of only the MOST RECENT attempt on this
  // exercise, distinct from the lifetime `correct` counter. `correct` never
  // resets, so it cannot answer "is this exercise unresolved in the CURRENT
  // needs_review episode" once an exercise has ever been answered correctly
  // even a single time in the past — see enqueueReviewItems in reviewQueue.ts.
  lastAttemptCorrect: z.boolean(),
  // Phase 3 (RELY-03, D-08): source/failure of the MOST RECENT attempt only
  // (mirrors lastAttemptCorrect's "most recent, not lifetime" convention) —
  // lets a developer inspect "was this answer core or agent, did a fallback
  // fire" per exercise without a separate parallel log. Required (not
  // optional) so a legacy blob missing them resets via load(), consistent
  // with this file's established schema-versioning discipline.
  lastAttemptSource: z.enum(["core", "agent"]),
  lastAttemptAgentFailed: z.boolean(),
});

export const CurrentPositionSchema = z.object({
  theoryUnderstood: z.boolean(),
  currentExerciseIndex: z.number(),
  // Review-pass cursor (PROGRESS-04, D-02, Open Question 1). Required (not
  // optional/default) so a Phase-1/Plan-02-shaped legacy blob missing it
  // resets via load() rather than resuming into an undefined cursor
  // (T-02-05). Seeded to 0 and left unused by the reduce/engine logic in
  // this plan's chosen model (queue always serves reviewQueue[0], dequeue-
  // on-completion means the head IS the current item — see 02-03-SUMMARY.md
  // "Review-pass cursor model" decision) but kept in the schema for
  // forward-compatibility per the plan's explicit discretion clause.
  reviewPassIndex: z.number(),
  // Phase 3 Plan 02 (THEORY-03, D-11, RESEARCH.md Open Question 2): counts
  // how many "не понятно" taps have occurred in the CURRENT theory step.
  // Required (not optional/default) so a legacy blob missing it resets via
  // load() rather than resuming mid-simplify-loop into an undefined round
  // count (same discipline as reviewPassIndex above) — a page reload
  // mid-loop must not silently reset the round back to 1. The actual
  // explanation TEXT stays transient/in-memory in main.ts (not persisted
  // here); only the round COUNT is durable state.
  simplifyRoundCount: z.number(),
});

export const TopicStatusSchema = z.enum(["not_started", "in_progress", "needs_review", "mastered"]);

export const TopicStatSchema = z.object({
  status: TopicStatusSchema,
  attempts: z.number(),
  correct: z.number(),
  errors: z.number(),
  correctStreak: z.number(), // per-topic streak, distinct from currentCorrectStreak (session-global)
});

export const RewardReasonSchema = z.enum([
  "honest_attempt",
  "first_try_correct",
  "correct_after_hint",
  "fixed_mistake",
  "streak_bonus",
  "weak_topic_closed",
]);

export const RewardEventSchema = z.object({
  rewardEventId: z.string(),
  exerciseId: z.string().optional(), // absent for weak_topic_closed (topic-scoped, not exercise-scoped)
  relatedTopic: z.string().optional(),
  reason: RewardReasonSchema,
  amount: z.number(),
  attemptNumber: z.number(),
  createdAt: z.string(), // ISO timestamp
});

export const ProgressStateSchema = z.object({
  studentProfile: StudentProfileSchema,
  // Binds this saved blob to the specific lesson it was generated against
  // (WR-02). Optional so pre-existing stored blobs from before this field
  // existed still validate; `load()` treats a missing/mismatched lessonId
  // as stale and resets to initialState() rather than silently reusing a
  // currentExerciseIndex/exerciseStats that no longer line up with the
  // currently-loaded lesson content.
  lessonId: z.string().optional(),
  lessonHistory: z.array(z.unknown()),
  exerciseStats: z.record(z.string(), ExerciseStatSchema),
  currentPosition: CurrentPositionSchema,
  currentRewards: z.number(),
  rewardHistory: z.array(RewardEventSchema),
  reviewQueue: z.array(z.string()), // exerciseId strings, not full exercise objects (D-02 discretion)
  topicStats: z.record(z.string(), TopicStatSchema),
  currentCorrectStreak: z.number(), // session-global correct-answer streak (D-04)
});

export type StudentProfile = z.infer<typeof StudentProfileSchema>;
export type ExerciseStat = z.infer<typeof ExerciseStatSchema>;
export type CurrentPosition = z.infer<typeof CurrentPositionSchema>;
export type TopicStatus = z.infer<typeof TopicStatusSchema>;
export type TopicStat = z.infer<typeof TopicStatSchema>;
export type RewardReason = z.infer<typeof RewardReasonSchema>;
export type RewardEvent = z.infer<typeof RewardEventSchema>;
export type ProgressState = z.infer<typeof ProgressStateSchema>;
