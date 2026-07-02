import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LessonSchema } from "../../../src/core/lesson/lessonSchema";

const lessonPath = resolve(process.cwd(), "public/Lesson-1A.json");
const realLesson1A = JSON.parse(readFileSync(lessonPath, "utf-8"));

describe("LessonSchema", () => {
  it("parses the real Lesson-1A.json successfully", () => {
    const result = LessonSchema.safeParse(realLesson1A);
    expect(result.success).toBe(true);
  });

  it("yields exactly 19 exercises across sections", () => {
    const result = LessonSchema.safeParse(realLesson1A);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const total = result.data.sections.reduce((sum, s) => sum + s.exercises.length, 0);
    expect(total).toBe(19);
  });

  it("rejects a lesson object missing the theory block", () => {
    const broken = { ...realLesson1A };
    delete (broken as Record<string, unknown>).theory;
    const result = LessonSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("rejects an exercise with an unknown type via the discriminated union", () => {
    const broken = JSON.parse(JSON.stringify(realLesson1A));
    broken.sections[0].exercises[0].type = "not-a-real-type";
    const result = LessonSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });
});
