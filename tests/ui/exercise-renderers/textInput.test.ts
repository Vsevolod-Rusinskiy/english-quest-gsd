import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TextInputExerciseSchema } from "../../../src/core/lesson/lessonSchema";
import { renderTextInput } from "../../../src/ui/exercise-renderers/textInput";
import { checkTextInput } from "../../../src/core/answer-checking/checkTextInput";

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
    // UX-INLINE-02: the prompt paragraph now contains an inline blank input
    // in place of "___", so its textContent no longer strictly equals the
    // raw exercise.prompt string. Find it by its leading text segment
    // (parts[0], the text before the first blank) instead.
    const leadingSegment = exercise.prompt.split("___")[0];
    const promptIndex = children.findIndex((c) => c.textContent?.startsWith(leadingSegment));

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

  it("single-blank exercise renders exactly one INLINE input, no separate box, no leftover blank marker, submits verbatim (UX-INLINE-02)", () => {
    // The fixture's first text-input (ex001, single blank) now uses the
    // SAME inline-per-blank path as multi-blank exercises.
    let submitted: string | null = null;
    const el = renderTextInput({
      exercise,
      instructionRu,
      instructionEn,
      onSubmit: (raw) => {
        submitted = raw;
      },
    });
    const inputs = el.querySelectorAll<HTMLInputElement>('input[type="text"]');
    expect(inputs).toHaveLength(1);
    // The single blank IS an inline-blank input now.
    expect(el.querySelectorAll(".inline-blank")).toHaveLength(1);
    expect(inputs[0].classList.contains("inline-blank")).toBe(true);

    // No literal "___" marker left anywhere in the prompt paragraph.
    const prompt = Array.from(el.querySelectorAll("p")).find((p) =>
      p.textContent?.includes(exercise.prompt.split("___")[0]),
    )!;
    expect(prompt.textContent).not.toContain("___");

    inputs[0].value = "is working";
    inputs[0].dispatchEvent(new Event("input"));
    const submit = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent === "Проверить",
    )!;
    submit.click();
    expect(submitted).toBe("is working");
  });

  it("a prompt with ZERO blank markers still renders a single (non-inline) input and never crashes", () => {
    const noBlankExercise = { ...exercise, prompt: "No blank marker here." };
    let submitted: string | null = null;
    expect(() => {
      const el = renderTextInput({
        exercise: noBlankExercise,
        instructionRu,
        instructionEn,
        onSubmit: (raw) => {
          submitted = raw;
        },
      });
      const inputs = el.querySelectorAll<HTMLInputElement>('input[type="text"]');
      expect(inputs).toHaveLength(1);
      expect(el.querySelectorAll(".inline-blank")).toHaveLength(0);

      inputs[0].value = "anything";
      inputs[0].dispatchEvent(new Event("input"));
      const submit = Array.from(el.querySelectorAll("button")).find(
        (b) => b.textContent === "Проверить",
      )!;
      submit.click();
    }).not.toThrow();
    expect(submitted).toBe("anything");
  });
});

// 260707-hby: multi-blank text-input exercises render one inline input per
// blank; the child fills only the missing words and the renderer reconstructs
// the single answer string (blank values interleaved with the INTERIOR
// printed segments) that the deterministic checker already accepts. This
// closes a live-found false-rejection bug where a correct blank-only answer
// ("don't have" for "They ___ usually ___ ...") was marked wrong because the
// expected string bundled in the printed "usually".
describe("renderTextInput — multi-blank (2+ blanks)", () => {
  const byId = (id: string) =>
    TextInputExerciseSchema.parse(
      allExercises.find((e: { exerciseId: string }) => e.exerciseId === id),
    );

  // exerciseId -> the blank-filler values a child naturally types, in order.
  const cases: Array<{ id: string; blanks: string[] }> = [
    { id: "eq-1a-ex002", blanks: ["Do", "get up"] }, // "___ you usually ___ late?"
    { id: "eq-1a-ex003", blanks: ["don't", "have"] }, // "They ___ usually ___ a big meal..."
    { id: "eq-1a-ex004", blanks: ["are", "doing"] }, // "What ___ you ___ tonight?"
  ];

  for (const { id, blanks } of cases) {
    it(`${id}: filling only the blanks reconstructs a checkTextInput-accepted answer`, () => {
      const ex = byId(id);
      let submitted: string | null = null;
      const el = renderTextInput({
        exercise: ex,
        instructionRu,
        instructionEn,
        onSubmit: (raw) => {
          submitted = raw;
        },
      });

      const blankInputs = el.querySelectorAll<HTMLInputElement>("input.inline-blank");
      expect(blankInputs).toHaveLength(blanks.length);

      blankInputs.forEach((inp, i) => {
        inp.value = blanks[i];
        inp.dispatchEvent(new Event("input"));
      });

      const submit = Array.from(el.querySelectorAll("button")).find(
        (b) => b.textContent === "Проверить",
      )!;
      expect(submit.disabled).toBe(false);
      submit.click();

      expect(submitted).not.toBeNull();
      // The reconstructed string is accepted by the deterministic core checker
      // — no reliance on the LLM Answer Checker.
      expect(checkTextInput(ex, submitted!).isCorrect).toBe(true);
    });
  }

  it("keeps the interior printed word (e.g. 'usually') visible between the inputs", () => {
    const ex = byId("eq-1a-ex003");
    const el = renderTextInput({ exercise: ex, instructionRu, instructionEn, onSubmit: () => {} });
    const blank = el.querySelector("input.inline-blank")!;
    // The blanks live inside the prompt paragraph alongside the printed text.
    const promptEl = blank.parentElement!;
    expect(promptEl.textContent).toContain("usually");
  });

  it("submit stays disabled until every blank is filled", () => {
    const ex = byId("eq-1a-ex003");
    const el = renderTextInput({ exercise: ex, instructionRu, instructionEn, onSubmit: () => {} });
    const blankInputs = el.querySelectorAll<HTMLInputElement>("input.inline-blank");
    const submit = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent === "Проверить",
    )!;

    expect(submit.disabled).toBe(true);
    blankInputs[0].value = "don't";
    blankInputs[0].dispatchEvent(new Event("input"));
    expect(submit.disabled).toBe(true); // second blank still empty
    blankInputs[1].value = "have";
    blankInputs[1].dispatchEvent(new Event("input"));
    expect(submit.disabled).toBe(false);
  });
});
