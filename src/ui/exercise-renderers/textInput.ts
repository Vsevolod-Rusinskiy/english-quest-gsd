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
  instructionRuLine.className = "instruction-line";
  instructionRuLine.textContent = instructionRu;
  container.appendChild(instructionRuLine);

  const instructionEnLine = document.createElement("p");
  instructionEnLine.className = "instruction-line";
  instructionEnLine.textContent = instructionEn;
  container.appendChild(instructionEnLine);

  const prompt = document.createElement("p");
  prompt.textContent = exercise.prompt;
  container.appendChild(prompt);

  const input = document.createElement("input");
  input.type = "text";
  container.appendChild(input);

  const submitRow = document.createElement("div");
  submitRow.className = "submit-row";

  const submitButton = document.createElement("button");
  submitButton.type = "button";
  submitButton.className = "accent";
  submitButton.textContent = "Проверить";
  submitButton.disabled = true;

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
