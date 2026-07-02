import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ExerciseSchema } from "../../../src/core/lesson/lessonSchema";
import { nextTopicStatus } from "../../../src/core/progress/topicStatusMachine";

const fixturePath = resolve(process.cwd(), "tests/fixtures/multi-topic.fixture.json");
const rawFixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("multi-topic.fixture.json", () => {
  it("validates against ExerciseSchema and has topicImpact.length === 2 (Pitfall 2 — loop all topics)", () => {
    const result = ExerciseSchema.safeParse(rawFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topicImpact.length).toBe(2);
    }
  });
});

describe("nextTopicStatus", () => {
  it("D-06 transition 1: not_started -> in_progress on first correct attempt", () => {
    expect(nextTopicStatus("not_started", true, 0, 1)).toEqual({
      status: "in_progress",
      transition: null,
    });
  });

  it("D-06 transition 1: not_started -> in_progress on first incorrect attempt (1 error is not yet needs_review)", () => {
    expect(nextTopicStatus("not_started", false, 1, 0)).toEqual({
      status: "in_progress",
      transition: null,
    });
  });

  it("D-06 transition 2: in_progress -> needs_review at 2+ errors", () => {
    expect(nextTopicStatus("in_progress", false, 2, 0)).toEqual({
      status: "needs_review",
      transition: "entered_needs_review",
    });
  });

  it("D-06 transition 3: needs_review -> in_progress on a correct answer (streak < 3)", () => {
    expect(nextTopicStatus("needs_review", true, 2, 1)).toEqual({
      status: "in_progress",
      transition: null,
    });
  });

  it("D-06 mastery from in_progress: 3 correct-in-a-row -> mastered", () => {
    expect(nextTopicStatus("in_progress", true, 0, 3)).toEqual({
      status: "mastered",
      transition: "entered_mastered",
    });
  });

  it("D-06 mastery from needs_review: 3 correct-in-a-row from ANY status -> mastered", () => {
    expect(nextTopicStatus("needs_review", true, 1, 3)).toEqual({
      status: "mastered",
      transition: "entered_mastered",
    });
  });

  it("no spurious transition: already mastered stays mastered with no re-emit", () => {
    expect(nextTopicStatus("mastered", true, 0, 4)).toEqual({
      status: "mastered",
      transition: null,
    });
  });

  it("needs_review persists on further error (3+ errors, no new transition)", () => {
    expect(nextTopicStatus("needs_review", false, 3, 0)).toEqual({
      status: "needs_review",
      transition: null,
    });
  });
});
