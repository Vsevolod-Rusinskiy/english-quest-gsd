// single-choice renderer: one tappable button per option, exactly one selectable
// (accent-marked), Проверить inert until a selection is made (EXERCISE-02).
// Emits AnswerSubmitted upward — never calls save() itself (Pitfall 3).
import type { SingleChoiceExercise } from "../../core/lesson/lessonSchema";

export interface SingleChoiceOptions {
  exercise: SingleChoiceExercise;
  instructionRu: string;
  instructionEn: string;
  onSubmit: (selectedOptionId: string) => void;
}

export function renderSingleChoice(options: SingleChoiceOptions): HTMLElement {
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

  const optionList = document.createElement("div");
  optionList.className = "option-list";

  let selectedId: string | null = null;

  const submitRow = document.createElement("div");
  submitRow.className = "submit-row";

  const submitButton = document.createElement("button");
  submitButton.type = "button";
  submitButton.className = "accent";
  submitButton.textContent = "Проверить";
  submitButton.disabled = true;

  const optionButtons: HTMLButtonElement[] = [];

  for (const option of exercise.options) {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "option";
    optionButton.textContent = option.labelEn;

    optionButton.addEventListener("click", () => {
      selectedId = option.id;
      for (const btn of optionButtons) {
        btn.classList.toggle("accent", btn === optionButton);
      }
      submitButton.disabled = false;
    });

    optionButtons.push(optionButton);
    optionList.appendChild(optionButton);
  }

  container.appendChild(optionList);

  submitButton.addEventListener("click", () => {
    if (selectedId === null) return;
    onSubmit(selectedId);
  });

  submitRow.appendChild(submitButton);
  container.appendChild(submitRow);

  return container;
}
