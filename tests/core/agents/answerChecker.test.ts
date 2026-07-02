// Answer Checker tests (CHECK-03, CHECK-04). Uses a stubbed client injected
// into the gateway path — no real network. Proves: ambiguous answer + agent
// success resolves to a validated AnswerCheckerResponse-shaped CheckResult;
// agent failure (both attempts) resolves to the fixed fallback shape and does
// NOT throw (CHECK-04's documented fallback).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { callAnswerChecker } from "../../../src/core/agents/answerChecker";
import type { AgentClient } from "../../../src/core/agents/callAgent";

function toolUseMessage(input: unknown) {
  return {
    content: [{ type: "tool_use", id: "toolu_1", name: "report_answer_check", input }],
  };
}

function fakeClient(create: ReturnType<typeof vi.fn>): AgentClient {
  return { messages: { create } };
}

describe("callAnswerChecker (CHECK-03, CHECK-04)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("ambiguous answer + agent success -> resolves to a validated CheckResult with errorType in the 11-value enum, confidence in [0,1], and a hintRu string", async () => {
    const create = vi.fn().mockResolvedValueOnce(
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

  it("agent failure (both attempts) -> resolves to the fallback shape { isCorrect: false, errorType: 'unknown', source: 'core' } and does NOT throw", async () => {
    const create = vi.fn().mockRejectedValue(new Error("network down"));

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
