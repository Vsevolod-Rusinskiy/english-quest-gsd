import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SingleChoiceExerciseSchema } from "../../../src/core/lesson/lessonSchema";
import { checkSingleChoice } from "../../../src/core/answer-checking/checkSingleChoice";

const fixturePath = resolve(process.cwd(), "tests/fixtures/single-choice.fixture.json");
const rawFixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("single-choice.fixture.json", () => {
  it("validates against SingleChoiceExerciseSchema (Pitfall 1 — hand-authored, no real data)", () => {
    const result = SingleChoiceExerciseSchema.safeParse(rawFixture);
    expect(result.success).toBe(true);
  });
});

const exercise = SingleChoiceExerciseSchema.parse(rawFixture);

describe("checkSingleChoice", () => {
  it("marks the correct option id as correct", () => {
    expect(checkSingleChoice(exercise, "option-eggs")).toEqual({ isCorrect: true, source: "core" });
  });

  it("marks any other option id as incorrect", () => {
    expect(checkSingleChoice(exercise, "option-napkin")).toEqual({ isCorrect: false, source: "core" });
    expect(checkSingleChoice(exercise, "option-glass")).toEqual({ isCorrect: false, source: "core" });
  });

  it("marks an unrecognized/empty option id as incorrect, not throwing", () => {
    expect(checkSingleChoice(exercise, "")).toEqual({ isCorrect: false, source: "core" });
    expect(checkSingleChoice(exercise, "not-a-real-option")).toEqual({ isCorrect: false, source: "core" });
  });
});
