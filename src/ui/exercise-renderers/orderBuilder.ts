// order-builder renderer: tap-based word bank + sequence (D-05, EXERCISE-04).
// NO drag-and-drop. Tapping a bank chip appends it to the sequence and removes it
// from the bank; tapping a sequence chip removes it and returns it to the bank.
// Emits AnswerSubmitted upward — never calls save() itself (Pitfall 3).
// Reference: 01-RESEARCH.md Pattern 3 (bank/sequence arrays).
import type { OrderBuilderExercise } from "../../core/lesson/lessonSchema";

export interface OrderBuilderOptions {
  exercise: OrderBuilderExercise;
  instructionRu: string;
  instructionEn: string;
  onSubmit: (sequence: string[]) => void;
}

export function renderOrderBuilder(options: OrderBuilderOptions): HTMLElement {
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
  prompt.textContent = exercise.prompt;
  container.appendChild(prompt);

  let bank: string[] = [...exercise.wordBank];
  let sequence: string[] = [];

  const bankLabel = document.createElement("p");
  bankLabel.className = "label";
  bankLabel.textContent = "Слова:";
  container.appendChild(bankLabel);

  const bankZone = document.createElement("div");
  bankZone.className = "word-bank-zone";
  container.appendChild(bankZone);

  const sequenceLabel = document.createElement("p");
  sequenceLabel.className = "label";
  sequenceLabel.textContent = "Твой ответ:";
  container.appendChild(sequenceLabel);

  const sequenceZone = document.createElement("div");
  sequenceZone.className = "sequence-zone";
  container.appendChild(sequenceZone);

  const submitRow = document.createElement("div");
  submitRow.className = "submit-row";

  const submitButton = document.createElement("button");
  submitButton.type = "button";
  submitButton.className = "accent";
  submitButton.textContent = "Проверить";
  submitButton.disabled = true;

  function tapBankChip(index: number): void {
    const [word] = bank.splice(index, 1);
    sequence = [...sequence, word];
    renderZones();
  }

  function tapSequenceChip(index: number): void {
    const [word] = sequence.splice(index, 1);
    bank = [...bank, word];
    renderZones();
  }

  function renderZones(): void {
    bankZone.textContent = "";
    bank.forEach((word, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "bank-chip";
      chip.textContent = word;
      chip.addEventListener("click", () => tapBankChip(index));
      bankZone.appendChild(chip);
    });

    sequenceZone.textContent = "";
    sequence.forEach((word, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sequence-chip accent";
      chip.textContent = word;
      chip.addEventListener("click", () => tapSequenceChip(index));
      sequenceZone.appendChild(chip);
    });

    submitButton.disabled = sequence.length === 0;
  }

  renderZones();

  submitButton.addEventListener("click", () => {
    if (sequence.length === 0) return;
    onSubmit(sequence);
  });

  submitRow.appendChild(submitButton);
  container.appendChild(submitRow);

  return container;
}
