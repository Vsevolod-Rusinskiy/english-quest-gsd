import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LessonSchema } from "../../../src/core/lesson/lessonSchema";
import { checkMatching } from "../../../src/core/answer-checking/checkMatching";

const lessonPath = resolve(process.cwd(), "public/Lesson-1A.json");
const realLesson1A = JSON.parse(readFileSync(lessonPath, "utf-8"));
const lesson = LessonSchema.parse(realLesson1A);
const ex019 = lesson.sections
  .flatMap((s) => s.exercises)
  .find((e) => e.exerciseId === "eq-1a-ex019");
if (!ex019 || ex019.type !== "matching") {
  throw new Error("Fixture assumption failed: eq-1a-ex019 must be a matching exercise");
}

const correctPairs = ex019.answerCheck.pairs;

describe("checkMatching (real ex019 — 8-pair restaurant matching)", () => {
  it("marks the complete correct mapping as correct", () => {
    expect(checkMatching(ex019, correctPairs)).toEqual({ isCorrect: true, source: "core" });
  });

  it("marks a swapped pair (picture-1 -> fork instead of knife) as incorrect", () => {
    const userPairs = correctPairs.map((p) =>
      p.leftId === "picture-1" ? { leftId: "picture-1", rightId: "fork" } : p,
    );
    expect(checkMatching(ex019, userPairs)).toEqual({ isCorrect: false, source: "core" });
  });

  it("marks a missing pair as incorrect", () => {
    const userPairs = correctPairs.filter((p) => p.leftId !== "picture-8");
    expect(checkMatching(ex019, userPairs)).toEqual({ isCorrect: false, source: "core" });
  });

  it("marks an extra/unexpected pair as incorrect", () => {
    const userPairs = [...correctPairs, { leftId: "picture-9", rightId: "extra" }];
    expect(checkMatching(ex019, userPairs)).toEqual({ isCorrect: false, source: "core" });
  });

  it("is order-independent (shuffled correct pairs still pass)", () => {
    const shuffled = [...correctPairs].reverse();
    expect(checkMatching(ex019, shuffled)).toEqual({ isCorrect: true, source: "core" });
  });
});
