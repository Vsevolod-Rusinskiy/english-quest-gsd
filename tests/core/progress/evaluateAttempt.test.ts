import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ExerciseSchema, type Exercise } from "../../../src/core/lesson/lessonSchema";
import { evaluateAttempt } from "../../../src/core/progress/evaluateAttempt";
import { initialState } from "../../../src/core/state/initialState";
import type { ProgressState } from "../../../src/core/state/progressSchema";

const multiTopicFixturePath = resolve(process.cwd(), "tests/fixtures/multi-topic.fixture.json");
const multiTopicExercise = ExerciseSchema.parse(
  JSON.parse(readFileSync(multiTopicFixturePath, "utf-8")),
) as Exercise;

const singleTopicExercise: Exercise = {
  exerciseId: "ex-single",
  catalogRef: "cat-ref",
  catalogItemRef: "1",
  sourceRef: { sourceBook: "Workbook", unit: "1A", page: "1", exerciseNumber: "1" },
  type: "text-input",
  skill: "grammar",
  prompt: "test prompt",
  targetWords: [],
  targetGrammar: [],
  hint: { firstError: "hint1", parentExplanation: "explain" },
  topicImpact: ["single_topic_a"],
  answerCheck: { mode: "normalizedText", correctAnswers: ["yes"], acceptedAnswers: ["yes"] },
};

const allExercises: Exercise[] = [multiTopicExercise, singleTopicExercise];

describe("evaluateAttempt", () => {
  it("D-01 topic loop: an incorrect answer on a 2-topicImpact exercise increments errors on BOTH topics", () => {
    const state: ProgressState = initialState();

    const delta = evaluateAttempt(
      state,
      multiTopicExercise,
      { isCorrect: false, source: "core" },
      0,
      allExercises,
    );

    expect(Object.keys(delta.topicUpdates)).toEqual(
      expect.arrayContaining(["present_continuous_now", "present_simple_negative"]),
    );
    expect(delta.topicUpdates["present_continuous_now"].errors).toBe(1);
    expect(delta.topicUpdates["present_simple_negative"].errors).toBe(1);
  });

  it("FSM + reviewQueue on 2nd error: two incorrect answers on a single-topic exercise flip topic to needs_review and enqueue", () => {
    let state: ProgressState = initialState();

    // First incorrect attempt.
    const delta1 = evaluateAttempt(
      state,
      singleTopicExercise,
      { isCorrect: false, source: "core" },
      0,
      allExercises,
    );
    state = {
      ...state,
      exerciseStats: {
        ...state.exerciseStats,
        "ex-single": { attempts: 1, correct: 0, lastAttemptCorrect: false },
      },
      topicStats: { ...state.topicStats, ...delta1.topicUpdates },
      reviewQueue: [...state.reviewQueue, ...delta1.reviewQueueAdditions],
    };
    expect(state.topicStats["single_topic_a"].status).toBe("in_progress");
    expect(state.reviewQueue).toHaveLength(0);

    // Second incorrect attempt -> needs_review + enqueue.
    const delta2 = evaluateAttempt(
      state,
      singleTopicExercise,
      { isCorrect: false, source: "core" },
      1,
      allExercises,
    );

    expect(delta2.topicUpdates["single_topic_a"].status).toBe("needs_review");
    expect(delta2.reviewQueueAdditions).toContain("ex-single");
  });

  it("reward pass-through: a first correct answer yields rewardEvents including honest_attempt and first_try_correct", () => {
    const state: ProgressState = initialState();

    const delta = evaluateAttempt(
      state,
      singleTopicExercise,
      { isCorrect: true, source: "core" },
      0,
      allExercises,
    );

    const reasons = delta.rewardEvents.map((e) => e.reason);
    expect(reasons).toContain("honest_attempt");
    expect(reasons).toContain("first_try_correct");
  });

  it("weak_topic_closed via aggregator: three correct-in-a-row on a topic produces entered_mastered and a matching reward", () => {
    let state: ProgressState = initialState();

    for (let i = 0; i < 3; i++) {
      const delta = evaluateAttempt(
        state,
        singleTopicExercise,
        { isCorrect: true, source: "core" },
        i,
        allExercises,
      );
      state = {
        ...state,
        exerciseStats: {
          ...state.exerciseStats,
          "ex-single": { attempts: i + 1, correct: i + 1, lastAttemptCorrect: true },
        },
        topicStats: { ...state.topicStats, ...delta.topicUpdates },
        rewardHistory: [...state.rewardHistory, ...delta.rewardEvents],
        currentRewards: state.currentRewards + delta.rewardEvents.reduce((s, e) => s + e.amount, 0),
        currentCorrectStreak: delta.nextCorrectStreak,
      };

      if (i === 2) {
        expect(delta.topicUpdates["single_topic_a"].status).toBe("mastered");
        const weakClosed = delta.rewardEvents.find((e) => e.reason === "weak_topic_closed");
        expect(weakClosed).toBeDefined();
        expect(weakClosed?.amount).toBe(15);
        expect(weakClosed?.relatedTopic).toBe("single_topic_a");
      }
    }

    expect(state.rewardHistory.some((e) => e.reason === "weak_topic_closed")).toBe(true);
  });

  it("CR-01: three correct-in-a-row on a 2-topicImpact exercise masters BOTH topics and grants a weak_topic_closed reward for each", () => {
    let state: ProgressState = initialState();

    let lastDelta = evaluateAttempt(
      state,
      multiTopicExercise,
      { isCorrect: true, source: "core" },
      0,
      allExercises,
    );

    for (let i = 0; i < 3; i++) {
      lastDelta = evaluateAttempt(
        state,
        multiTopicExercise,
        { isCorrect: true, source: "core" },
        i,
        allExercises,
      );
      state = {
        ...state,
        exerciseStats: {
          ...state.exerciseStats,
          "fixture-multi-topic-01": { attempts: i + 1, correct: i + 1, lastAttemptCorrect: true },
        },
        topicStats: { ...state.topicStats, ...lastDelta.topicUpdates },
        rewardHistory: [...state.rewardHistory, ...lastDelta.rewardEvents],
        currentCorrectStreak: lastDelta.nextCorrectStreak,
      };
    }

    // Both topics must independently reach mastered status.
    expect(state.topicStats["present_continuous_now"].status).toBe("mastered");
    expect(state.topicStats["present_simple_negative"].status).toBe("mastered");

    // The final attempt's delta must carry a weak_topic_closed reward for
    // EACH topic that crossed the threshold on that same call — neither one
    // may be silently dropped in favor of the other.
    const closedTopics = lastDelta.rewardEvents
      .filter((e) => e.reason === "weak_topic_closed")
      .map((e) => e.relatedTopic);
    expect(closedTopics).toEqual(
      expect.arrayContaining(["present_continuous_now", "present_simple_negative"]),
    );
    expect(closedTopics).toHaveLength(2);
  });
});
