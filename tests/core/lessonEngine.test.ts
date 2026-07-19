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
import * as theoryTutorModule from "../../src/core/agents/theoryTutor";
import * as rewardAdvisorModule from "../../src/core/agents/rewardAdvisor";
import * as progressAdvisorModule from "../../src/core/agents/progressAdvisor";
import * as parentReportGeneratorModule from "../../src/core/agents/parentReportGenerator";

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
  let theoryTutorSpy: ReturnType<typeof vi.spyOn>;
  let rewardAdvisorSpy: ReturnType<typeof vi.spyOn>;
  let progressAdvisorSpy: ReturnType<typeof vi.spyOn>;
  let parentReportGeneratorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    answerCheckerSpy = vi
      .spyOn(answerCheckerModule, "callAnswerChecker")
      .mockResolvedValue({ isCorrect: false, source: "core", errorType: "unknown" });
    // Plan 02 (THEORY-03, D-11): default every callTheoryTutor call to a
    // fast, deterministic agent-shaped result so tests unrelated to Theory
    // Tutor's own behavior (round-1 core-only assertions, "понятно" exit)
    // don't hit the real network — dedicated round-sequencing tests below
    // override this via mockResolvedValueOnce/mockResolvedValue.
    theoryTutorSpy = vi.spyOn(theoryTutorModule, "callTheoryTutor").mockResolvedValue({
      explanationRu: "Agent-simplified explanation",
      exampleRu: "Agent example",
      source: "agent",
    });
    // Plan 04-01 (REWARD-03, REWARD-04): default every callRewardAdvisor call
    // to the no-praise fallback shape so tests unrelated to Reward Advisor's
    // own behavior don't hit the real network — dedicated Reward Advisor
    // wiring tests below override this via mockResolvedValueOnce/mockResolvedValue.
    rewardAdvisorSpy = vi.spyOn(rewardAdvisorModule, "callRewardAdvisor").mockResolvedValue({
      suggestedReasons: [],
      celebrationRu: undefined,
      source: "core",
    });
    // Plan 04-03 (PERSONAL-01/02/03, REPORT-01/02): default every
    // callProgressAdvisor/callParentReportGenerator call to a fast,
    // deterministic agent-shaped result so tests unrelated to
    // handleSessionEnd's own behavior don't hit the real network — dedicated
    // session-end tests below override via mockResolvedValueOnce/mockResolvedValue.
    progressAdvisorSpy = vi.spyOn(progressAdvisorModule, "callProgressAdvisor").mockResolvedValue({
      recommendedFocus: "present_continuous_now",
      suggestedDifficulty: "normal",
      reviewSuggestions: [],
      motivationalMessageRu: "Ты молодец!",
      sessionAdvice: "continue",
      source: "agent",
    });
    parentReportGeneratorSpy = vi
      .spyOn(parentReportGeneratorModule, "callParentReportGenerator")
      .mockResolvedValue({
        parentReportRu: "Отчёт готов.",
        headlineRu: "Итоги урока",
        source: "agent",
      });
  });

  afterEach(() => {
    answerCheckerSpy.mockRestore();
    theoryTutorSpy.mockRestore();
    rewardAdvisorSpy.mockRestore();
    progressAdvisorSpy.mockRestore();
    parentReportGeneratorSpy.mockRestore();
  });

  it("theory: handleTheoryStep(true) dispatches theory_step and sets theoryUnderstood immediately, no agent call", async () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    await engine.handleTheoryStep(true);

    expect(store.getState().currentPosition.theoryUnderstood).toBe(true);
    expect(theoryTutorSpy).not.toHaveBeenCalled();
  });

  it("theory: save() fires via the dispatch (localStorage is written)", async () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    await engine.handleTheoryStep(true);

    expect(localStorage.getItem("english-quest-progress-v1")).toBeTruthy();
  });

  // Plan 02 (THEORY-03, D-11); UNCAPPED 2026-07-18: round 1 is core-only,
  // rounds 2+ call Theory Tutor via the gateway. There is no cap — "не понятно"
  // NEVER auto-advances to practice; only an explicit "понятно" does.
  describe("Plan 02: Theory Tutor round sequencing (THEORY-03, D-11)", () => {
    it("round 1 (simplifyRoundCount 0 -> 1): handleTheoryStep(false) does NOT call the agent; count becomes 1; theoryUnderstood stays false", async () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      await engine.handleTheoryStep(false);

      expect(theoryTutorSpy).not.toHaveBeenCalled();
      expect(store.getState().currentPosition.simplifyRoundCount).toBe(1);
      expect(store.getState().currentPosition.theoryUnderstood).toBe(false);
    });

    it("round 2 (simplifyRoundCount 1 -> 2): handleTheoryStep(false) calls callTheoryTutor; count becomes 2; theoryUnderstood stays false", async () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: {
          theoryUnderstood: false,
          currentExerciseIndex: 0,
          reviewPassIndex: 0,
          simplifyRoundCount: 1,
        },
      });
      const engine = new LessonEngine(lesson, store);

      await engine.handleTheoryStep(false);

      expect(theoryTutorSpy).toHaveBeenCalledTimes(1);
      expect(store.getState().currentPosition.simplifyRoundCount).toBe(2);
      expect(store.getState().currentPosition.theoryUnderstood).toBe(false);
    });

    it("round 3 (simplifyRoundCount 2 -> 3): handleTheoryStep(false) calls callTheoryTutor; count becomes 3; NO cap — theoryUnderstood stays false", async () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: {
          theoryUnderstood: false,
          currentExerciseIndex: 0,
          reviewPassIndex: 0,
          simplifyRoundCount: 2,
        },
      });
      const engine = new LessonEngine(lesson, store);

      await engine.handleTheoryStep(false);

      expect(theoryTutorSpy).toHaveBeenCalledTimes(1);
      expect(store.getState().currentPosition.simplifyRoundCount).toBe(3);
      // No cap (2026-07-18): "не понятно" never auto-advances to practice.
      expect(store.getState().currentPosition.theoryUnderstood).toBe(false);
    });

    it("high round (e.g. simplifyRoundCount 9 -> 10): still calls the agent for a new variant and never auto-transitions", async () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: {
          theoryUnderstood: false,
          currentExerciseIndex: 0,
          reviewPassIndex: 0,
          simplifyRoundCount: 9,
        },
      });
      const engine = new LessonEngine(lesson, store);

      await engine.handleTheoryStep(false);

      expect(theoryTutorSpy).toHaveBeenCalledTimes(1);
      expect(store.getState().currentPosition.simplifyRoundCount).toBe(10);
      expect(store.getState().currentPosition.theoryUnderstood).toBe(false);
    });

    it("feeds the previous on-screen explanation to the tutor as currentLevelText (fresh variant each round)", async () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: {
          theoryUnderstood: false,
          currentExerciseIndex: 0,
          reviewPassIndex: 0,
          simplifyRoundCount: 2,
        },
      });
      const engine = new LessonEngine(lesson, store);

      await engine.handleTheoryStep(false, {
        textRu: "Предыдущее объяснение с экрана.",
        exampleRu: "Previous example.",
      });

      expect(theoryTutorSpy).toHaveBeenCalledTimes(1);
      const arg = theoryTutorSpy.mock.calls[0][0];
      expect(arg.currentLevelText).toBe("Предыдущее объяснение с экрана.");
      expect(arg.fallbackLevel).toEqual({
        textRu: "Предыдущее объяснение с экрана.",
        exampleRu: "Previous example.",
      });
    });

    it("agent-failure round (Theory Tutor fallback): the round still counts, source:'core'/agentFailed:true, lesson never stalls", async () => {
      theoryTutorSpy.mockResolvedValueOnce({
        explanationRu: "Привычка или всегда → простое время: I eat.",
        exampleRu: "I eat at home. Now I am eating.",
        source: "core",
      });
      const store = new StateStore({
        ...initialState(),
        currentPosition: {
          theoryUnderstood: false,
          currentExerciseIndex: 0,
          reviewPassIndex: 0,
          simplifyRoundCount: 1,
        },
      });
      const engine = new LessonEngine(lesson, store);

      await engine.handleTheoryStep(false);

      expect(store.getState().currentPosition.simplifyRoundCount).toBe(2);
      expect(store.getState().currentPosition.theoryUnderstood).toBe(false);
    });

    it("'Понятно' at any round (e.g. mid-simplify at round 2) exits immediately, no agent call", async () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: {
          theoryUnderstood: false,
          currentExerciseIndex: 0,
          reviewPassIndex: 0,
          simplifyRoundCount: 1,
        },
      });
      const engine = new LessonEngine(lesson, store);

      await engine.handleTheoryStep(true);

      expect(theoryTutorSpy).not.toHaveBeenCalled();
      expect(store.getState().currentPosition.theoryUnderstood).toBe(true);
    });
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

  // Plan 04-01 (REWARD-03, REWARD-04, D-01/D-02/D-03/D-04): Reward Advisor
  // live per-answer wiring — one call per answer (not per event), only when
  // rewardEvents.length > 0, cross-checked against actually-granted reasons
  // before praiseRu is surfaced, amounts/rewardHistory unaffected either way.
  describe("Plan 04-01: Reward Advisor wiring (REWARD-03, REWARD-04)", () => {
    it("an answer producing multiple simultaneous reward events results in exactly ONE callRewardAdvisor call, receiving the full delta.rewardEvents array", async () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      // First correct answer on ex001 fires honest_attempt + first_try_correct
      // simultaneously — two reward events from one answer.
      await engine.handleAnswer("eq-1a-ex001", "He is working");

      expect(rewardAdvisorSpy).toHaveBeenCalledTimes(1);
      const callArg = rewardAdvisorSpy.mock.calls[0][0] as { rewardEvents: unknown[] };
      expect(callArg.rewardEvents.length).toBeGreaterThanOrEqual(2);
    });

    it("an answer producing zero reward events does NOT call callRewardAdvisor at all", async () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      // First incorrect attempt: honest_attempt fires (1 event) -> advisor called.
      await engine.handleAnswer("eq-1a-ex001", "is work");
      rewardAdvisorSpy.mockClear();

      // Second incorrect attempt on the SAME exercise: honest_attempt already
      // granted (deduped), not correct (no first_try/correct_after_hint),
      // streak resets to 0 both times (no streak_bonus) -> zero reward events.
      await engine.handleAnswer("eq-1a-ex001", "is work");

      expect(rewardAdvisorSpy).not.toHaveBeenCalled();
    });

    it("cross-check gate (REWARD-03): agent suggests a reason NOT present in this answer's actual rewardEvents -> resulting dispatch's praiseRu is undefined", async () => {
      rewardAdvisorSpy.mockResolvedValueOnce({
        suggestedReasons: ["streak_bonus"], // not granted for a first-ever correct answer
        celebrationRu: "Невероятная серия!",
        source: "agent",
      });
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      const result = await engine.handleAnswer("eq-1a-ex001", "He is working");

      expect(result.praiseRu).toBeUndefined();
    });

    it("trusted match: agent suggests a reason that DOES match one of this answer's granted rewardEvents -> praiseRu equals the agent's celebrationRu", async () => {
      rewardAdvisorSpy.mockResolvedValueOnce({
        suggestedReasons: ["first_try_correct"],
        celebrationRu: "Отлично, с первой попытки!",
        source: "agent",
      });
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      const result = await engine.handleAnswer("eq-1a-ex001", "He is working");

      expect(result.praiseRu).toBe("Отлично, с первой попытки!");
    });

    it("agent unavailable (REWARD-04): reward amounts/currentRewards total are unaffected, praiseRu is undefined", async () => {
      rewardAdvisorSpy.mockResolvedValueOnce({
        suggestedReasons: [],
        celebrationRu: undefined,
        source: "core",
      });
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      const result = await engine.handleAnswer("eq-1a-ex001", "He is working");

      const state = store.getState();
      expect(state.currentRewards).toBe(6); // identical to the pre-Phase-4 Phase 2 test's expected total
      expect(result.praiseRu).toBeUndefined();
    });

    it("single-dispatch invariant (Pitfall 3 precedent): an answer with reward events firing still results in exactly the same save() count as before this plan", async () => {
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
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0, simplifyRoundCount: 0 },
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
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0, simplifyRoundCount: 0 },
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
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0, simplifyRoundCount: 0 },
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
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0, simplifyRoundCount: 0 },
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
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0, simplifyRoundCount: 0 },
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
        currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0, simplifyRoundCount: 0 },
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

  // Plan 03 (05-03, gap closure): getCurrentSection() resolves the parent
  // Section for the current exercise (main pass or review pass), reusing
  // getCurrentExerciseId()'s existing resolution logic rather than
  // duplicating its main-pass/review-pass branching.
  describe("Plan 03 (05-03): getCurrentSection()", () => {
    it("main pass: returns the Section object containing exercises[currentExerciseIndex]", () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      const section = engine.getCurrentSection();

      expect(section).not.toBeNull();
      expect(section?.exercises.some((e) => e.exerciseId === "eq-1a-ex001")).toBe(true);
    });

    it("review pass: with reviewQueue[0] as the current exercise id, returns the Section that exercise originally belongs to", () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: {
          theoryUnderstood: true,
          currentExerciseIndex: 19,
          reviewPassIndex: 0,
          simplifyRoundCount: 0,
        },
        reviewQueue: ["eq-1a-ex010", "eq-1a-ex011"],
      });
      const engine = new LessonEngine(lesson, store);

      const section = engine.getCurrentSection();

      expect(section).not.toBeNull();
      expect(section?.exercises.some((e) => e.exerciseId === "eq-1a-ex010")).toBe(true);
    });

    it("lesson complete (getCurrentExerciseId() null): returns null", () => {
      const store = new StateStore({
        ...initialState(),
        currentPosition: {
          theoryUnderstood: true,
          currentExerciseIndex: 19,
          reviewPassIndex: 0,
          simplifyRoundCount: 0,
        },
        reviewQueue: [],
      });
      const engine = new LessonEngine(lesson, store);

      expect(engine.getCurrentSection()).toBeNull();
    });
  });

  // Plan 04-03 (PERSONAL-01/02/03, REPORT-01/02, D-06/D-07): handleSessionEnd()
  // sequential Progress Advisor -> guardrails -> Parent Report orchestration,
  // single session_end dispatch.
  describe("Plan 04-03: handleSessionEnd() session-end orchestration", () => {
    it("D-07 (THE critical case): callParentReportGenerator is invoked with recommendation equal to Progress Advisor's ALREADY-RESOLVED recommendedFocus, and only after callProgressAdvisor's promise resolved", async () => {
      const callOrder: string[] = [];
      progressAdvisorSpy.mockImplementationOnce(async () => {
        callOrder.push("progressAdvisor:start");
        await new Promise((resolve) => setTimeout(resolve, 5));
        callOrder.push("progressAdvisor:end");
        return {
          recommendedFocus: "food_vocabulary",
          suggestedDifficulty: "normal" as const,
          reviewSuggestions: [],
          motivationalMessageRu: "Ты молодец!",
          sessionAdvice: "continue" as const,
          source: "agent" as const,
        };
      });
      parentReportGeneratorSpy.mockImplementationOnce(async (input: unknown) => {
        callOrder.push("parentReport:start");
        return {
          parentReportRu: "Отчёт готов.",
          headlineRu: "Итоги урока",
          source: "agent" as const,
          _receivedRecommendation: (input as { recommendation: string }).recommendation,
        } as never;
      });

      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      await engine.handleSessionEnd();

      expect(callOrder).toEqual(["progressAdvisor:start", "progressAdvisor:end", "parentReport:start"]);
      const callArg = parentReportGeneratorSpy.mock.calls[0][0] as { recommendation: string };
      expect(callArg.recommendation).toBe("food_vocabulary");
    });

    it("PERSONAL-02 guardrail applied, not bypassed: Progress Advisor suggests 'challenge' while current mode is 'easy' (a two-step jump) -> resulting difficultyMode is capped to 'normal' (one step, per Plan 02's guardrail), NEVER 'challenge' directly, even when the upward gate (correctStreak >= 3) IS met", async () => {
      progressAdvisorSpy.mockResolvedValueOnce({
        recommendedFocus: "present_continuous_now",
        suggestedDifficulty: "challenge",
        reviewSuggestions: [],
        motivationalMessageRu: "Ты молодец!",
        sessionAdvice: "continue",
        source: "agent",
      });
      const store = new StateStore({
        ...initialState(),
        studentProfile: {
          studentId: "primary",
          confidenceScore: 0,
          difficultyMode: "easy",
          lastRecommendedFocus: null,
          motivationSignals: [],
        },
        // Upward gate IS met (correctStreak >= 3) — proves the guardrail caps
        // the two-step easy->challenge jump to one step (normal), it does NOT
        // prove "no signal still produces normal" (that combination is
        // impossible per difficultyGuardrails.test.ts's own "insufficient
        // signal, no other change" case, which correctly stays at `easy`).
        currentCorrectStreak: 3,
        currentErrorStreak: 0,
      });
      const engine = new LessonEngine(lesson, store);

      await engine.handleSessionEnd();

      expect(store.getState().studentProfile.difficultyMode).toBe("normal");
      expect(store.getState().studentProfile.difficultyMode).not.toBe("challenge");
    });

    it("PERSONAL-03: Progress Advisor unavailable (fallback-shaped, source:'core') still produces a valid recommendedFocus/difficultyMode decision, and progressAdvisorFailed is recorded", async () => {
      progressAdvisorSpy.mockResolvedValueOnce({
        recommendedFocus: "present_continuous_now",
        suggestedDifficulty: "normal",
        reviewSuggestions: [],
        motivationalMessageRu: "Ты молодец, продолжай в том же духе!",
        sessionAdvice: "continue",
        source: "core",
      });
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      const result = await engine.handleSessionEnd();

      expect(result.recommendedFocus).toBeTruthy();
      expect(result.suggestedDifficulty).toBeTruthy();
      expect(store.getState().studentProfile.difficultyMode).toBeTruthy();
      expect(store.getState().studentProfile.lastRecommendedFocus).toBeTruthy();
    });

    it("REPORT-02: Parent Report Generator unavailable (fallback-shaped, source:'core') -> deterministic template text is used and parentReportFailed is recorded", async () => {
      parentReportGeneratorSpy.mockResolvedValueOnce({
        parentReportRu: "Ребёнок выполнил 0 заданий, 0 верно. Даётся сложнее: нет. Повторить: нет. Заработано 0 ₽. Рекомендация: present_continuous_now.",
        headlineRu: "Итоги урока",
        source: "core",
      });
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      const result = await engine.handleSessionEnd();

      expect(result.parentReportRu).toBeTruthy();
      expect(result.parentReportRu.length).toBeGreaterThan(0);
    });

    it("single dispatch invariant: handleSessionEnd() results in exactly ONE additional localStorage.setItem call", async () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      setItemSpy.mockClear();

      await engine.handleSessionEnd();

      expect(setItemSpy).toHaveBeenCalledTimes(1);
      setItemSpy.mockRestore();
    });

    it("PERSONAL-03 (T-ogs-01/T-ogs-02): a hallucinated non-topic-id recommendedFocus from Progress Advisor is replaced by the deterministic fallback everywhere it flows — session_end dispatch, callParentReportGenerator's recommendation input, and the returned SessionEndResult", async () => {
      const hallucinated =
        "present_simple_question_order with question formation in real contexts (building on the strong foundation in present continuous)";
      progressAdvisorSpy.mockResolvedValueOnce({
        recommendedFocus: hallucinated,
        suggestedDifficulty: "normal",
        reviewSuggestions: [],
        motivationalMessageRu: "Ты молодец!",
        sessionAdvice: "continue",
        source: "agent",
      });
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      const result = await engine.handleSessionEnd();

      // No topicStats yet in a fresh initialState(), so the core's own
      // fallbackRecommendedFocus computation (lessonEngine.ts Step 1) resolves
      // to the generic "Продолжай практиковаться" string.
      const fallback = "Продолжай практиковаться";
      expect(store.getState().studentProfile.lastRecommendedFocus).toBe(fallback);
      expect(store.getState().studentProfile.lastRecommendedFocus).not.toBe(hallucinated);

      const callArg = parentReportGeneratorSpy.mock.calls[0][0] as { recommendation: string };
      expect(callArg.recommendation).toBe(fallback);
      expect(callArg.recommendation).not.toBe(hallucinated);

      expect(result.recommendedFocus).toBe(fallback);
      expect(result.recommendedFocus).not.toBe(hallucinated);
    });

    it("confidenceScore computed and persisted: matches computeConfidenceScore()'s formula applied to the session's actual exerciseStats/streaks", async () => {
      const store = new StateStore(initialState());
      const engine = new LessonEngine(lesson, store);

      await engine.handleSessionEnd();

      const confidenceScore = store.getState().studentProfile.confidenceScore;
      expect(typeof confidenceScore).toBe("number");
      expect(confidenceScore).toBeGreaterThanOrEqual(0);
      expect(confidenceScore).toBeLessThanOrEqual(1);
    });
  });
});
