import { describe, it, expect, beforeEach } from "vitest";
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
  beforeEach(() => {
    localStorage.clear();
  });

  it("theory: handleTheoryStep(true) dispatches theory_step and sets theoryUnderstood", () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    engine.handleTheoryStep(true);

    expect(store.getState().currentPosition.theoryUnderstood).toBe(true);
  });

  it("theory: handleTheoryStep(false) also advances (no Theory Tutor branch in Phase 1)", () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    engine.handleTheoryStep(false);

    expect(store.getState().currentPosition.theoryUnderstood).toBe(true);
  });

  it("theory: save() fires via the dispatch (localStorage is written)", () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    engine.handleTheoryStep(true);

    expect(localStorage.getItem("english-quest-progress-v1")).toBeTruthy();
  });

  it("handleAnswer routes text-input exercises to checkTextInput and advances on correct", () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    const result = engine.handleAnswer("eq-1a-ex001", "He is working");

    expect(result).toEqual({ isCorrect: true, source: "core" });
    expect(store.getState().currentPosition.currentExerciseIndex).toBe(1);
  });

  it("handleAnswer does not advance position on incorrect answer", () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    const result = engine.handleAnswer("eq-1a-ex001", "is work");

    expect(result).toEqual({ isCorrect: false, source: "core" });
    expect(store.getState().currentPosition.currentExerciseIndex).toBe(0);
  });

  it("exposes a flattened exercise list totaling 19", () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lesson, store);

    expect(engine.totalExercises).toBe(19);
  });

  it("handleAnswer routes matching exercises (ex019) to checkMatching and advances on a full correct pair set", () => {
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
    const result = engine.handleAnswer("eq-1a-ex019", correctPairs);

    expect(result).toEqual({ isCorrect: true, source: "core" });
  });

  it("handleAnswer routes single-choice exercises to checkSingleChoice and advances on correct (CHECK-02, no agent)", () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lessonWithFixtureTypes, store);

    const result = engine.handleAnswer(singleChoiceFixture.exerciseId, "option-eggs");

    expect(result).toEqual({ isCorrect: true, source: "core" });
  });

  it("handleAnswer routes order-builder exercises to checkOrderBuilder and advances on correct (CHECK-02, no agent)", () => {
    const store = new StateStore(initialState());
    const engine = new LessonEngine(lessonWithFixtureTypes, store);

    const result = engine.handleAnswer(
      orderBuilderFixture.exerciseId,
      orderBuilderFixture.answerCheck.correctOrder,
    );

    expect(result).toEqual({ isCorrect: true, source: "core" });
  });
});
