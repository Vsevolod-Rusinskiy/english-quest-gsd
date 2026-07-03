// Zod schema for the Reward Advisor agent contract (SPEC.md §8.3, REWARD-03).
// Used BOTH to derive the tool's input_schema (z.toJSONSchema, what we ask
// Claude to produce) AND to safeParse the tool_use.input Claude returns (what
// the core trusts) — one schema, one source of truth, per RESEARCH.md
// Pattern 1. All fields are required in the VALIDATED shape (never optional).
//
// suggestedReasons reuses the EXISTING RewardReasonSchema from
// progressSchema.ts rather than redefining a parallel enum (PATTERNS.md's
// explicit instruction) — the agent may only ever suggest a reason from the
// same fixed set the core's reward engine already grants from.
import * as z from "zod";
import { RewardReasonSchema } from "../state/progressSchema";

export const RewardAdvisorResponseSchema = z.object({
  suggestedReasons: z.array(RewardReasonSchema),
  celebrationRu: z.string(),
});

export type RewardAdvisorResponse = z.infer<typeof RewardAdvisorResponseSchema>;
