// Parent Report Generator tests (REPORT-01, REPORT-02, RELY-01/02). Uses a
// stubbed client injected into the shared gateway path — no real network.
// Proves: agent success resolves to a validated report; agent failure (both
// attempts) resolves to a deterministic TEMPLATE report interpolating every
// one of the 6 snapshot fields (source:"core"); a wrong-shape response is
// rejected by Zod into the same template fallback.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { callParentReportGenerator } from "../../../src/core/agents/parentReportGenerator";
import type { AgentClient, AgentResponse } from "../../../src/core/agents/callAgent";

function toolUseMessage(input: unknown): AgentResponse {
  return {
    content: [{ type: "tool_use", id: "toolu_1", name: "report_parent_summary", input }],
  };
}

function createMock() {
  return vi.fn<(params: unknown, options?: unknown) => Promise<AgentResponse>>();
}

function fakeClient(create: ReturnType<typeof createMock>): AgentClient {
  return { messages: { create } };
}

const baseInput = {
  exercisesCompleted: 19,
  correctCount: 15,
  strugglingTopics: ["present_continuous_now"],
  reviewTopics: ["food_vocabulary"],
  rublesEarned: 42,
  recommendation: "Повторить present continuous",
};

describe("callParentReportGenerator (REPORT-01, REPORT-02, RELY-01, RELY-02)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("agent success -> resolves to a validated response with parentReportRu/headlineRu (both strings), source:'agent'", async () => {
    const create = createMock().mockResolvedValueOnce(
      toolUseMessage({
        parentReportRu: "Ребёнок отлично справился сегодня!",
        headlineRu: "Отличный урок!",
      }),
    );

    const result = await callParentReportGenerator({
      ...baseInput,
      client: fakeClient(create),
    });

    expect(result.source).toBe("agent");
    expect(typeof result.parentReportRu).toBe("string");
    expect(typeof result.headlineRu).toBe("string");
    expect(result.parentReportRu).toBe("Ребёнок отлично справился сегодня!");
    expect(result.headlineRu).toBe("Отличный урок!");
  });

  it("agent failure (both attempts, REPORT-02) -> resolves to a TEMPLATE report deterministically interpolating all 6 snapshot fields, source:'core'", async () => {
    const create = createMock().mockRejectedValue(new Error("network down"));

    const result = await callParentReportGenerator({
      ...baseInput,
      client: fakeClient(create),
    });

    expect(result.source).toBe("core");
    expect(result.parentReportRu).toContain(String(baseInput.exercisesCompleted));
    expect(result.parentReportRu).toContain(String(baseInput.correctCount));
    expect(result.parentReportRu).toContain(baseInput.strugglingTopics[0]);
    expect(result.parentReportRu).toContain(baseInput.reviewTopics[0]);
    expect(result.parentReportRu).toContain(String(baseInput.rublesEarned));
    expect(result.parentReportRu).toContain(baseInput.recommendation);
    expect(result.headlineRu).toBe("Итоги урока");
  });

  it("a wrong-shape agent response (headlineRu missing) is rejected by Zod into the same template fallback; create called exactly twice", async () => {
    const create = createMock().mockResolvedValue(
      toolUseMessage({
        parentReportRu: "Всё хорошо",
        // headlineRu missing entirely
      }),
    );

    const result = await callParentReportGenerator({
      ...baseInput,
      client: fakeClient(create),
    });

    expect(result.source).toBe("core");
    expect(result.parentReportRu).toContain(String(baseInput.exercisesCompleted));
    expect(result.headlineRu).toBe("Итоги урока");
    expect(create).toHaveBeenCalledTimes(2); // one retry (D-06), then fallback
  });
});
