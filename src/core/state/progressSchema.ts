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
});

export const CurrentPositionSchema = z.object({
  theoryUnderstood: z.boolean(),
  currentExerciseIndex: z.number(),
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
