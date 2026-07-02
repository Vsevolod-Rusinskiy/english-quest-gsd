// Theory block: rule + example + always-visible Понятно/Не понятно buttons
// (THEORY-01, THEORY-02). createElement/textContent only.
import type { Theory } from "../../core/lesson/lessonSchema";

export interface TheoryScreenOptions {
  theory: Theory;
  onUnderstoodChoice: (understood: boolean) => void;
}

export function renderTheoryScreen(options: TheoryScreenOptions): HTMLElement {
  const { theory, onUnderstoodChoice } = options;
  const container = document.createElement("div");
  container.className = "theory-screen";

  const rule = document.createElement("p");
  rule.className = "display";
  rule.textContent = theory.rule;
  container.appendChild(rule);

  const firstLevel = theory.explanationLevels[0];
  if (firstLevel) {
    const example = document.createElement("p");
    example.textContent = firstLevel.exampleRu;
    container.appendChild(example);
  }

  const buttonRow = document.createElement("div");
  buttonRow.className = "theory-buttons";

  const understoodButton = document.createElement("button");
  understoodButton.type = "button";
  understoodButton.textContent = "Понятно";
  understoodButton.addEventListener("click", () => onUnderstoodChoice(true));

  const notUnderstoodButton = document.createElement("button");
  notUnderstoodButton.type = "button";
  notUnderstoodButton.textContent = "Не понятно";
  notUnderstoodButton.addEventListener("click", () => onUnderstoodChoice(false));

  buttonRow.appendChild(understoodButton);
  buttonRow.appendChild(notUnderstoodButton);
  container.appendChild(buttonRow);

  return container;
}
