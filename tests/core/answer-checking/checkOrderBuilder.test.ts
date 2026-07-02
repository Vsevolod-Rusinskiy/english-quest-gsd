import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OrderBuilderExerciseSchema } from "../../../src/core/lesson/lessonSchema";
import { checkOrderBuilder } from "../../../src/core/answer-checking/checkOrderBuilder";

const fixturePath = resolve(process.cwd(), "tests/fixtures/order-builder.fixture.json");
const rawFixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("order-builder.fixture.json", () => {
  it("validates against OrderBuilderExerciseSchema (Pitfall 1 — hand-authored, no real data)", () => {
    const result = OrderBuilderExerciseSchema.safeParse(rawFixture);
    expect(result.success).toBe(true);
  });
});

const exercise = OrderBuilderExerciseSchema.parse(rawFixture);

describe("checkOrderBuilder", () => {
  it("marks the exact correct order as correct", () => {
    expect(checkOrderBuilder(exercise, ["What", "are", "you", "doing", "tonight"])).toEqual({
      isCorrect: true,
      source: "core",
    });
  });

  it("marks a wrong order as incorrect", () => {
    expect(checkOrderBuilder(exercise, ["What", "you", "are", "doing", "tonight"])).toEqual({
      isCorrect: false,
      source: "core",
    });
  });

  it("marks a sequence missing a token as incorrect", () => {
    expect(checkOrderBuilder(exercise, ["What", "are", "you", "doing"])).toEqual({
      isCorrect: false,
      source: "core",
    });
  });

  it("marks a sequence with an extra token as incorrect", () => {
    expect(
      checkOrderBuilder(exercise, ["What", "are", "you", "doing", "tonight", "extra"]),
    ).toEqual({ isCorrect: false, source: "core" });
  });
});
