import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LessonSchema } from "../../../src/core/lesson/lessonSchema";
import { renderTheoryScreen } from "../../../src/ui/screens/TheoryScreen";

const lessonPath = resolve(process.cwd(), "public/Lesson-1A.json");
const realLesson1A = JSON.parse(readFileSync(lessonPath, "utf-8"));
const lesson = LessonSchema.parse(realLesson1A);

describe("TheoryScreen", () => {
  it("renders theory.rule and explanationLevels[0].exampleRu and both buttons via textContent", () => {
    const onUnderstoodChoice = vi.fn();
    const el = renderTheoryScreen({ theory: lesson.theory, onUnderstoodChoice });

    expect(el.textContent).toContain(lesson.theory.rule);
    expect(el.textContent).toContain(lesson.theory.explanationLevels[0].exampleRu);

    const buttonTexts = Array.from(el.querySelectorAll("button")).map((b) => b.textContent);
    expect(buttonTexts).toContain("Понятно");
    expect(buttonTexts).toContain("Не понятно");
  });

  it("clicking Понятно calls onUnderstoodChoice(true)", () => {
    const onUnderstoodChoice = vi.fn();
    const el = renderTheoryScreen({ theory: lesson.theory, onUnderstoodChoice });
    const understoodButton = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent === "Понятно",
    );

    understoodButton?.click();

    expect(onUnderstoodChoice).toHaveBeenCalledWith(true);
  });

  it("clicking Не понятно calls onUnderstoodChoice(false)", () => {
    const onUnderstoodChoice = vi.fn();
    const el = renderTheoryScreen({ theory: lesson.theory, onUnderstoodChoice });
    const notUnderstoodButton = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent === "Не понятно",
    );

    notUnderstoodButton?.click();

    expect(onUnderstoodChoice).toHaveBeenCalledWith(false);
  });

  it("both theory toggle buttons carry a shared .theory-toggle className, distinct from the CTA-only .accent marker", () => {
    const onUnderstoodChoice = vi.fn();
    const el = renderTheoryScreen({ theory: lesson.theory, onUnderstoodChoice });

    const toggles = Array.from(el.querySelectorAll(".theory-toggle"));
    expect(toggles).toHaveLength(2);

    for (const toggle of toggles) {
      expect(toggle.classList.contains("accent")).toBe(false);
    }
  });
});
