// Exercise screen: renders the type-specific input UI + feedback banner after submit.
// Phase 1 only implements the text-input renderer; other types route through
// LessonEngine's honest "not yet wired" error (Plan 03).
import type { Exercise } from "../../core/lesson/lessonSchema";
import { renderTextInput } from "../exercise-renderers/textInput";
import { renderFeedbackBanner } from "../components/FeedbackBanner";

export interface ExerciseScreenOptions {
  exercise: Exercise;
  onSubmit: (rawAnswer: string) => void;
}

export function renderExerciseScreen(options: ExerciseScreenOptions): HTMLElement {
  const { exercise, onSubmit } = options;

  if (exercise.type === "text-input") {
    return renderTextInput({ exercise, onSubmit });
  }

  // Other exercise types are not yet implemented in Phase 1 (Plan 03 territory).
  const placeholder = document.createElement("div");
  placeholder.className = "task-card";
  const message = document.createElement("p");
  message.textContent = `Тип упражнения "${exercise.type}" появится в следующем плане.`;
  placeholder.appendChild(message);
  return placeholder;
}

export { renderFeedbackBanner };
