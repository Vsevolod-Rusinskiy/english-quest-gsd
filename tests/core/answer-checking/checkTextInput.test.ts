import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LessonSchema } from "../../../src/core/lesson/lessonSchema";
import { checkTextInput } from "../../../src/core/answer-checking/checkTextInput";

const lessonPath = resolve(process.cwd(), "Lesson-1A.json");
const realLesson1A = JSON.parse(readFileSync(lessonPath, "utf-8"));
const lesson = LessonSchema.parse(realLesson1A);
const ex001 = lesson.sections
  .flatMap((s) => s.exercises)
  .find((e) => e.exerciseId === "eq-1a-ex001");
if (!ex001 || ex001.type !== "text-input") {
  throw new Error("Fixture assumption failed: eq-1a-ex001 must be a text-input exercise");
}

describe("checkTextInput", () => {
  it("marks 'He is working' as correct", () => {
    expect(checkTextInput(ex001, "He is working")).toEqual({ isCorrect: true, source: "core" });
  });

  it("marks 'is working' as correct", () => {
    expect(checkTextInput(ex001, "is working")).toEqual({ isCorrect: true, source: "core" });
  });

  it("marks 'is work' as incorrect", () => {
    expect(checkTextInput(ex001, "is work")).toEqual({ isCorrect: false, source: "core" });
  });

  it("compares via exact equality only, not fuzzy matching", () => {
    expect(checkTextInput(ex001, "he's working")).toEqual({ isCorrect: true, source: "core" });
    expect(checkTextInput(ex001, "he is wroking")).toEqual({ isCorrect: false, source: "core" });
  });
});
