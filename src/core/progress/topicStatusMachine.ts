// Deterministic per-topic status transition table (PROGRESS-02, D-06).
// Pure function: NO network, NO agent, NO side effects. Returns a status
// plus an optional transition signal; reward-granting and reviewQueue
// population consume that signal downstream — this function does not
// perform either of those actions itself.
//
// WR-03 (intentional, documented accumulation semantics): the `errors`
// counter this function receives (errorsAfterThisAttempt, computed by the
// caller in evaluateAttempt.ts as prev.errors + 1 on an incorrect answer)
// accumulates for the ENTIRE LIFETIME of the topic — it is never reset on
// entering in_progress, on reaching mastered, or at any other point. This
// means: once a topic has EVER accumulated 2 total errors at any point in
// its history, a single isolated wrong answer at ANY later point — even
// long after the topic reached mastered and many correct answers later —
// immediately snaps the topic back to needs_review (see the
// `!isCorrect && errorsAfterThisAttempt >= 2` branch below, checked before
// the needs_review -> in_progress recovery branch). This is a deliberate,
// strict "any regression is a review signal" interpretation, not a bug —
// but it was not previously documented here, only the "3 correct-in-a-row"
// advance rule was. If a windowed/decaying/reset-on-mastery error model is
// ever desired instead (matching a "review, not permanent scarlet letter"
// spirit), that is a product decision to make explicitly, not a silent
// behavior change to this function.
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
