// Zod schema for the Progress Advisor agent contract (SPEC.md §8.2,
// PERSONAL-01). Used BOTH to derive the tool's input_schema (z.toJSONSchema,
// what we ask Claude to produce) AND to safeParse the tool_use.input Claude
// returns (what the core trusts) — one schema, one source of truth, per
// RESEARCH.md Pattern 1. All fields are required (never optional).
//
// suggestedDifficulty reuses the EXISTING DifficultyModeSchema from
// progressSchema.ts rather than redefining a parallel enum — the agent may
// only ever suggest a value from the same fixed 3-value set the core's
// guardrail function (difficultyGuardrails.ts) already gates against.
// sessionAdvice is explicitly "continue"/"soft_finish" per SPEC.md §8.2's
// literal wording — a 2-value enum, not a free string.
import * as z from "zod";
import { DifficultyModeSchema } from "../state/progressSchema";

export const ProgressAdvisorResponseSchema = z.object({
  recommendedFocus: z.string(),
  suggestedDifficulty: DifficultyModeSchema,
  reviewSuggestions: z.array(z.string()),
  motivationalMessageRu: z.string(),
  sessionAdvice: z.enum(["continue", "soft_finish"]),
});

export type ProgressAdvisorResponse = z.infer<typeof ProgressAdvisorResponseSchema>;
