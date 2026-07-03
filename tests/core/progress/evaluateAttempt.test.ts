import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ExerciseSchema, LessonSchema, type Exercise } from "../../../src/core/lesson/lessonSchema";
import { evaluateAttempt } from "../../../src/core/progress/evaluateAttempt";
import { initialState } from "../../../src/core/state/initialState";
import type { ProgressState } from "../../../src/core/state/progressSchema";

const multiTopicFixturePath = resolve(process.cwd(), "tests/fixtures/multi-topic.fixture.json");
const multiTopicExercise = ExerciseSchema.parse(
  JSON.parse(readFileSync(multiTopicFixturePath, "utf-8")),
) as Exercise;

const lessonPath = resolve(process.cwd(), "public/Lesson-1A.json");
const realLesson = LessonSchema.parse(JSON.parse(readFileSync(lessonPath, "utf-8")));
const realExercises = realLesson.sections.flatMap((s) => s.exercises);
// eq-1a-ex019: the real 8-word matching exercise (Pitfall 4 — THE critical case).
const eightWordExercise = realExercises.find((e) => e.exerciseId === "eq-1a-ex019")!;
// eq-1a-ex010: the real 1-word text-input exercise (targetWords: ["meat"]).
const oneWordExercise = realExercises.find((e) => e.exerciseId === "eq-1a-ex010")!;

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

const duplicateTopicExercise: Exercise = {
  exerciseId: "ex-dup-topic",
  catalogRef: "cat-ref-dup",
  catalogItemRef: "1",
  sourceRef: { sourceBook: "Workbook", unit: "1A", page: "1", exerciseNumber: "1" },
  type: "text-input",
  skill: "grammar",
  prompt: "test prompt",
  targetWords: [],
  targetGrammar: [],
  hint: { firstError: "hint1", parentExplanation: "explain" },
  // WR-01: nothing in the schema forbids a duplicate topic within a single
  // exercise's topicImpact.
  topicImpact: ["grammar_x", "grammar_x"],
  answerCheck: { mode: "normalizedText", correctAnswers: ["yes"], acceptedAnswers: ["yes"] },
};

const duplicateWordExercise: Exercise = {
  exerciseId: "ex-dup-word",
  catalogRef: "cat-ref-dup-word",
  catalogItemRef: "1",
  sourceRef: { sourceBook: "Workbook", unit: "1A", page: "1", exerciseNumber: "1" },
  type: "text-input",
  skill: "vocabulary",
  prompt: "test prompt",
  // D-12/Pitfall 4 (Test 6): nothing in the schema forbids a duplicate word
  // within a single exercise's targetWords, mirroring WR-01's topicImpact case.
  targetWords: ["bread", "bread"],
  targetGrammar: [],
  hint: { firstError: "hint1", parentExplanation: "explain" },
  topicImpact: [],
  answerCheck: { mode: "normalizedText", correctAnswers: ["yes"], acceptedAnswers: ["yes"] },
};

const allExercises: Exercise[] = [
  multiTopicExercise,
  singleTopicExercise,
  duplicateTopicExercise,
  duplicateWordExercise,
];

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
        "ex-single": { attempts: 1, correct: 0, lastAttemptCorrect: false, lastAttemptSource: "core", lastAttemptAgentFailed: false },
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
          "ex-single": { attempts: i + 1, correct: i + 1, lastAttemptCorrect: true, lastAttemptSource: "core", lastAttemptAgentFailed: false },
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
          "fixture-multi-topic-01": { attempts: i + 1, correct: i + 1, lastAttemptCorrect: true, lastAttemptSource: "core", lastAttemptAgentFailed: false },
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

  it("WR-01: a duplicate topic within a single exercise's topicImpact accumulates both increments instead of dropping the first", () => {
    const state: ProgressState = initialState();

    const delta = evaluateAttempt(
      state,
      duplicateTopicExercise,
      { isCorrect: false, source: "core" },
      0,
      allExercises,
    );

    // Two occurrences of "grammar_x" in topicImpact on one incorrect answer
    // must accumulate to 2 attempts / 2 errors, not collapse to 1 because
    // the second iteration re-read the same stale pre-dispatch snapshot.
    expect(delta.topicUpdates["grammar_x"].attempts).toBe(2);
    expect(delta.topicUpdates["grammar_x"].errors).toBe(2);
  });

  it("Pitfall 4 (THE critical case): the real 8-word eq-1a-ex019 matching exercise updates wordUpdates for ALL 8 targetWords, never just targetWords[0]", () => {
    const state: ProgressState = initialState();

    const delta = evaluateAttempt(
      state,
      eightWordExercise,
      { isCorrect: true, source: "core" },
      0,
      allExercises,
    );

    const expectedWords = [
      "knife",
      "fork",
      "napkin",
      "glass",
      "prawns",
      "fried eggs",
      "strawberries",
      "salt and pepper",
    ];
    expect(Object.keys(delta.wordUpdates)).toEqual(expect.arrayContaining(expectedWords));
    expect(Object.keys(delta.wordUpdates)).toHaveLength(8);
    for (const word of expectedWords) {
      expect(delta.wordUpdates[word]).toEqual({ attempts: 1, correct: 1, errors: 0 });
    }
  });

  it("evaluateAttempt wordStats, single-word case: the real 1-word eq-1a-ex010 exercise produces exactly one wordUpdates entry", () => {
    const state: ProgressState = initialState();

    const delta = evaluateAttempt(
      state,
      oneWordExercise,
      { isCorrect: false, source: "core" },
      0,
      allExercises,
    );

    expect(Object.keys(delta.wordUpdates)).toEqual(["meat"]);
    expect(delta.wordUpdates["meat"]).toEqual({ attempts: 1, correct: 0, errors: 1 });
  });

  it("evaluateAttempt exerciseTypeStats: a text-input exercise attempt increments exerciseTypeUpdates['text-input'].attempts/.correct relative to pre-existing state", () => {
    let state: ProgressState = initialState();
    state = {
      ...state,
      exerciseTypeStats: { "text-input": { attempts: 3, correct: 2 } },
    };

    const delta = evaluateAttempt(
      state,
      singleTopicExercise, // type: "text-input"
      { isCorrect: true, source: "core" },
      0,
      allExercises,
    );

    expect(delta.exerciseTypeUpdates["text-input"]).toEqual({ attempts: 4, correct: 3 });
  });

  it("accumulator-first-fallback-to-state discipline (D-12): a duplicate word within one exercise's targetWords accumulates both increments instead of dropping the first", () => {
    const state: ProgressState = initialState();

    const delta = evaluateAttempt(
      state,
      duplicateWordExercise,
      { isCorrect: false, source: "core" },
      0,
      allExercises,
    );

    expect(delta.wordUpdates["bread"]).toEqual({ attempts: 2, correct: 0, errors: 2 });
  });

  it("evaluateAttempt returns nextErrorStreak: increments on incorrect, resets to 0 on correct (mirrors nextCorrectStreak)", () => {
    const state: ProgressState = { ...initialState(), currentErrorStreak: 1 };

    const incorrectDelta = evaluateAttempt(
      state,
      singleTopicExercise,
      { isCorrect: false, source: "core" },
      0,
      allExercises,
    );
    expect(incorrectDelta.nextErrorStreak).toBe(2);

    const correctDelta = evaluateAttempt(
      state,
      singleTopicExercise,
      { isCorrect: true, source: "core" },
      0,
      allExercises,
    );
    expect(correctDelta.nextErrorStreak).toBe(0);
  });
});
