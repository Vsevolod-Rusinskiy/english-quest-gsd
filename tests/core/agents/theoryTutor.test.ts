// Theory Tutor tests (THEORY-03, RELY-01/02, D-11). Uses a stubbed client
// injected into the shared gateway path — no real network. Proves: agent
// success resolves to a validated explanation; agent failure (both attempts)
// re-serves the caller-supplied fallbackLevel text (NOT fabricated text,
// per D-11/RESEARCH.md Anti-Pattern); a wrong-shape response is rejected by
// Zod into the same fallback.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTheoryTutor } from "../../../src/core/agents/theoryTutor";
import type { AgentClient, AgentResponse } from "../../../src/core/agents/callAgent";

function toolUseMessage(input: unknown): AgentResponse {
  return {
    content: [{ type: "tool_use", id: "toolu_1", name: "report_explanation", input }],
  };
}

function createMock() {
  return vi.fn<(params: unknown, options?: unknown) => Promise<AgentResponse>>();
}

function fakeClient(create: ReturnType<typeof createMock>): AgentClient {
  return { messages: { create } };
}

const fallbackLevel = {
  textRu: "Привычка или всегда → простое время: I eat.",
  exampleRu: "I eat at home. Now I am eating.",
};

describe("callTheoryTutor (THEORY-03, RELY-01, RELY-02, D-11)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("agent success -> resolves to a validated response with explanationRu (string), exampleRu (string), level, canSimplifyMore (boolean), source:'agent'", async () => {
    const create = createMock().mockResolvedValueOnce(
      toolUseMessage({
        explanationRu: "Ещё проще: сейчас — am/is/are + -ing.",
        exampleRu: "I am eating now.",
        level: "very_simple",
        canSimplifyMore: true,
      }),
    );

    const result = await callTheoryTutor({
      rule: "present simple vs continuous",
      currentLevelText: fallbackLevel.textRu,
      fallbackLevel,
      roundNumber: 2,
      client: fakeClient(create),
    });

    expect(result.source).toBe("agent");
    expect(typeof result.explanationRu).toBe("string");
    expect(typeof result.exampleRu).toBe("string");
    expect(result.explanationRu).toBe("Ещё проще: сейчас — am/is/are + -ing.");
  });

  it("agent failure (both attempts) -> resolves to the fallback that re-serves the provided explanationLevels[1] text (NOT fabricated text), source:'core', does NOT throw", async () => {
    const create = createMock().mockRejectedValue(new Error("network down"));

    const result = await callTheoryTutor({
      rule: "present simple vs continuous",
      currentLevelText: fallbackLevel.textRu,
      fallbackLevel,
      roundNumber: 2,
      client: fakeClient(create),
    });

    expect(result.source).toBe("core");
    expect(result.explanationRu).toBe(fallbackLevel.textRu);
    expect(result.exampleRu).toBe(fallbackLevel.exampleRu);
  });

  it("a wrong-shape agent response (missing explanationRu / wrong type) is rejected by Zod into the fallback", async () => {
    const create = createMock().mockResolvedValue(
      toolUseMessage({
        // explanationRu missing entirely
        exampleRu: "I am eating now.",
        level: "very_simple",
        canSimplifyMore: "yes", // wrong type, should be boolean
      }),
    );

    const result = await callTheoryTutor({
      rule: "present simple vs continuous",
      currentLevelText: fallbackLevel.textRu,
      fallbackLevel,
      roundNumber: 2,
      client: fakeClient(create),
    });

    expect(result.source).toBe("core");
    expect(result.explanationRu).toBe(fallbackLevel.textRu);
    expect(result.exampleRu).toBe(fallbackLevel.exampleRu);
    expect(create).toHaveBeenCalledTimes(2); // one retry (D-06), then fallback
  });
});
