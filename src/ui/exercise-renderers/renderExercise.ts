// Dispatcher: exercise.type -> correct renderer. Exhaustive over all 4 types
// (TypeScript never-check on the default branch) — no throw path remains (Plan 03).
import type { Exercise } from "../../core/lesson/lessonSchema";
import { renderTextInput } from "./textInput";
import { renderSingleChoice } from "./singleChoice";
import { renderMatching, type MatchingPair } from "./matching";
import { renderOrderBuilder } from "./orderBuilder";

export type AnswerPayload = string | MatchingPair[] | string[];

export interface RenderExerciseOptions {
  exercise: Exercise;
  onSubmit: (answer: AnswerPayload) => void;
}

export function renderExercise(options: RenderExerciseOptions): HTMLElement {
  const { exercise, onSubmit } = options;

  switch (exercise.type) {
    case "text-input":
      return renderTextInput({ exercise, onSubmit });
    case "single-choice":
      return renderSingleChoice({ exercise, onSubmit });
    case "matching":
      return renderMatching({ exercise, onSubmit });
    case "order-builder":
      return renderOrderBuilder({ exercise, onSubmit });
    default: {
      const _exhaustive: never = exercise;
      throw new Error(`Unhandled exercise type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
