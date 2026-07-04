// matching renderer: two columns (left = image-prompt placeholders, right = word
// labels), tap-to-pair interaction (EXERCISE-03). Paired items become accent-marked
// and non-tappable; Проверить inert until all pairs are made.
// Emits AnswerSubmitted upward — never calls save() itself (Pitfall 3).
// Real image assets are out of Phase 1 scope — left items render imagePrompt as text.
import type { MatchingExercise } from "../../core/lesson/lessonSchema";

export interface MatchingPair {
  leftId: string;
  rightId: string;
}

export interface MatchingOptions {
  exercise: MatchingExercise;
  instructionRu: string;
  instructionEn: string;
  onSubmit: (pairs: MatchingPair[]) => void;
}

export function renderMatching(options: MatchingOptions): HTMLElement {
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

  const columns = document.createElement("div");
  columns.className = "match-columns";

  const leftColumn = document.createElement("div");
  leftColumn.className = "match-column match-column-left";

  const rightColumn = document.createElement("div");
  rightColumn.className = "match-column match-column-right";

  columns.appendChild(leftColumn);
  columns.appendChild(rightColumn);
  container.appendChild(columns);

  const submitRow = document.createElement("div");
  submitRow.className = "submit-row";

  const submitButton = document.createElement("button");
  submitButton.type = "button";
  submitButton.className = "accent";
  submitButton.textContent = "Проверить";
  submitButton.disabled = true;

  let selectedLeftId: string | null = null;
  let selectedRightId: string | null = null;
  const pairs: MatchingPair[] = [];

  const totalPairsNeeded = Math.min(exercise.leftItems.length, exercise.rightOptions.length);

  function updateSubmitState(): void {
    submitButton.disabled = pairs.length < totalPairsNeeded;
  }

  function tryFormPair(): void {
    if (selectedLeftId === null || selectedRightId === null) return;

    pairs.push({ leftId: selectedLeftId, rightId: selectedRightId });

    const leftButton = leftButtons.get(selectedLeftId);
    const rightButton = rightButtons.get(selectedRightId);
    leftButton?.classList.add("accent");
    rightButton?.classList.add("accent");
    if (leftButton) leftButton.disabled = true;
    if (rightButton) rightButton.disabled = true;

    selectedLeftId = null;
    selectedRightId = null;
    updateSubmitState();
  }

  const leftButtons = new Map<string, HTMLButtonElement>();
  const rightButtons = new Map<string, HTMLButtonElement>();

  for (const item of exercise.leftItems) {
    const leftButton = document.createElement("button");
    leftButton.type = "button";
    leftButton.className = "match-left";
    leftButton.textContent = item.imagePrompt;

    leftButton.addEventListener("click", () => {
      selectedLeftId = item.id;
      for (const [id, btn] of leftButtons) {
        if (!btn.disabled) btn.classList.toggle("accent", id === item.id);
      }
      tryFormPair();
    });

    leftButtons.set(item.id, leftButton);
    leftColumn.appendChild(leftButton);
  }

  for (const option of exercise.rightOptions) {
    const rightButton = document.createElement("button");
    rightButton.type = "button";
    rightButton.className = "match-right";
    rightButton.textContent = option.labelEn;

    rightButton.addEventListener("click", () => {
      selectedRightId = option.id;
      for (const [id, btn] of rightButtons) {
        if (!btn.disabled) btn.classList.toggle("accent", id === option.id);
      }
      tryFormPair();
    });

    rightButtons.set(option.id, rightButton);
    rightColumn.appendChild(rightButton);
  }

  submitButton.addEventListener("click", () => {
    if (pairs.length < totalPairsNeeded) return;
    onSubmit(pairs);
  });

  submitRow.appendChild(submitButton);
  container.appendChild(submitRow);

  return container;
}
