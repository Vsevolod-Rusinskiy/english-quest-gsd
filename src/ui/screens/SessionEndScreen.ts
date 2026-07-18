// Combined end-of-session screen (D-05/D-08): replaces the bare "Урок
// завершён!" message with ONE screen showing both the child-facing
// recommendation/motivational text and the parent report, rendered together
// after handleSessionEnd()'s sequential Progress Advisor -> Parent Report
// calls resolve. createElement/textContent only, never innerHTML (matches
// TheoryScreen.ts/ExerciseScreen.ts/FeedbackBanner.ts's established
// convention repo-wide, T-04-09). No visual polish this phase — Phase 5
// owns that (RESEARCH.md Specific Ideas).
import type { DifficultyMode } from "../../core/state/progressSchema";
import { topicLabel } from "../../core/topics/topicLabels";

export interface SessionEndScreenProps {
  recommendedFocus: string;
  motivationalMessageRu: string;
  suggestedDifficulty: DifficultyMode;
  parentReportRu: string;
  headlineRu: string;
  rublesEarned: number;
}

export function renderSessionEndScreen(props: SessionEndScreenProps): HTMLElement {
  const container = document.createElement("div");
  container.className = "session-end-screen";

  const childSection = document.createElement("div");
  childSection.className = "child-section";

  const motivational = document.createElement("p");
  // Unified design system: the celebratory line uses the shared accent
  // .section-title, matching TheoryScreen's heading language.
  motivational.className = "section-title";
  motivational.textContent = props.motivationalMessageRu;
  childSection.appendChild(motivational);

  const focus = document.createElement("p");
  focus.textContent = `Следующий фокус: ${topicLabel(props.recommendedFocus)}`;
  childSection.appendChild(focus);

  const rubles = document.createElement("p");
  rubles.textContent = `Заработано рублей: ${props.rublesEarned}`;
  childSection.appendChild(rubles);

  container.appendChild(childSection);

  const parentSection = document.createElement("div");
  parentSection.className = "parent-section";

  const headline = document.createElement("p");
  // Same shared accent .section-title as the child section and TheoryScreen.
  headline.className = "section-title";
  headline.textContent = props.headlineRu;
  parentSection.appendChild(headline);

  const report = document.createElement("p");
  report.className = "report-body";
  report.textContent = props.parentReportRu;
  parentSection.appendChild(report);

  container.appendChild(parentSection);

  return container;
}
