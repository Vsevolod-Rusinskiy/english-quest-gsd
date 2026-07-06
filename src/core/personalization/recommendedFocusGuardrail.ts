// Deterministic recommendedFocus guardrail (PERSONAL-03, SMOKE-FIX-02).
// Pure function: NO network, NO agent, NO state read/write beyond its two
// explicit string parameters. Mirrors difficultyGuardrails.ts's pattern —
// this is the core-side trust gate for Progress Advisor's
// `recommendedFocus` (src/core/agents/progressAdvisor.ts), whose schema
// (progressAdvisorSchema.ts) deliberately leaves it as an unconstrained
// `z.string()`. That means the LLM can return ANY string, including a
// hallucinated, free-form, or mixed-language one — a live-tested example was
// "present_simple_question_order with question formation in real contexts
// (building on the strong foundation in present continuous)". Validation is
// enforced HERE, in the core, not in the schema (CLAUDE.md's "agent
// proposes, core validates before use" boundary, T-ogs-01/T-ogs-02).
//
// TOPIC_LABELS (src/core/topics/topicLabels.ts) is the single
// source-of-truth valid-id set — this function validates against its keys
// and NEVER duplicates or hardcodes a second topic-id list.
import { TOPIC_LABELS } from "../topics/topicLabels";

export function applyRecommendedFocusGuardrail(candidate: string, fallback: string): string {
  if (Object.prototype.hasOwnProperty.call(TOPIC_LABELS, candidate)) {
    return candidate;
  }
  return fallback;
}
