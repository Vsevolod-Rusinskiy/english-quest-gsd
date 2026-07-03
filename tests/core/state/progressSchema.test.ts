import { describe, it, expect, beforeEach } from "vitest";
import {
  TopicStatSchema,
  TopicStatusSchema,
  RewardEventSchema,
  RewardReasonSchema,
  CurrentPositionSchema,
  WordStatSchema,
  ExerciseTypeStatSchema,
  DifficultyModeSchema,
  StudentProfileSchema,
} from "../../../src/core/state/progressSchema";
import { load, save, PROGRESS_KEY } from "../../../src/core/state/persistence";
import { initialState } from "../../../src/core/state/initialState";

describe("progressSchema", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("TopicStatSchema", () => {
    it("accepts a fully-shaped topic stat object", () => {
      const result = TopicStatSchema.safeParse({
        status: "in_progress",
        attempts: 2,
        correct: 1,
        errors: 1,
        correctStreak: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects an object missing a required field", () => {
      const result = TopicStatSchema.safeParse({
        status: "in_progress",
        attempts: 2,
        correct: 1,
        errors: 1,
        // correctStreak missing
      });
      expect(result.success).toBe(false);
    });

    it("rejects an object with an extra-typed (wrong-type) field", () => {
      const result = TopicStatSchema.safeParse({
        status: "in_progress",
        attempts: "2", // wrong type, should be number
        correct: 1,
        errors: 1,
        correctStreak: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("RewardEventSchema", () => {
    it("accepts a full reward event", () => {
      const result = RewardEventSchema.safeParse({
        rewardEventId: "evt-1",
        exerciseId: "eq-1a-ex001",
        reason: "first_try_correct",
        amount: 5,
        attemptNumber: 1,
        createdAt: "2026-07-02T12:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an out-of-set reason", () => {
      const result = RewardEventSchema.safeParse({
        rewardEventId: "evt-1",
        exerciseId: "eq-1a-ex001",
        reason: "not_a_real_reason",
        amount: 5,
        attemptNumber: 1,
        createdAt: "2026-07-02T12:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("TopicStatusSchema", () => {
    it("accepts exactly the four D-06 status values", () => {
      for (const status of ["not_started", "in_progress", "needs_review", "mastered"]) {
        expect(TopicStatusSchema.safeParse(status).success).toBe(true);
      }
    });

    it("rejects a Russian-label value not in the enum", () => {
      expect(TopicStatusSchema.safeParse("Повторить").success).toBe(false);
    });
  });

  describe("RewardReasonSchema", () => {
    it("accepts exactly the 6 SPEC §10 reasons", () => {
      const reasons = [
        "honest_attempt",
        "first_try_correct",
        "correct_after_hint",
        "fixed_mistake",
        "streak_bonus",
        "weak_topic_closed",
      ];
      for (const reason of reasons) {
        expect(RewardReasonSchema.safeParse(reason).success).toBe(true);
      }
    });

    it("rejects a reason not in the set", () => {
      expect(RewardReasonSchema.safeParse("bonus_round").success).toBe(false);
    });
  });

  describe("Pitfall 1: legacy Phase-1-shaped blob resets on load", () => {
    it("resets to initialState() when topicStats/currentCorrectStreak are missing", () => {
      const phase1Blob = {
        studentProfile: { studentId: "primary" },
        lessonId: "lesson-1a",
        lessonHistory: [],
        exerciseStats: {},
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 3 },
        currentRewards: 5,
        rewardHistory: [],
        reviewQueue: [],
        // topicStats and currentCorrectStreak deliberately absent (Phase 1 shape)
      };
      localStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({ schemaVersion: 1, data: phase1Blob }),
      );
      const loaded = load("lesson-1a");
      expect(loaded).toEqual(initialState("lesson-1a"));
    });
  });

  describe("initialState()", () => {
    it("seeds topicStats: {} and currentCorrectStreak: 0 alongside existing fields", () => {
      const state = initialState();
      expect(state.topicStats).toEqual({});
      expect(state.currentCorrectStreak).toBe(0);
    });

    it("round-trips through save/load with the new fields intact", () => {
      const state = initialState();
      state.topicStats = {
        present_continuous_now: { status: "in_progress", attempts: 1, correct: 1, errors: 0, correctStreak: 1 },
      };
      state.currentCorrectStreak = 2;
      save(state);
      const loaded = load();
      expect(loaded).toEqual(state);
    });

    it("seeds simplifyRoundCount: 0 in currentPosition (Plan 02, D-11)", () => {
      const state = initialState();
      expect(state.currentPosition.simplifyRoundCount).toBe(0);
    });
  });

  describe("WordStatSchema (Phase 4 Plan 02, PERSONAL-01, D-11)", () => {
    it("accepts a fully-shaped word stat object", () => {
      const result = WordStatSchema.safeParse({ attempts: 2, correct: 1, errors: 1 });
      expect(result.success).toBe(true);
    });

    it("rejects an object missing a required field", () => {
      const result = WordStatSchema.safeParse({ attempts: 2, correct: 1 });
      expect(result.success).toBe(false);
    });
  });

  describe("ExerciseTypeStatSchema (Phase 4 Plan 02)", () => {
    it("accepts a fully-shaped exercise-type stat object", () => {
      const result = ExerciseTypeStatSchema.safeParse({ attempts: 3, correct: 2 });
      expect(result.success).toBe(true);
    });

    it("rejects an object missing a required field", () => {
      const result = ExerciseTypeStatSchema.safeParse({ attempts: 3 });
      expect(result.success).toBe(false);
    });
  });

  describe("DifficultyModeSchema (Phase 4 Plan 02, PERSONAL-02)", () => {
    it("accepts exactly the 3 SPEC §12 difficulty values", () => {
      for (const mode of ["easy", "normal", "challenge"]) {
        expect(DifficultyModeSchema.safeParse(mode).success).toBe(true);
      }
    });

    it("rejects a value outside the enum", () => {
      expect(DifficultyModeSchema.safeParse("hard").success).toBe(false);
    });
  });

  describe("StudentProfileSchema extensions (Phase 4 Plan 02, PERSONAL-01/02/03)", () => {
    it("accepts a fully-shaped extended student profile", () => {
      const result = StudentProfileSchema.safeParse({
        studentId: "primary",
        confidenceScore: 0.5,
        difficultyMode: "normal",
        lastRecommendedFocus: null,
        motivationSignals: ["long_session"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts lastRecommendedFocus as a string", () => {
      const result = StudentProfileSchema.safeParse({
        studentId: "primary",
        confidenceScore: 0.5,
        difficultyMode: "normal",
        lastRecommendedFocus: "present_continuous_now",
        motivationSignals: [],
      });
      expect(result.success).toBe(true);
    });

    it("rejects a profile missing confidenceScore/difficultyMode/lastRecommendedFocus/motivationSignals", () => {
      const result = StudentProfileSchema.safeParse({ studentId: "primary" });
      expect(result.success).toBe(false);
    });
  });

  describe("CurrentPositionSchema: simplifyRoundCount (Plan 02, D-11, Open Question 2)", () => {
    it("accepts a currentPosition with simplifyRoundCount: 2 and round-trips it", () => {
      const result = CurrentPositionSchema.safeParse({
        theoryUnderstood: false,
        currentExerciseIndex: 0,
        reviewPassIndex: 0,
        simplifyRoundCount: 2,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.simplifyRoundCount).toBe(2);
      }
    });

    it("rejects a currentPosition missing simplifyRoundCount (required, resets via load() like reviewPassIndex)", () => {
      const result = CurrentPositionSchema.safeParse({
        theoryUnderstood: false,
        currentExerciseIndex: 0,
        reviewPassIndex: 0,
        // simplifyRoundCount deliberately absent
      });
      expect(result.success).toBe(false);
    });

    it("a stored blob whose currentPosition is missing simplifyRoundCount fails ProgressStateSchema.safeParse and resets via load()", () => {
      const legacyBlob = {
        ...initialState("lesson-1a"),
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 3, reviewPassIndex: 0 },
      };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ schemaVersion: 1, data: legacyBlob }));
      const loaded = load("lesson-1a");
      expect(loaded).toEqual(initialState("lesson-1a"));
    });
  });

  describe("initialState() Phase 4 Plan 02 seeding (wordStats/exerciseTypeStats/currentErrorStreak/studentProfile)", () => {
    it("seeds wordStats: {}, exerciseTypeStats: {}, currentErrorStreak: 0", () => {
      const state = initialState();
      expect(state.wordStats).toEqual({});
      expect(state.exerciseTypeStats).toEqual({});
      expect(state.currentErrorStreak).toBe(0);
    });

    it("seeds the extended studentProfile fields (confidenceScore: 0, difficultyMode: normal, lastRecommendedFocus: null, motivationSignals: [])", () => {
      const state = initialState();
      expect(state.studentProfile.confidenceScore).toBe(0);
      expect(state.studentProfile.difficultyMode).toBe("normal");
      expect(state.studentProfile.lastRecommendedFocus).toBeNull();
      expect(state.studentProfile.motivationSignals).toEqual([]);
    });

    it("round-trips through save/load with the new Phase 4 fields intact", () => {
      const state = initialState();
      state.wordStats = { meat: { attempts: 1, correct: 1, errors: 0 } };
      state.exerciseTypeStats = { "text-input": { attempts: 1, correct: 1 } };
      state.currentErrorStreak = 1;
      state.studentProfile = {
        studentId: "primary",
        confidenceScore: 0.6,
        difficultyMode: "challenge",
        lastRecommendedFocus: "present_continuous_now",
        motivationSignals: ["streak"],
      };
      save(state);
      const loaded = load();
      expect(loaded).toEqual(state);
    });
  });
});
