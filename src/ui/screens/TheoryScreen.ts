// Theory block: rule + example + always-visible Понятно/Не понятно buttons
// (THEORY-01, THEORY-02). createElement/textContent only. Phase 3 Plan 02
// (THEORY-03, D-11): renders round-aware text via currentExplanation (agent/
// fallback/pre-written) instead of always hardcoding explanationLevels[0].
import type { Theory } from "../../core/lesson/lessonSchema";

export interface TheoryExplanation {
  textRu: string;
  exampleRu: string;
}

export interface TheoryScreenOptions {
  theory: Theory;
  onUnderstoodChoice: (understood: boolean) => void;
  // Phase 3 Plan 02 (THEORY-03, D-11): the currently-active explanation to
  // render — round 1's explanationLevels[1], rounds 2-3's agent/fallback
  // text, or null for the initial pre-simplify view (falls back to
  // explanationLevels[0], the "normal" level).
  currentExplanation?: TheoryExplanation | null;
}

export function renderTheoryScreen(options: TheoryScreenOptions): HTMLElement {
  const { theory, onUnderstoodChoice, currentExplanation } = options;
  const container = document.createElement("div");
  container.className = "theory-screen";

  const rule = document.createElement("p");
  rule.className = "display";
  rule.textContent = theory.rule;
  container.appendChild(rule);

  const firstLevel = theory.explanationLevels[0];
  const activeExplanation: TheoryExplanation | null =
    currentExplanation ??
    (firstLevel ? { textRu: firstLevel.textRu, exampleRu: firstLevel.exampleRu } : null);

  if (activeExplanation) {
    const explanationText = document.createElement("p");
    explanationText.textContent = activeExplanation.textRu;
    container.appendChild(explanationText);

    const example = document.createElement("p");
    example.textContent = activeExplanation.exampleRu;
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
