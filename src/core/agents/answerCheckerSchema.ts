// Zod schema for the Answer Checker agent contract (SPEC.md §8.1, CHECK-03).
// Used BOTH to derive the tool's input_schema (z.toJSONSchema, what we ask
// Claude to produce) AND to safeParse the tool_use.input Claude returns (what
// the core trusts) — one schema, one source of truth, per RESEARCH.md
// Pattern 1. All fields are required in the VALIDATED shape (never optional)
// even though the fallback constructs errorType:"unknown" synthetically with
// no confidence/hintRu — the two shapes are handled distinctly by the
// answerChecker.ts wrapper, not blended into one loosely-typed schema.
import * as z from "zod";

export const AnswerCheckerErrorTypeSchema = z.enum([
  "typo",
  "wrong_word",
  "wrong_order",
  "missed_article",
  "wrong_tense",
  "non_action_verb_in_continuous",
  "wrong_question_order",
  "missing_auxiliary",
  "spelling_third_person_s",
  "spelling_ing_form",
  "unknown",
]); // SPEC.md §8.1 literal enum — do NOT add or rename values

export const AnswerCheckerResponseSchema = z.object({
  isCorrect: z.boolean(),
  errorType: AnswerCheckerErrorTypeSchema,
  confidence: z.number().min(0).max(1),
  hintRu: z.string(),
});

export type AnswerCheckerErrorType = z.infer<typeof AnswerCheckerErrorTypeSchema>;
export type AnswerCheckerResponse = z.infer<typeof AnswerCheckerResponseSchema>;
