import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SingleChoiceExerciseSchema } from "../../../src/core/lesson/lessonSchema";
import { renderSingleChoice } from "../../../src/ui/exercise-renderers/singleChoice";

const fixturePath = resolve(process.cwd(), "tests/fixtures/single-choice.fixture.json");
const rawFixture = JSON.parse(readFileSync(fixturePath, "utf-8"));
const exercise = SingleChoiceExerciseSchema.parse(rawFixture);

const instructionRu = "Тестовая инструкция";
const instructionEn = "Test instruction";

describe("renderSingleChoice", () => {
  it("renders one tappable button per option", () => {
    const el = renderSingleChoice({ exercise, instructionRu, instructionEn, onSubmit: () => {} });
    const buttons = Array.from(el.querySelectorAll("button.option"));
    expect(buttons).toHaveLength(exercise.options.length);
    expect(buttons.map((b) => b.textContent)).toEqual(exercise.options.map((o) => o.labelEn));
  });

  it("selects exactly one option on tap (accent-marked), clearing the previous selection", () => {
    const el = renderSingleChoice({ exercise, instructionRu, instructionEn, onSubmit: () => {} });
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>("button.option"));

    buttons[0].click();
    expect(buttons[0].classList.contains("accent")).toBe(true);
    expect(buttons[1].classList.contains("accent")).toBe(false);

    buttons[1].click();
    expect(buttons[0].classList.contains("accent")).toBe(false);
    expect(buttons[1].classList.contains("accent")).toBe(true);
  });

  it("keeps Проверить inert until an option is selected", () => {
    const el = renderSingleChoice({ exercise, instructionRu, instructionEn, onSubmit: () => {} });
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>("button.option"));
    const submitButton = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent === "Проверить",
    ) as HTMLButtonElement;

    expect(submitButton.disabled).toBe(true);
    buttons[1].click();
    expect(submitButton.disabled).toBe(false);
  });

  it("emits AnswerSubmitted with the selected optionId on submit", () => {
    let submitted: string | undefined;
    const el = renderSingleChoice({
      exercise,
      instructionRu,
      instructionEn,
      onSubmit: (id) => (submitted = id),
    });
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>("button.option"));
    const submitButton = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent === "Проверить",
    ) as HTMLButtonElement;

    buttons[1].click();
    submitButton.click();

    expect(submitted).toBe(exercise.options[1].id);
  });

  it("renders instructionRu then instructionEn as .instruction-line elements before the prompt paragraph (05-03 gap closure)", () => {
    const el = renderSingleChoice({ exercise, instructionRu, instructionEn, onSubmit: () => {} });
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
      resolve(process.cwd(), "src/ui/exercise-renderers/singleChoice.ts"),
      "utf-8",
    );
    expect(source).not.toMatch(/innerHTML/);
  });
});
