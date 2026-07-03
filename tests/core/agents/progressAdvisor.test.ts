// Progress Advisor tests (PERSONAL-01, PERSONAL-03, RELY-01/02). Uses a
// stubbed client injected into the shared gateway path — no real network.
// Proves: agent success resolves to the validated recommendedFocus/
// suggestedDifficulty/reviewSuggestions/motivationalMessageRu/sessionAdvice,
// source:'agent'; agent failure (both attempts) resolves to a fallback shape
// derived PURELY from caller-supplied threshold inputs (never fabricated
// agent-style prose), source:'core' (PERSONAL-03); a wrong-shape response is
// rejected by Zod into the same fallback, with exactly one retry (RELY-02).
import { describe, it, expect, vi } from "vitest";
import { callProgressAdvisor } from "../../../src/core/agents/progressAdvisor";
import type { AgentClient, AgentResponse } from "../../../src/core/agents/callAgent";

function toolUseMessage(input: unknown): AgentResponse {
  return {
    content: [{ type: "tool_use", id: "toolu_1", name: "report_progress_recommendation", input }],
  };
}

function createMock() {
  return vi.fn<(params: unknown, options?: unknown) => Promise<AgentResponse>>();
}

function fakeClient(create: ReturnType<typeof createMock>): AgentClient {
  return { messages: { create } };
}

describe("callProgressAdvisor (PERSONAL-01, PERSONAL-03, RELY-01, RELY-02)", () => {
  it("agent success -> resolves to the validated recommendedFocus/suggestedDifficulty/reviewSuggestions/motivationalMessageRu/sessionAdvice, source:'agent'", async () => {
    const create = createMock().mockResolvedValueOnce(
      toolUseMessage({
        recommendedFocus: "present_continuous_now",
        suggestedDifficulty: "challenge",
        reviewSuggestions: ["present_continuous_now"],
        motivationalMessageRu: "Отличная работа сегодня!",
        sessionAdvice: "continue",
      }),
    );

    const result = await callProgressAdvisor({
      topicStats: {},
      wordStats: {},
      exerciseTypeStats: {},
      currentDifficultyMode: "normal",
      fallbackRecommendedFocus: "present_simple_negative",
      client: fakeClient(create),
    });

    expect(result.source).toBe("agent");
    expect(result.recommendedFocus).toBe("present_continuous_now");
    expect(result.suggestedDifficulty).toBe("challenge");
    expect(result.reviewSuggestions).toEqual(["present_continuous_now"]);
    expect(result.motivationalMessageRu).toBe("Отличная работа сегодня!");
    expect(result.sessionAdvice).toBe("continue");
  });

  it("agent failure (both attempts) -> resolves to a fallback derived PURELY from caller-supplied threshold inputs, source:'core' (PERSONAL-03)", async () => {
    const create = createMock().mockRejectedValue(new Error("network down"));

    const result = await callProgressAdvisor({
      topicStats: {},
      wordStats: {},
      exerciseTypeStats: {},
      currentDifficultyMode: "normal",
      fallbackRecommendedFocus: "present_simple_negative",
      client: fakeClient(create),
    });

    expect(result.source).toBe("core");
    expect(result.recommendedFocus).toBe("present_simple_negative");
    // PERSONAL-02: no upward/downward suggestion without the agent — the
    // guardrail function will see suggested === current and correctly no-op.
    expect(result.suggestedDifficulty).toBe("normal");
    expect(result.reviewSuggestions).toEqual([]);
    expect(typeof result.motivationalMessageRu).toBe("string");
    expect(result.sessionAdvice).toBe("continue");
  });

  it("wrong-shape response (suggestedDifficulty outside the 3-value enum) is rejected by Zod into the same fallback; create called exactly twice (one retry)", async () => {
    const create = createMock().mockResolvedValue(
      toolUseMessage({
        recommendedFocus: "present_continuous_now",
        suggestedDifficulty: "expert", // not in the enum
        reviewSuggestions: [],
        motivationalMessageRu: "Молодец!",
        sessionAdvice: "continue",
      }),
    );

    const result = await callProgressAdvisor({
      topicStats: {},
      wordStats: {},
      exerciseTypeStats: {},
      currentDifficultyMode: "normal",
      fallbackRecommendedFocus: "present_simple_negative",
      client: fakeClient(create),
    });

    expect(result.source).toBe("core");
    expect(result.recommendedFocus).toBe("present_simple_negative");
    expect(result.suggestedDifficulty).toBe("normal");
    expect(create).toHaveBeenCalledTimes(2); // one retry, then fallback
  });
});
