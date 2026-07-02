import { describe, it, expect } from "vitest";
import type { Exercise } from "../../../src/core/lesson/lessonSchema";
import type { ExerciseStat } from "../../../src/core/state/progressSchema";
import { enqueueReviewItems } from "../../../src/core/progress/reviewQueue";

function makeTextInputExercise(exerciseId: string, topicImpact: string[]): Exercise {
  return {
    exerciseId,
    catalogRef: "wb-test",
    catalogItemRef: "1",
    sourceRef: { sourceBook: "Workbook", unit: "1A", page: "5", exerciseNumber: "1" },
    type: "text-input",
    skill: "grammar",
    prompt: "test prompt",
    targetWords: [],
    targetGrammar: [],
    answerCheck: {
      mode: "normalizedText",
      correctAnswers: ["answer"],
      acceptedAnswers: ["answer"],
    },
    hint: {
      firstError: "hint 1",
      parentExplanation: "parent explanation",
    },
    topicImpact,
  };
}

describe("enqueueReviewItems", () => {
  it("basic scan: returns exerciseIds of exercises whose topicImpact includes the topic and not yet correctly answered", () => {
    const exercises = [
      makeTextInputExercise("ex-1", ["T"]),
      makeTextInputExercise("ex-2", ["T"]),
      makeTextInputExercise("ex-3", ["other"]),
    ];
    const stats: Record<string, ExerciseStat> = {};
    const result = enqueueReviewItems(exercises, "T", stats, []);
    expect(result).toEqual(["ex-1", "ex-2"]);
  });

  it("excludes an exercise already answered correctly", () => {
    const exercises = [
      makeTextInputExercise("ex-1", ["T"]),
      makeTextInputExercise("ex-2", ["T"]),
    ];
    const stats: Record<string, ExerciseStat> = {
      "ex-1": { attempts: 1, correct: 1, lastAttemptCorrect: true },
    };
    const result = enqueueReviewItems(exercises, "T", stats, []);
    expect(result).toEqual(["ex-2"]);
  });

  it("includes an exercise with no exerciseStats entry (never-attempted) and one attempted-but-always-wrong (correct: 0)", () => {
    const exercises = [
      makeTextInputExercise("ex-never-attempted", ["T"]),
      makeTextInputExercise("ex-always-wrong", ["T"]),
    ];
    const stats: Record<string, ExerciseStat> = {
      "ex-always-wrong": { attempts: 3, correct: 0, lastAttemptCorrect: false },
      // ex-never-attempted has no entry at all
    };
    const result = enqueueReviewItems(exercises, "T", stats, []);
    expect(result).toEqual(["ex-never-attempted", "ex-always-wrong"]);
  });

  it("CR-02: an exercise whose LAST attempt was correct is excluded even with a high lifetime correct count", () => {
    const exercises = [makeTextInputExercise("ex-1", ["T"])];
    const stats: Record<string, ExerciseStat> = {
      "ex-1": { attempts: 5, correct: 4, lastAttemptCorrect: true },
    };
    const result = enqueueReviewItems(exercises, "T", stats, []);
    expect(result).toEqual([]);
  });

  it("CR-02: an exercise that was correct in the past but whose LAST attempt was wrong IS eligible again (regression-after-correct)", () => {
    const exercises = [makeTextInputExercise("ex-1", ["T"])];
    // Lifetime correct count is 1 (it WAS answered correctly once), but the
    // most recent attempt regressed to incorrect — this is the exact
    // scenario from CR-01/CR-02 where a topic re-enters needs_review after
    // a prior recovery. A cumulative `correct` counter would wrongly
    // exclude this exercise forever; lastAttemptCorrect must not.
    const stats: Record<string, ExerciseStat> = {
      "ex-1": { attempts: 2, correct: 1, lastAttemptCorrect: false },
    };
    const result = enqueueReviewItems(exercises, "T", stats, []);
    expect(result).toEqual(["ex-1"]);
  });

  it("dedups against the current queue, preserving existing order then appending only new ids", () => {
    const exercises = [
      makeTextInputExercise("ex-1", ["T"]),
      makeTextInputExercise("ex-2", ["T"]),
    ];
    const stats: Record<string, ExerciseStat> = {};
    const result = enqueueReviewItems(exercises, "T", stats, ["ex-1"]);
    expect(result).toEqual(["ex-1", "ex-2"]);
  });

  it("matches a multi-topic exercise whose topicImpact includes the topic among others", () => {
    const exercises = [makeTextInputExercise("ex-multi", ["other", "T"])];
    const stats: Record<string, ExerciseStat> = {};
    const result = enqueueReviewItems(exercises, "T", stats, []);
    expect(result).toEqual(["ex-multi"]);
  });

  it("returns the current queue unchanged when no exercise impacts the topic", () => {
    const exercises = [makeTextInputExercise("ex-1", ["other"])];
    const stats: Record<string, ExerciseStat> = {};
    const result = enqueueReviewItems(exercises, "T", stats, ["ex-already-queued"]);
    expect(result).toEqual(["ex-already-queued"]);
  });
});
