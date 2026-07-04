import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TextInputExerciseSchema } from "../../../src/core/lesson/lessonSchema";
import { renderTextInput } from "../../../src/ui/exercise-renderers/textInput";

// 05-03 gap closure (WR-01): textInput.ts never had a dedicated test file,
// even though it's the most-used exercise type (9/19 in Lesson-1A.json) and
// received the exact same instruction-line change as singleChoice/matching/
// orderBuilder, which all got equivalent coverage.
const lessonFixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/Lesson-1A.json"), "utf-8"),
);
const allExercises = lessonFixture.sections.flatMap((s: { exercises: unknown[] }) => s.exercises);
const rawExercise = allExercises.find((e: { type: string }) => e.type === "text-input");
const exercise = TextInputExerciseSchema.parse(rawExercise);

const instructionRu = "Тестовая инструкция";
const instructionEn = "Test instruction";

describe("renderTextInput", () => {
  it("renders instructionRu then instructionEn as .instruction-line elements before the prompt paragraph", () => {
    const el = renderTextInput({ exercise, instructionRu, instructionEn, onSubmit: () => {} });
    const children = Array.from(el.children);
    const instructionLines = Array.from(el.querySelectorAll(".instruction-line"));
    const promptIndex = children.findIndex((c) => c.textContent === exercise.prompt);

    expect(instructionLines).toHaveLength(2);
    expect(instructionLines[0].textContent).toBe(instructionRu);
    expect(instructionLines[1].textContent).toBe(instructionEn);
    expect(children.indexOf(instructionLines[0])).toBeLessThan(promptIndex);
    expect(children.indexOf(instructionLines[1])).toBeLessThan(promptIndex);
  });

  it("uses createElement/textContent only, never innerHTML", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/exercise-renderers/textInput.ts"),
      "utf-8",
    );
    expect(source).not.toMatch(/innerHTML/);
  });
});
