// Exercise screen: renders the type-specific input UI via the renderExercise
// dispatcher + feedback banner after submit. All 4 exercise types are wired
// (Plan 03) — no placeholder path remains.
import type { Exercise } from "../../core/lesson/lessonSchema";
import { renderExercise, type AnswerPayload } from "../exercise-renderers/renderExercise";
import { renderFeedbackBanner } from "../components/FeedbackBanner";

export interface ExerciseScreenOptions {
  exercise: Exercise;
  onSubmit: (answer: AnswerPayload) => void;
}

export function renderExerciseScreen(options: ExerciseScreenOptions): HTMLElement {
  const { exercise, onSubmit } = options;
  return renderExercise({ exercise, onSubmit });
}

export { renderFeedbackBanner };
