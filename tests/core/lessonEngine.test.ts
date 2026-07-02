import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LessonSchema } from "../../src/core/lesson/lessonSchema";
import { LessonEngine } from "../../src/core/lessonEngine";
import { StateStore } from "../../src/core/state/store";
import { initialState } from "../../src/core/state/initialState";

const lessonPath = resolve(process.cwd(), "Lesson-1A.json");
const realLesson1A = JSON.parse(readFileSync(lessonPath, "utf-8"));
const lesson = LessonSchema.parse(realLesson1A);

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
});
