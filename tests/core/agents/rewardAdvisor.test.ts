// Reward Advisor tests (REWARD-03, REWARD-04, RELY-01/02, D-02/D-03/D-04).
// Uses a stubbed client injected into the shared gateway path — no real
// network. Proves: agent success resolves to a validated
// suggestedReasons/celebrationRu, UNFILTERED against granted rewardEvents
// (the cross-check against actually-granted reasons happens in
// lessonEngine.ts, not inside this wrapper, per PATTERNS.md); agent failure
// (both attempts) resolves to the fixed no-praise fallback shape, never
// throws (REWARD-04); a wrong-shape response is rejected by Zod into the
// same fallback, with exactly one retry (RELY-02).
import { describe, it, expect, vi } from "vitest";
import { callRewardAdvisor } from "../../../src/core/agents/rewardAdvisor";
import type { AgentClient, AgentResponse } from "../../../src/core/agents/callAgent";
import type { RewardEvent } from "../../../src/core/state/progressSchema";

function toolUseMessage(input: unknown): AgentResponse {
  return {
    content: [{ type: "tool_use", id: "toolu_1", name: "report_reward_praise", input }],
  };
}

function createMock() {
  return vi.fn<(params: unknown, options?: unknown) => Promise<AgentResponse>>();
}

function fakeClient(create: ReturnType<typeof createMock>): AgentClient {
  return { messages: { create } };
}

const sampleRewardEvents: RewardEvent[] = [
  {
    rewardEventId: "re-1",
    exerciseId: "eq-1a-ex001",
    reason: "first_try_correct",
    amount: 5,
    attemptNumber: 1,
    createdAt: "2026-07-03T00:00:00.000Z",
  },
];

describe("callRewardAdvisor (REWARD-03, REWARD-04, RELY-01, RELY-02)", () => {
  it("agent success -> resolves to validated suggestedReasons/celebrationRu, source:'agent', unfiltered against rewardEvents", async () => {
    const create = createMock().mockResolvedValueOnce(
      toolUseMessage({
        suggestedReasons: ["first_try_correct"],
        celebrationRu: "Отлично, с первой попытки!",
      }),
    );

    const result = await callRewardAdvisor({
      rewardEvents: sampleRewardEvents,
      attemptNumber: 1,
      rewardHistory: [],
      currentCorrectStreak: 0,
      client: fakeClient(create),
    });

    expect(result.source).toBe("agent");
    expect(result.suggestedReasons).toEqual(["first_try_correct"]);
    expect(result.celebrationRu).toBe("Отлично, с первой попытки!");
  });

  it("agent success with empty-string celebrationRu -> normalized to undefined, not passed through as a rendered empty praise (WR-03)", async () => {
    const create = createMock().mockResolvedValueOnce(
      toolUseMessage({
        suggestedReasons: ["first_try_correct"],
        celebrationRu: "",
      }),
    );

    const result = await callRewardAdvisor({
      rewardEvents: sampleRewardEvents,
      attemptNumber: 1,
      rewardHistory: [],
      currentCorrectStreak: 0,
      client: fakeClient(create),
    });

    expect(result.source).toBe("agent");
    expect(result.celebrationRu).toBeUndefined();
  });

  it("agent failure (both attempts) -> resolves to {suggestedReasons: [], celebrationRu: undefined, source: 'core'}, never throws (REWARD-04)", async () => {
    const create = createMock().mockRejectedValue(new Error("network down"));

    const result = await callRewardAdvisor({
      rewardEvents: sampleRewardEvents,
      attemptNumber: 1,
      rewardHistory: [],
      currentCorrectStreak: 0,
      client: fakeClient(create),
    });

    expect(result.source).toBe("core");
    expect(result.suggestedReasons).toEqual([]);
    expect(result.celebrationRu).toBeUndefined();
  });

  it("wrong-shape response (suggestedReasons value outside RewardReasonSchema enum) is rejected by Zod into the same fallback shape; create called exactly twice (one retry, RELY-02)", async () => {
    const create = createMock().mockResolvedValue(
      toolUseMessage({
        suggestedReasons: ["not_a_real_reason"],
        celebrationRu: "Молодец!",
      }),
    );

    const result = await callRewardAdvisor({
      rewardEvents: sampleRewardEvents,
      attemptNumber: 1,
      rewardHistory: [],
      currentCorrectStreak: 0,
      client: fakeClient(create),
    });

    expect(result.source).toBe("core");
    expect(result.suggestedReasons).toEqual([]);
    expect(result.celebrationRu).toBeUndefined();
    expect(create).toHaveBeenCalledTimes(2); // one retry (RELY-02), then fallback
  });
});
