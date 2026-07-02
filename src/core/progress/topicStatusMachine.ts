// Deterministic per-topic status transition table (PROGRESS-02, D-06).
// Pure function: NO network, NO agent, NO side effects. Returns a status
// plus an optional transition signal; reward-granting and reviewQueue
// population consume that signal downstream — this function does not
// perform either of those actions itself.
import type { TopicStatus } from "../state/progressSchema";

export type { TopicStatus };

export interface TopicStatusResult {
  status: TopicStatus;
  transition: "entered_needs_review" | "entered_mastered" | null;
}

export function nextTopicStatus(
  current: TopicStatus,
  isCorrect: boolean,
  errorsAfterThisAttempt: number,
  correctStreakAfterThisAttempt: number,
): TopicStatusResult {
  // D-06's single "advance" rule: 3 correct-in-a-row from ANY current status -> mastered.
  if (isCorrect && correctStreakAfterThisAttempt >= 3) {
    return {
      status: "mastered",
      transition: current !== "mastered" ? "entered_mastered" : null,
    };
  }
  if (current === "not_started") {
    return { status: "in_progress", transition: null };
  }
  if (!isCorrect && errorsAfterThisAttempt >= 2) {
    return {
      status: "needs_review",
      transition: current !== "needs_review" ? "entered_needs_review" : null,
    };
  }
  if (current === "needs_review" && isCorrect) {
    // A correct answer while in needs_review returns to in_progress
    // (unless the 3-correct-streak branch above already fired mastered).
    return { status: "in_progress", transition: null };
  }
  return { status: current, transition: null };
}
