// Zod schema for lesson-json-v1 (D-02). Base shape copied from 01-RESEARCH.md Pattern 1.
// SingleChoice/OrderBuilder variants are included now ([ASSUMED] mode names per RESEARCH.md
// Pattern 1 / Assumptions A1, A2) so the schema is complete for Plans 02/03, even though
// Lesson-1A.json currently contains zero exercises of either type.
import * as z from "zod";

export const SourceRefSchema = z.object({
  sourceBook: z.string(),
  unit: z.string(),
  page: z.string(),
  exerciseNumber: z.string(),
});

export const HintSchema = z.object({
  firstError: z.string(),
  secondError: z.string().optional(), // NOT present on every exercise — 9/19 omit it
  parentExplanation: z.string(),
});

export const NormalizedTextCheckSchema = z.object({
  mode: z.literal("normalizedText"),
  correctAnswers: z.array(z.string()),
  acceptedAnswers: z.array(z.string()),
});

export const PairIdsCheckSchema = z.object({
  mode: z.literal("pairIds"),
  pairs: z.array(z.object({ leftId: z.string(), rightId: z.string() })),
});

export const ChoiceIdCheckSchema = z.object({
  mode: z.literal("choiceId"), // [ASSUMED] — no real data confirms this mode name
  correctOptionId: z.string(),
});

export const OrderedTokensCheckSchema = z.object({
  mode: z.literal("orderedTokens"), // [ASSUMED] — no real data confirms this mode name
  correctOrder: z.array(z.string()),
});

const BaseExerciseFields = {
  exerciseId: z.string(),
  catalogRef: z.string(),
  catalogItemRef: z.string(),
  sourceRef: SourceRefSchema,
  skill: z.string(),
  prompt: z.string(),
  targetWords: z.array(z.string()),
  targetGrammar: z.array(z.string()),
  hint: HintSchema,
  topicImpact: z.array(z.string()),
};

export const TextInputExerciseSchema = z.object({
  ...BaseExerciseFields,
  type: z.literal("text-input"),
  answerCheck: NormalizedTextCheckSchema,
});

export const MatchingExerciseSchema = z.object({
  ...BaseExerciseFields,
  type: z.literal("matching"),
  answerCheck: PairIdsCheckSchema,
  leftItems: z.array(z.object({ id: z.string(), imagePrompt: z.string() })),
  rightOptions: z.array(z.object({ id: z.string(), labelEn: z.string() })),
});

export const SingleChoiceExerciseSchema = z.object({
  ...BaseExerciseFields,
  type: z.literal("single-choice"),
  answerCheck: ChoiceIdCheckSchema,
  options: z.array(z.object({ id: z.string(), labelEn: z.string() })),
});

export const OrderBuilderExerciseSchema = z.object({
  ...BaseExerciseFields,
  type: z.literal("order-builder"),
  answerCheck: OrderedTokensCheckSchema,
  wordBank: z.array(z.string()),
});

export const ExerciseSchema = z.discriminatedUnion("type", [
  TextInputExerciseSchema,
  MatchingExerciseSchema,
  SingleChoiceExerciseSchema,
  OrderBuilderExerciseSchema,
]);

export const SectionSchema = z.object({
  sectionId: z.string(),
  title: z.string(),
  instructionRu: z.string(),
  instructionEn: z.string(),
  skill: z.string(),
  imagePolicy: z.string(),
  exercises: z.array(ExerciseSchema),
});

export const ExplanationLevelSchema = z.object({
  level: z.string(), // e.g. "normal" | "simple" — string enum in real data, not a number
  textRu: z.string(),
  exampleRu: z.string(),
});

export const TheorySchema = z.object({
  theoryRef: z.string(),
  topicId: z.string(),
  titleRu: z.string(),
  rule: z.string(),
  explanationLevels: z.array(ExplanationLevelSchema),
  maxSimplifyRounds: z.number(),
});

export const LessonSchema = z.object({
  lessonId: z.string(),
  schemaVersion: z.literal("lesson-json-v1"),
  unitTitle: z.string(),
  theme: z.string(),
  lessonGoal: z.string(),
  defaultNormalization: z.unknown().optional(),
  defaultRewardRules: z.array(z.unknown()).optional(),
  targetVocabulary: z.array(z.unknown()).optional(),
  targetGrammar: z.array(z.unknown()).optional(),
  theory: TheorySchema,
  sections: z.array(SectionSchema),
  reviewExercises: z.array(z.unknown()),
  // Remaining root fields not needed by Phase 1 logic — permissive pass-through.
  sourceCatalog: z.unknown().optional(),
  status: z.unknown().optional(),
  requiresAdultApproval: z.unknown().optional(),
  authorNote: z.unknown().optional(),
});

export type Lesson = z.infer<typeof LessonSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type TextInputExercise = z.infer<typeof TextInputExerciseSchema>;
export type MatchingExercise = z.infer<typeof MatchingExerciseSchema>;
export type SingleChoiceExercise = z.infer<typeof SingleChoiceExerciseSchema>;
export type OrderBuilderExercise = z.infer<typeof OrderBuilderExerciseSchema>;
export type Theory = z.infer<typeof TheorySchema>;
