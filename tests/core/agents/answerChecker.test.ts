// Answer Checker tests (CHECK-03, CHECK-04). Uses a stubbed client injected
// into the gateway path — no real network. Proves: ambiguous answer + agent
// success resolves to a validated AnswerCheckerResponse-shaped CheckResult;
// agent failure (both attempts) resolves to the fixed fallback shape and does
// NOT throw (CHECK-04's documented fallback).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { callAnswerChecker } from "../../../src/core/agents/answerChecker";
import type { AgentClient, AgentResponse } from "../../../src/core/agents/callAgent";

function toolUseMessage(input: unknown): AgentResponse {
  return {
    content: [{ type: "tool_use", id: "toolu_1", name: "report_answer_check", input }],
  };
}

function createMock() {
  return vi.fn<(params: unknown, options?: unknown) => Promise<AgentResponse>>();
}

function fakeClient(create: ReturnType<typeof createMock>): AgentClient {
  return { messages: { create } };
}

describe("callAnswerChecker (CHECK-03, CHECK-04)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("ambiguous answer + agent success -> resolves to a validated CheckResult with errorType in the 11-value enum, confidence in [0,1], and a hintRu string", async () => {
    const create = createMock().mockResolvedValueOnce(
      toolUseMessage({
        isCorrect: false,
        errorType: "missed_article",
        confidence: 0.82,
        hintRu: "Не забудь артикль.",
      }),
    );

    const result = await callAnswerChecker({
      prompt: "I saw ___ dog.",
      correctAnswers: ["a dog"],
      acceptedAnswers: ["a dog", "the dog"],
      childAnswer: "dog",
      client: fakeClient(create),
    });

    expect(result.source).toBe("agent");
    expect(result.isCorrect).toBe(false);
    expect(result.errorType).toBe("missed_article");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.hintRu).toBe("string");
  });

  it("agent says isCorrect:true with confidence >= 0.8 -> core trusts it, isCorrect stays true", async () => {
    const create = createMock().mockResolvedValueOnce(
      toolUseMessage({
        isCorrect: true,
        errorType: "unknown",
        confidence: 0.8,
        hintRu: "",
      }),
    );

    const result = await callAnswerChecker({
      prompt: "I saw ___ dog.",
      correctAnswers: ["a dog"],
      acceptedAnswers: ["a dog", "the dog"],
      childAnswer: "a dog puppy",
      client: fakeClient(create),
    });

    expect(result.source).toBe("agent");
    expect(result.isCorrect).toBe(true);
  });

  it("agent says isCorrect:true with confidence below 0.8 -> core does NOT trust it, downgrades to isCorrect:false (CR-02 confidence gate)", async () => {
    const create = createMock().mockResolvedValueOnce(
      toolUseMessage({
        isCorrect: true,
        errorType: "unknown",
        confidence: 0.79,
        hintRu: "",
      }),
    );

    const result = await callAnswerChecker({
      prompt: "I saw ___ dog.",
      correctAnswers: ["a dog"],
      acceptedAnswers: ["a dog", "the dog"],
      childAnswer: "a doog",
      client: fakeClient(create),
    });

    expect(result.source).toBe("agent");
    expect(result.isCorrect).toBe(false);
    // confidence/errorType still passed through — the agent's judgment is
    // recorded, just not trusted to flip the reward-affecting verdict.
    expect(result.confidence).toBe(0.79);
  });

  it("agent failure (both attempts) -> resolves to the fallback shape { isCorrect: false, errorType: 'unknown', source: 'core' } and does NOT throw", async () => {
    const create = createMock().mockRejectedValue(new Error("network down"));

    const result = await callAnswerChecker({
      prompt: "I saw ___ dog.",
      correctAnswers: ["a dog"],
      acceptedAnswers: ["a dog", "the dog"],
      childAnswer: "dog",
      client: fakeClient(create),
    });

    expect(result).toEqual({ isCorrect: false, errorType: "unknown", source: "core" });
  });
});
