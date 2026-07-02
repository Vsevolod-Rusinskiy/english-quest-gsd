// text-input renderer: single-line input + Проверить button, inert until non-empty.
// Emits AnswerSubmitted upward — never calls save() itself (Pitfall 3).
import type { TextInputExercise } from "../../core/lesson/lessonSchema";

export interface TextInputOptions {
  exercise: TextInputExercise;
  onSubmit: (rawAnswer: string) => void;
}

export function renderTextInput(options: TextInputOptions): HTMLElement {
  const { exercise, onSubmit } = options;

  const container = document.createElement("div");
  container.className = "task-card";

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
