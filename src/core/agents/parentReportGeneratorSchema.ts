// Zod schema for the Parent Report Generator agent contract (SPEC.md §8.4,
// REPORT-01). Used BOTH to derive the tool's input_schema (z.toJSONSchema,
// what we ask Claude to produce) AND to safeParse the tool_use.input Claude
// returns (what the core trusts) — one schema, one source of truth, per
// RESEARCH.md Pattern 1. All fields are required (never optional).
import * as z from "zod";

export const ParentReportGeneratorResponseSchema = z.object({
  parentReportRu: z.string(),
  headlineRu: z.string(),
});

export type ParentReportGeneratorResponse = z.infer<typeof ParentReportGeneratorResponseSchema>;
