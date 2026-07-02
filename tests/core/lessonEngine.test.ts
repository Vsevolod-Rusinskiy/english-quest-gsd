import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  LessonSchema,
  SingleChoiceExerciseSchema,
  OrderBuilderExerciseSchema,
} from "../../src/core/lesson/lessonSchema";
import { LessonEngine } from "../../src/core/lessonEngine";
import { StateStore } from "../../src/core/state/store";
import { initialState } from "../../src/core/state/initialState";
import { load } from "../../src/core/state/persistence";
import * as answerCheckerModule from "../../src/core/agents/answerChecker";

const lessonPath = resolve(process.cwd(), "public/Lesson-1A.json");
const realLesson1A = JSON.parse(readFileSync(lessonPath, "utf-8"));
const lesson = LessonSchema.parse(realLesson1A);

// Real Lesson-1A.json has zero single-choice/order-builder exercises (Pitfall 1) —
// build a lesson variant that injects the Plan 02 fixtures so handleAnswer's routing
// for those two types is proven against a real LessonEngine instance, not just the
// standalone checker functions.
const singleChoiceFixture = SingleChoiceExerciseSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/single-choice.fixture.json"), "utf-8")),
);
const orderBuilderFixture = OrderBuilderExerciseSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/order-builder.fixture.json"), "utf-8")),
);
const lessonWithFixtureTypes = {
  ...lesson,
  sections: [
    ...lesson.sections,
    {
      sectionId: "fixture-section",
      title: "Fixture Section",
      instructionRu: "",
      instructionEn: "",
      skill: "mixed",
      imagePolicy: "none",
      exercises: [singleChoiceFixture, orderBuilderFixture],
    },
  ],
};

