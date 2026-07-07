import { expect } from "vitest";

// Per-blank filler values for the 3 multi-blank text-input exercises
// (260707-hby: one inline input per "___" blank). Keyed by exerciseId; each
// array is what a child types into the blanks in order. The renderer
// reconstructs "blank[0] + interior[1] + blank[1] + ..." into a single string
// the deterministic checkTextInput already accepts.
export const MULTI_BLANK_ANSWERS: Record<string, string[]> = {
  "eq-1a-ex002": ["Do", "get up"], // "___ you usually ___ late?"
  "eq-1a-ex003": ["don't", "have"], // "They ___ usually ___ a big meal..."
  "eq-1a-ex004": ["are", "doing"], // "What ___ you ___ tonight?"
};

// Fill a text-input exercise's field(s) with a CORRECT answer, handling both
// the single-input layout and the multi-blank (one input per blank) layout.
// Does NOT click submit — callers keep their own submit/await logic.
export function fillCorrectTextAnswer(
  root: HTMLElement,
  exerciseId: string,
  fullAnswer: string,
): void {
  const blankInputs = root.querySelectorAll<HTMLInputElement>("input.inline-blank");
  if (blankInputs.length > 0) {
    const perBlank = MULTI_BLANK_ANSWERS[exerciseId];
    expect(perBlank, `missing per-blank answers for ${exerciseId}`).toBeTruthy();
    expect(blankInputs).toHaveLength(perBlank.length);
    blankInputs.forEach((inp, i) => {
      inp.value = perBlank[i];
      inp.dispatchEvent(new Event("input"));
    });
  } else {
    const input = root.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = fullAnswer;
    input.dispatchEvent(new Event("input"));
  }
}

// Fill an arbitrary value (e.g. deliberately wrong) into every present text
// input (single or multi-blank) so the submit button becomes enabled.
export function fillRawTextAnswer(root: HTMLElement, value: string): void {
  const blankInputs = root.querySelectorAll<HTMLInputElement>("input.inline-blank");
  const inputs =
    blankInputs.length > 0
      ? Array.from(blankInputs)
      : [root.querySelector('input[type="text"]') as HTMLInputElement];
  for (const inp of inputs) {
    expect(inp).toBeTruthy();
    inp.value = value;
    inp.dispatchEvent(new Event("input"));
  }
}
