import { describe, it, expect, beforeEach, vi } from "vitest";
import { StateStore } from "../../../src/core/state/store";
import { initialState } from "../../../src/core/state/initialState";
import type { RewardEvent, TopicStat } from "../../../src/core/state/progressSchema";

describe("StateStore.reduce — enriched exercise_attempt (Pitfall 3)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("folds exerciseStats, topicStats, reviewQueue, rewardHistory, currentRewards, currentCorrectStreak in ONE reduced state", () => {
    const store = new StateStore(initialState());

    const topicUpdates: Record<string, TopicStat> = {
      present_continuous_now: {
        status: "in_progress",
        attempts: 1,
        correct: 1,
        errors: 0,
        correctStreak: 1,
      },
    };
    const rewardEvents: RewardEvent[] = [
      {
        rewardEventId: "r1",
        exerciseId: "eq-1a-ex001",
        reason: "honest_attempt",
        amount: 1,
        attemptNumber: 1,
        createdAt: new Date().toISOString(),
      },
      {
        rewardEventId: "r2",
        exerciseId: "eq-1a-ex001",
        reason: "first_try_correct",
        amount: 5,
        attemptNumber: 1,
        createdAt: new Date().toISOString(),
      },
    ];

    store.dispatch({
      type: "exercise_attempt",
      exerciseId: "eq-1a-ex001",
      isCorrect: true,
      topicUpdates,
      reviewQueueAdditions: ["eq-1a-ex002"],
      rewardEvents,
      nextCorrectStreak: 1,
    });

    const state = store.getState();
    expect(state.exerciseStats["eq-1a-ex001"]).toEqual({
      attempts: 1,
      correct: 1,
      lastAttemptCorrect: true,
    });
    expect(state.topicStats["present_continuous_now"]).toEqual(topicUpdates["present_continuous_now"]);
    expect(state.reviewQueue).toEqual(["eq-1a-ex002"]);
    expect(state.rewardHistory).toEqual(rewardEvents);
    expect(state.currentRewards).toBe(6);
    expect(state.currentCorrectStreak).toBe(1);
  });

  it("dispatching the enriched exercise_attempt action still triggers exactly one save() call", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const store = new StateStore(initialState());
    setItemSpy.mockClear();

    store.dispatch({
      type: "exercise_attempt",
      exerciseId: "eq-1a-ex001",
      isCorrect: false,
      topicUpdates: {},
      reviewQueueAdditions: [],
      rewardEvents: [],
      nextCorrectStreak: 0,
    });

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    setItemSpy.mockRestore();
  });

  it("reviewQueueAdditions are not duplicated if already present in reviewQueue", () => {
    const store = new StateStore({ ...initialState(), reviewQueue: ["eq-1a-ex002"] });

    store.dispatch({
      type: "exercise_attempt",
      exerciseId: "eq-1a-ex001",
      isCorrect: false,
      topicUpdates: {},
      reviewQueueAdditions: ["eq-1a-ex002", "eq-1a-ex003"],
      rewardEvents: [],
      nextCorrectStreak: 0,
    });

    expect(store.getState().reviewQueue).toEqual(["eq-1a-ex002", "eq-1a-ex003"]);
  });
});