describe("LessonEngine", () => {
  // Plan 03: default every callAnswerChecker call to a fast, deterministic
  // fallback-shaped result so tests unrelated to Answer Checker behavior
  // (Phase 2 progress/reward wiring, review-pass cursor) don't hit the real
  // network or wait on the gateway's retry/timeout — individual Answer
  // Checker tests below override this via mockResolvedValueOnce/mockResolvedValue.
  let answerCheckerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    answerCheckerSpy = vi
      .spyOn(answerCheckerModule, "callAnswerChecker")
      .mockResolvedValue({ isCorrect: false, source: "core", errorType: "unknown" });
  });

  afterEach(() => {
    answerCheckerSpy.mockRestore();
  });

  it("theory: handleTheoryStep(true) dispatches theory_step and sets theoryUnderstood", async () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    await engine.handleTheoryStep(true);

    expect(store.getState().currentPosition.theoryUnderstood).toBe(true);
  });

  it("theory: handleTheoryStep(false) also advances (no Theory Tutor branch in Phase 1)", async () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    await engine.handleTheoryStep(false);

    expect(store.getState().currentPosition.theoryUnderstood).toBe(true);
  });

  it("theory: save() fires via the dispatch (localStorage is written)", async () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    await engine.handleTheoryStep(true);

    expect(localStorage.getItem("english-quest-progress-v1")).toBeTruthy();
  });

  it("handleAnswer routes text-input exercises to checkTextInput and advances on correct", async () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    const result = await engine.handleAnswer("eq-1a-ex001", "He is working");

    expect(result).toEqual({ isCorrect: true, source: "core" });
    expect(store.getState().currentPosition.currentExerciseIndex).toBe(1);
  });

  it("handleAnswer does not advance position on incorrect answer, and routes the ambiguous answer to Answer Checker (CHECK-03)", async () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    const result = await engine.handleAnswer("eq-1a-ex001", "is work");

    // The module-level answerCheckerSpy (beforeEach above) stubs
    // callAnswerChecker to the fallback shape for tests not specifically
    // exercising Answer Checker behavior — see "Plan 03: Answer Checker
    // wiring" below for the dedicated agent-success/agent-fallback cases.
    expect(result.isCorrect).toBe(false);
    expect(store.getState().currentPosition.currentExerciseIndex).toBe(0);
  });

  it("exposes a flattened exercise list totaling 19", () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    expect(engine.totalExercises).toBe(19);
  });

  it("handleAnswer routes matching exercises (ex019) to checkMatching and advances on a full correct pair set", async () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    // Advance the store position directly to ex019's index so handleAnswer's
    // advance_position dispatch is meaningful (routing correctness is what's under
    // test here, not full traversal — see fullLessonTraversal.test.ts for that).
    const matchingExercise = engine.exercises.find((e) => e.exerciseId === "eq-1a-ex019");
    if (!matchingExercise || matchingExercise.type !== "matching") {
      throw new Error("Test setup error: eq-1a-ex019 not found or not type matching");
    }

    const correctPairs = matchingExercise.answerCheck.pairs;
    const result = await engine.handleAnswer("eq-1a-ex019", correctPairs);

    expect(result).toEqual({ isCorrect: true, source: "core" });
  });

  it("handleAnswer routes single-choice exercises to checkSingleChoice and advances on correct (CHECK-02, no agent)", async () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lessonWithFixtureTypes, store);

    const result = await engine.handleAnswer(singleChoiceFixture.exerciseId, "option-eggs");

    expect(result).toEqual({ isCorrect: true, source: "core" });
  });

  it("handleAnswer routes order-builder exercises to checkOrderBuilder and advances on correct (CHECK-02, no agent)", async () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lessonWithFixtureTypes, store);

    const result = await engine.handleAnswer(
      orderBuilderFixture.exerciseId,
      orderBuilderFixture.answerCheck.correctOrder,
    );

    expect(result).toEqual({ isCorrect: true, source: "core" });
  });

  // Plan 03 (CHECK-03, D-09, D-10): Answer Checker wiring via DI mock —
  // proves the gateway path is actually invoked for a non-exact-match
  // text-input answer, its result flows into evaluateAttempt/dispatch, and
  // non-text-input types never call it.
  describe("Plan 03: Answer Checker wiring (CHECK-03, D-10)", () => {
    it("exact-match text-input answer never calls callAnswerChecker and dispatches source:'core'", async () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      await engine.handleAnswer("eq-1a-ex001", "He is working");

      expect(answerCheckerSpy).not.toHaveBeenCalled();
      expect(store.getState().exerciseStats["eq-1a-ex001"]).toMatchObject({
        lastAttemptSource: "core",
        lastAttemptAgentFailed: false,
      });
    });

    it("non-exact-match text-input answer calls callAnswerChecker and folds its errorType/source into evaluateAttempt + dispatch", async () => {
      answerCheckerSpy.mockResolvedValueOnce({
        isCorrect: false,
        source: "agent",
        errorType: "missed_article",
        confidence: 0.7,
        hintRu: "Не забудь артикль.",
      });
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      const result = await engine.handleAnswer("eq-1a-ex001", "is work");

      expect(answerCheckerSpy).toHaveBeenCalledTimes(1);
      expect(result.source).toBe("agent");
      expect(result.errorType).toBe("missed_article");
      expect(store.getState().exerciseStats["eq-1a-ex001"]).toMatchObject({
        lastAttemptSource: "agent",
        lastAttemptAgentFailed: false,
      });
    });

    it("Answer Checker fallback (agent failed) dispatches source:'core', agentFailed:true", async () => {
      answerCheckerSpy.mockResolvedValueOnce({
        isCorrect: false,
        source: "core",
        errorType: "unknown",
      });
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      await engine.handleAnswer("eq-1a-ex001", "is work");

      expect(store.getState().exerciseStats["eq-1a-ex001"]).toMatchObject({
        lastAttemptSource: "core",
        lastAttemptAgentFailed: true,
      });
    });

    it("non-text-input types (single-choice, order-builder) never call the agent (D-10)", async () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lessonWithFixtureTypes, store);

      await engine.handleAnswer(singleChoiceFixture.exerciseId, "wrong-option");
      await engine.handleAnswer(orderBuilderFixture.exerciseId, ["wrong", "order"]);

      expect(answerCheckerSpy).not.toHaveBeenCalled();
    });
  });

  // Phase 2 (PROGRESS-01/02/03, REWARD-01/02): handleAnswer now drives
  // evaluateAttempt() and folds the result into the same exercise_attempt
  // dispatch (Pitfall 3).
  describe("Phase 2: progress/reward wiring", () => {
    it("integration, topic stats: a correct answer updates topicStats for the exercise's topicImpact topic", async () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      await engine.handleAnswer("eq-1a-ex001", "He is working");

      const topicStat = store.getState().topicStats["present_continuous_now"];
      expect(topicStat).toBeDefined();
      expect(topicStat.attempts).toBe(1);
      expect(topicStat.correct).toBe(1);
    });

    it("integration, rewards: a first correct answer appends honest_attempt + first_try_correct and increases currentRewards by 6", async () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      await engine.handleAnswer("eq-1a-ex001", "He is working");

      const state = store.getState();
      const reasons = state.rewardHistory.map((e) => e.reason);
      expect(reasons).toContain("honest_attempt");
      expect(reasons).toContain("first_try_correct");
      expect(state.currentRewards).toBe(6);
    });

    it("integration, review queue: two incorrect answers on the same exercise flip its topic to needs_review and enqueue", async () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      await engine.handleAnswer("eq-1a-ex001", "is work"); // 1st incorrect
      await engine.handleAnswer("eq-1a-ex001", "is work"); // 2nd incorrect

      const state = store.getState();
      expect(state.topicStats["present_continuous_now"].status).toBe("needs_review");
      expect(state.reviewQueue).toContain("eq-1a-ex001");
    });

    it("Pitfall 3 single-save guard: incorrect answer -> exactly 1 save(); correct answer -> exactly 2 saves()", async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      const storeIncorrect = new StateStore(initialState());
      const engineIncorrect = new LessonEngine(lesson, storeIncorrect);
      setItemSpy.mockClear();
      await engineIncorrect.handleAnswer("eq-1a-ex001", "is work");
      expect(setItemSpy).toHaveBeenCalledTimes(1);

      const storeCorrect = new StateStore(initialState());
      const engineCorrect = new LessonEngine(lesson, storeCorrect);
      setItemSpy.mockClear();
      await engineCorrect.handleAnswer("eq-1a-ex001", "He is working");
      expect(setItemSpy).toHaveBeenCalledTimes(2);

      setItemSpy.mockRestore();
    });

    it("attemptNumber: a correct answer after one wrong attempt records attemptNumber 2 and grants correct_after_hint, not first_try_correct", async () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      await engine.handleAnswer("eq-1a-ex001", "is work"); // wrong, attemptNumber 1
      await engine.handleAnswer("eq-1a-ex001", "He is working"); // correct, attemptNumber 2

      const state = store.getState();
      const recovery = state.rewardHistory.find((e) => e.reason === "correct_after_hint");
      expect(recovery).toBeDefined();
      expect(recovery?.attemptNumber).toBe(2);
      expect(state.rewardHistory.find((e) => e.reason === "first_try_correct")).toBeUndefined();
    });
  });

  // Plan 03 (PROGRESS-04, D-02, Pitfall 4): review-pass cursor — getCurrentExerciseId/
  // getCurrentExercise/isReviewPass, dequeue-on-completion, no array mutation, persist/resume.
  describe("Phase 2 Plan 03: review-pass cursor", () => {
    it("getCurrentExerciseId (main pass): with reviewQueue empty and currentExerciseIndex mid-lesson, returns the main-sequence exercise id at that index", async () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      // Advance to index 2 via two correct answers.
      await engine.handleAnswer("eq-1a-ex001", "He is working");
      await engine.handleAnswer("eq-1a-ex002", "Do you usually get up");

      expect(store.getState().currentPosition.currentExerciseIndex).toBe(2);
      expect(store.getState().reviewQueue).toEqual([]);
      expect(engine.getCurrentExerciseId()).toBe(engine.exercises[2].exerciseId);
      expect(engine.isReviewPass()).toBe(false);
    });

    it("getCurrentExerciseId (review pass): with currentExerciseIndex past the last main exercise and reviewQueue non-empty, returns reviewQueue[0]", () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0 },
        reviewQueue: ["eq-1a-ex010", "eq-1a-ex011"],
      });
      const engine = new LessonEngine(lesson, store);

      expect(engine.getCurrentExerciseId()).toBe("eq-1a-ex010");
      expect(engine.getCurrentExercise()?.exerciseId).toBe("eq-1a-ex010");
      expect(engine.isReviewPass()).toBe(true);
    });

    it("isInReviewPass / complete: true iff currentExerciseIndex >= totalExercises && reviewQueue.length > 0; queue exhausted -> lesson complete", () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0 },
        reviewQueue: [],
      });
      const engine = new LessonEngine(lesson, store);

      expect(engine.isReviewPass()).toBe(false); // queue empty -> not review pass, lesson complete
      expect(engine.getCurrentExerciseId()).toBeNull();
      expect(engine.getCurrentExercise()).toBeNull();
    });

    it("dequeue on correct: answering the current review exercise correctly removes it from reviewQueue in one dispatch", async () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0 },
        reviewQueue: ["eq-1a-ex010", "eq-1a-ex011"],
      });
      const engine = new LessonEngine(lesson, store);

      const result = await engine.handleAnswer("eq-1a-ex010", "meat");

      expect(result.isCorrect).toBe(true);
      expect(store.getState().reviewQueue).toEqual(["eq-1a-ex011"]);
      // Review pass never advances currentExerciseIndex (dequeue IS the advance).
      expect(store.getState().currentPosition.currentExerciseIndex).toBe(19);
    });

    it("dequeue on incorrect (D-02): answering the current review exercise incorrectly ALSO removes it and is NOT immediately re-added", async () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0 },
        reviewQueue: ["eq-1a-ex010", "eq-1a-ex011"],
        // Pre-seed topicStats so this single wrong answer does not itself
        // re-trigger a fresh entered_needs_review enqueue for food_vocabulary.
        topicStats: {
          food_vocabulary: { status: "needs_review", attempts: 2, correct: 0, errors: 2, correctStreak: 0 },
        },
      });
      const engine = new LessonEngine(lesson, store);

      const result = await engine.handleAnswer("eq-1a-ex010", "wrong-answer");

      expect(result.isCorrect).toBe(false);
      expect(store.getState().reviewQueue).toEqual(["eq-1a-ex011"]);
      expect(store.getState().reviewQueue).not.toContain("eq-1a-ex010");
    });

    it("persist/resume (PERSIST-02): reviewPassIndex and shrunken reviewQueue survive save()/load()", async () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0 },
        reviewQueue: ["eq-1a-ex010", "eq-1a-ex011"],
      });
      const engine = new LessonEngine(lesson, store);

      await engine.handleAnswer("eq-1a-ex010", "meat"); // dequeues ex010, save() fires synchronously

      const reloaded = load(lesson.lessonId);
      expect(reloaded.reviewQueue).toEqual(["eq-1a-ex011"]);
      expect(reloaded.currentPosition.reviewPassIndex).toBe(0);

      const resumedStore = new StateStore(reloaded);
      const resumedEngine = new LessonEngine(lesson, resumedStore);
      expect(resumedEngine.getCurrentExerciseId()).toBe("eq-1a-ex011");
    });

    it("no array mutation (Pitfall 4): engine.exercises.length stays === totalExercises throughout a review pass", async () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0 },
        reviewQueue: ["eq-1a-ex010", "eq-1a-ex011"],
      });
      const engine = new LessonEngine(lesson, store);
      const before = engine.exercises.length;

      await engine.handleAnswer("eq-1a-ex010", "meat");
      await engine.handleAnswer("eq-1a-ex011", "raw");

      expect(engine.exercises.length).toBe(before);
      expect(engine.exercises.length).toBe(19);
    });
  });
});
