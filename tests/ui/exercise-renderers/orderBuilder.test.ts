import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OrderBuilderExerciseSchema } from "../../../src/core/lesson/lessonSchema";
import { renderOrderBuilder } from "../../../src/ui/exercise-renderers/orderBuilder";

const fixturePath = resolve(process.cwd(), "tests/fixtures/order-builder.fixture.json");
const rawFixture = JSON.parse(readFileSync(fixturePath, "utf-8"));
const exercise = OrderBuilderExerciseSchema.parse(rawFixture);

describe("renderOrderBuilder", () => {
  it("renders the word bank (Слова:) with all wordBank chips, and an empty sequence area (Твой ответ:)", () => {
    const el = renderOrderBuilder({ exercise, onSubmit: () => {} });
    expect(el.textContent).toContain("Слова:");
    expect(el.textContent).toContain("Твой ответ:");

    const bankChips = Array.from(el.querySelectorAll("button.bank-chip"));
    expect(bankChips).toHaveLength(exercise.wordBank.length);
    expect(bankChips.map((c) => c.textContent)).toEqual(exercise.wordBank);

    const sequenceChips = Array.from(el.querySelectorAll("button.sequence-chip"));
    expect(sequenceChips).toHaveLength(0);
  });

  it("tapping bank chips in order appends to the sequence and shrinks the bank", () => {
    const el = renderOrderBuilder({ exercise, onSubmit: () => {} });
    const bankChips = () => Array.from(el.querySelectorAll<HTMLButtonElement>("button.bank-chip"));
    const sequenceChips = () =>
      Array.from(el.querySelectorAll<HTMLButtonElement>("button.sequence-chip"));

    const firstWord = bankChips()[0].textContent;
    bankChips()[0].click();

    expect(bankChips()).toHaveLength(exercise.wordBank.length - 1);
    expect(sequenceChips()).toHaveLength(1);
    expect(sequenceChips()[0].textContent).toBe(firstWord);

    const secondWord = bankChips()[0].textContent;
    bankChips()[0].click();

    expect(bankChips()).toHaveLength(exercise.wordBank.length - 2);
    expect(sequenceChips()).toHaveLength(2);
    expect(sequenceChips()[1].textContent).toBe(secondWord);
  });

  it("tapping a sequence chip removes it and returns it to the bank", () => {
    const el = renderOrderBuilder({ exercise, onSubmit: () => {} });
    const bankChips = () => Array.from(el.querySelectorAll<HTMLButtonElement>("button.bank-chip"));
    const sequenceChips = () =>
      Array.from(el.querySelectorAll<HTMLButtonElement>("button.sequence-chip"));

    bankChips()[0].click();
    bankChips()[0].click();
    expect(sequenceChips()).toHaveLength(2);

    const removedWord = sequenceChips()[0].textContent;
    sequenceChips()[0].click();

    expect(sequenceChips()).toHaveLength(1);
    expect(bankChips()).toHaveLength(exercise.wordBank.length - 1);
    expect(bankChips().some((c) => c.textContent === removedWord)).toBe(true);
  });

  it("keeps Проверить inert until at least one word is placed, then emits the sequence on submit", () => {
    const el = renderOrderBuilder({ exercise, onSubmit: () => {} });
    const submitButton = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent === "Проверить",
    ) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);

    const bankChips = () => Array.from(el.querySelectorAll<HTMLButtonElement>("button.bank-chip"));
    bankChips()[0].click();
    expect(submitButton.disabled).toBe(false);
  });

  it("submit emits the current assembled sequence array", () => {
    let submitted: string[] | undefined;
    const el = renderOrderBuilder({ exercise, onSubmit: (seq) => (submitted = seq) });
    const bankChips = () => Array.from(el.querySelectorAll<HTMLButtonElement>("button.bank-chip"));

    const expectedSequence: string[] = [];
    while (bankChips().length > 0) {
      expectedSequence.push(bankChips()[0].textContent ?? "");
      bankChips()[0].click();
    }

    const submitButton = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent === "Проверить",
    ) as HTMLButtonElement;
    submitButton.click();

    expect(submitted).toEqual(expectedSequence);
  });

  it("has no draggable attributes/drag event wiring (D-05: no drag-and-drop)", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/exercise-renderers/orderBuilder.ts"),
      "utf-8",
    );
    expect(source).not.toMatch(/draggable|dragstart|dragover|drop\b/);
  });

  it("uses createElement/textContent only, never innerHTML", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/exercise-renderers/orderBuilder.ts"),
      "utf-8",
    );
    expect(source).not.toMatch(/innerHTML/);
  });
});
