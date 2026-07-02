// Zod schema for the Phase 1 slice of ProgressState. Full topic-status FSM,
// reward engine, and reviewQueue population are Phase 2 scope (PROGRESS-01..04,
// REWARD-01/02) — only typed empty containers exist here so PERSIST-01's
// enumerated fields all exist without implementing that logic yet.
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
  rewardHistory: z.array(z.unknown()),
  reviewQueue: z.array(z.unknown()),
});

export type StudentProfile = z.infer<typeof StudentProfileSchema>;
export type ExerciseStat = z.infer<typeof ExerciseStatSchema>;
export type CurrentPosition = z.infer<typeof CurrentPositionSchema>;
export type ProgressState = z.infer<typeof ProgressStateSchema>;
