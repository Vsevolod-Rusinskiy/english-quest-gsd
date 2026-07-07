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
// the single-inline-blank layout and the multi-blank (2+ inputs, one per
// blank) layout. Does NOT click submit — callers keep their own
// submit/await logic.
//
// UX-INLINE-02: single-blank exercises now ALSO render one `.inline-blank`
// input (previously only multi-blank exercises did), so ".inline-blank
// present" alone no longer implies "multi-blank, needs a MULTI_BLANK_ANSWERS
// entry". Branch on the ACTUAL blank count instead: exactly one inline-blank
// with no MULTI_BLANK_ANSWERS entry -> fill it with fullAnswer (single-input
// behavior); 2+ inline-blanks (or a known multi-blank id) -> the existing
// per-blank fill path, unchanged.
export function fillCorrectTextAnswer(
  root: HTMLElement,
  exerciseId: string,
  fullAnswer: string,
): void {
  const blankInputs = root.querySelectorAll<HTMLInputElement>("input.inline-blank");
  const perBlank = MULTI_BLANK_ANSWERS[exerciseId];

  if (blankInputs.length === 1 && !perBlank) {
    blankInputs[0].value = fullAnswer;
    blankInputs[0].dispatchEvent(new Event("input"));
    return;
  }

  if (blankInputs.length > 0) {
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
