// Zod schema for the Theory Tutor agent contract (SPEC.md §8.5, THEORY-03,
// D-11). Used BOTH to derive the tool's input_schema (z.toJSONSchema, what we
// ask Claude to produce) AND to safeParse the tool_use.input Claude returns
// (what the core trusts) — one schema, one source of truth, per RESEARCH.md
// Pattern 1. Field naming (explanationRu/exampleRu) mirrors the pre-written
// ExplanationLevelSchema's textRu/exampleRu spirit so agent output and
// pre-written levels are handled uniformly by TheoryScreen.
import * as z from "zod";

export const TheoryTutorResponseSchema = z.object({
  explanationRu: z.string(),
  exampleRu: z.string(),
  level: z.string(),
  canSimplifyMore: z.boolean(),
});

export type TheoryTutorResponse = z.infer<typeof TheoryTutorResponseSchema>;
