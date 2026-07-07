// text-input renderer: single-line input + Проверить button, inert until non-empty.
// Emits AnswerSubmitted upward — never calls save() itself (Pitfall 3).
import type { TextInputExercise } from "../../core/lesson/lessonSchema";

export interface TextInputOptions {
  exercise: TextInputExercise;
  instructionRu: string;
  instructionEn: string;
  onSubmit: (rawAnswer: string) => void;
}

export function renderTextInput(options: TextInputOptions): HTMLElement {
  const { exercise, instructionRu, instructionEn, onSubmit } = options;

  const container = document.createElement("div");
  container.className = "task-card";

  const instructionRuLine = document.createElement("p");
  instructionRuLine.className = "instruction-line instruction-ru";
  instructionRuLine.textContent = instructionRu;
  container.appendChild(instructionRuLine);

  const instructionEnLine = document.createElement("p");
  instructionEnLine.className = "instruction-line";
  instructionEnLine.textContent = instructionEn;
  container.appendChild(instructionEnLine);

  const prompt = document.createElement("p");
  container.appendChild(prompt);

  const submitRow = document.createElement("div");
  submitRow.className = "submit-row";

  const submitButton = document.createElement("button");
  submitButton.type = "button";
  submitButton.className = "accent";
  submitButton.textContent = "Проверить";
  submitButton.disabled = true;

  // Split on the "___" blank marker. blankCount<=1 keeps the original
  // single-input-below-prompt layout byte-for-byte (15/18 exercises).
  // blankCount>=2 renders one inline input per blank, interleaved with the
  // printed interior words, and reconstructs a single answer string on
  // submit — the deterministic checkTextInput/normalize/onSubmit contract
  // never changes shape, only how the raw string is assembled (bug fix for
  // false-rejection on multi-blank exercises, see PLAN 260707-hby).
  const parts = exercise.prompt.split("___");
  const blankCount = parts.length - 1;

  if (blankCount <= 1) {
    prompt.textContent = exercise.prompt;

    const input = document.createElement("input");
    input.type = "text";
    container.appendChild(input);

    input.addEventListener("input", () => {
      submitButton.disabled = input.value.trim().length === 0;
    });

    submitButton.addEventListener("click", () => {
      if (input.value.trim().length === 0) return;
      onSubmit(input.value);
    });

    submitRow.appendChild(submitButton);
    container.appendChild(submitRow);

    queueMicrotask(() => input.focus());

    return container;
  }

  // Multi-blank (2+): interleave printed segments and inline inputs in
  // reading order so interior words (e.g. "usually") stay visible between
  // the inputs the child fills in.
  const blankInputs: HTMLInputElement[] = [];

  prompt.appendChild(document.createTextNode(parts[0]));
  for (let i = 0; i < blankCount; i++) {
    const blankInput = document.createElement("input");
    blankInput.type = "text";
    blankInput.className = "inline-blank";
    blankInputs.push(blankInput);
    prompt.appendChild(blankInput);

    // parts[i + 1] is the segment following this blank — interior text if
    // more blanks follow, or the trailing segment if this was the last one.
    prompt.appendChild(document.createTextNode(parts[i + 1]));
  }

  function updateSubmitState(): void {
    submitButton.disabled = blankInputs.some((inp) => inp.value.trim().length === 0);
  }

  for (const blankInput of blankInputs) {
    blankInput.addEventListener("input", updateSubmitState);
  }

  submitButton.addEventListener("click", () => {
    if (blankInputs.some((inp) => inp.value.trim().length === 0)) return;

    // Reconstruct the single answer string: blank values interleaved with
    // INTERIOR printed segments only (parts[1..blankCount-1]) — never
    // parts[0] or parts[blankCount] (the surrounding prompt text).
    let rawAnswer = blankInputs[0].value;
    for (let i = 1; i < blankCount; i++) {
      rawAnswer += parts[i] + blankInputs[i].value;
    }

    onSubmit(rawAnswer);
  });

  submitRow.appendChild(submitButton);
  container.appendChild(submitRow);

  queueMicrotask(() => blankInputs[0].focus());

  return container;
}
