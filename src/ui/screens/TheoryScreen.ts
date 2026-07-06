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

// SMOKE-FIX-03: splits presentational text on sentence-boundary punctuation
// (. ! ?) followed by whitespace, keeping the terminating punctuation on
// each piece. Purely a render-time concern — Lesson-1A.json's theory.rule /
// explanationLevels[].textRu data shape is unchanged. Operates on already-
// Zod-validated strings (lesson data or agent/fallback text validated
// upstream), so this introduces no new injection surface (T-nxg-02). Falls
// back to the single trimmed string when no sentence boundary is found.
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g);
  if (!matches) {
    const trimmed = text.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return matches.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);
}

function appendSentenceParagraphs(
  container: HTMLElement,
  text: string,
  firstParagraphClassName?: string,
): void {
  const sentences = splitSentences(text);
  sentences.forEach((sentence, index) => {
    const paragraph = document.createElement("p");
    if (index === 0 && firstParagraphClassName) {
      paragraph.className = firstParagraphClassName;
    }
    paragraph.textContent = sentence;
    container.appendChild(paragraph);
  });
}

export function renderTheoryScreen(options: TheoryScreenOptions): HTMLElement {
  const { theory, onUnderstoodChoice, currentExplanation } = options;
  const container = document.createElement("div");
  container.className = "theory-screen";

  appendSentenceParagraphs(container, theory.rule, "display");

  const firstLevel = theory.explanationLevels[0];
  const activeExplanation: TheoryExplanation | null =
    currentExplanation ??
    (firstLevel ? { textRu: firstLevel.textRu, exampleRu: firstLevel.exampleRu } : null);

  if (activeExplanation) {
    appendSentenceParagraphs(container, activeExplanation.textRu);

    const example = document.createElement("p");
    example.textContent = activeExplanation.exampleRu;
    container.appendChild(example);
  }

  const buttonRow = document.createElement("div");
  buttonRow.className = "theory-buttons";

  const understoodButton = document.createElement("button");
  understoodButton.type = "button";
  understoodButton.className = "theory-toggle";
  understoodButton.textContent = "Понятно";
  understoodButton.addEventListener("click", () => onUnderstoodChoice(true));

  const notUnderstoodButton = document.createElement("button");
  notUnderstoodButton.type = "button";
  notUnderstoodButton.className = "theory-toggle";
  notUnderstoodButton.textContent = "Не понятно";
  notUnderstoodButton.addEventListener("click", () => onUnderstoodChoice(false));

  buttonRow.appendChild(understoodButton);
  buttonRow.appendChild(notUnderstoodButton);
  container.appendChild(buttonRow);

  return container;
}
