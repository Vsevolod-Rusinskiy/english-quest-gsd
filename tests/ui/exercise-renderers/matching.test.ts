import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LessonSchema } from "../../../src/core/lesson/lessonSchema";
import { renderMatching } from "../../../src/ui/exercise-renderers/matching";

const lessonRaw = JSON.parse(readFileSync(resolve(process.cwd(), "public/Lesson-1A.json"), "utf-8"));
const lesson = LessonSchema.parse(lessonRaw);
const ex019 = lesson.sections
  .flatMap((s) => s.exercises)
  .find((e) => e.exerciseId === "eq-1a-ex019");
if (!ex019 || ex019.type !== "matching") {
  throw new Error("Fixture setup error: eq-1a-ex019 not found or not a matching exercise");
}
const exercise = ex019;

const instructionRu = "Тестовая инструкция";
const instructionEn = "Test instruction";

describe("renderMatching", () => {
  it("renders two columns: left items (image placeholders) and right options (word labels)", () => {
    const el = renderMatching({ exercise, instructionRu, instructionEn, onSubmit: () => {} });
    const leftButtons = Array.from(el.querySelectorAll("button.match-left"));
    const rightButtons = Array.from(el.querySelectorAll("button.match-right"));

    expect(leftButtons).toHaveLength(exercise.leftItems.length);
    expect(rightButtons).toHaveLength(exercise.rightOptions.length);
    expect(leftButtons.map((b) => b.textContent)).toEqual(
      exercise.leftItems.map((i) => i.imagePrompt),
    );
    expect(rightButtons.map((b) => b.textContent)).toEqual(
      exercise.rightOptions.map((o) => o.labelEn),
    );
  });

  it("supports tap-to-pair: tapping a left item then a right item marks both accent + inert", () => {
    const el = renderMatching({ exercise, instructionRu, instructionEn, onSubmit: () => {} });
    const leftButtons = Array.from(el.querySelectorAll<HTMLButtonElement>("button.match-left"));
    const rightButtons = Array.from(el.querySelectorAll<HTMLButtonElement>("button.match-right"));

    leftButtons[0].click();
    rightButtons[0].click();

    expect(leftButtons[0].classList.contains("accent")).toBe(true);
    expect(rightButtons[0].classList.contains("accent")).toBe(true);
    expect(leftButtons[0].disabled).toBe(true);
    expect(rightButtons[0].disabled).toBe(true);

    // Unpaired items remain tappable.
    expect(leftButtons[1].disabled).toBe(false);
    expect(rightButtons[1].disabled).toBe(false);
  });

  it("keeps Проверить inert until all pairs are made", () => {
    const el = renderMatching({ exercise, instructionRu, instructionEn, onSubmit: () => {} });
    const leftButtons = Array.from(el.querySelectorAll<HTMLButtonElement>("button.match-left"));
    const rightButtons = Array.from(el.querySelectorAll<HTMLButtonElement>("button.match-right"));
    const submitButton = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent === "Проверить",
    ) as HTMLButtonElement;

    expect(submitButton.disabled).toBe(true);

    // Pair only the first item — not enough.
    leftButtons[0].click();
    rightButtons[0].click();
    expect(submitButton.disabled).toBe(true);

    // Pair the rest, matched by real ex019 leftId->rightId correspondence.
    for (let i = 1; i < exercise.leftItems.length; i++) {
      leftButtons[i].click();
      rightButtons[i].click();
    }
    expect(submitButton.disabled).toBe(false);
  });

  it("emits AnswerSubmitted with the full correct pair list for ex019", () => {
    let submitted: { leftId: string; rightId: string }[] | undefined;
    const el = renderMatching({
      exercise,
      instructionRu,
      instructionEn,
      onSubmit: (pairs) => (submitted = pairs),
    });
    const leftButtons = Array.from(el.querySelectorAll<HTMLButtonElement>("button.match-left"));
    const rightButtons = Array.from(el.querySelectorAll<HTMLButtonElement>("button.match-right"));

    for (let i = 0; i < exercise.leftItems.length; i++) {
      leftButtons[i].click();
      rightButtons[i].click();
    }

    const submitButton = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent === "Проверить",
    ) as HTMLButtonElement;
    submitButton.click();

    expect(submitted).toBeDefined();
    expect(submitted).toHaveLength(exercise.leftItems.length);
    for (let i = 0; i < exercise.leftItems.length; i++) {
      expect(submitted).toContainEqual({
        leftId: exercise.leftItems[i].id,
        rightId: exercise.rightOptions[i].id,
      });
    }
  });

  it("renders instructionRu then instructionEn as .instruction-line elements before the prompt paragraph (05-03 gap closure)", () => {
    const el = renderMatching({ exercise, instructionRu, instructionEn, onSubmit: () => {} });
    const children = Array.from(el.children);
    const instructionLines = Array.from(el.querySelectorAll(".instruction-line"));
    const promptIndex = children.findIndex((c) => c.textContent === exercise.prompt);

    expect(instructionLines).toHaveLength(2);
    expect(instructionLines[0].textContent).toBe(instructionRu);
    expect(instructionLines[1].textContent).toBe(instructionEn);
    expect(children.indexOf(instructionLines[0])).toBeLessThan(promptIndex);
    expect(children.indexOf(instructionLines[1])).toBeLessThan(promptIndex);
    expect(children.indexOf(instructionLines[0])).toBeLessThan(children.indexOf(instructionLines[1]));
  });

  it("uses createElement/textContent only, never innerHTML", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/exercise-renderers/matching.ts"),
      "utf-8",
    );
    expect(source).not.toMatch(/innerHTML/);
  });
});
