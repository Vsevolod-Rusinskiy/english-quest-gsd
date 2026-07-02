// Review-queue population scan (PROGRESS-03, D-02).
// Pure function: NO I/O, NO agent. Scans ALL lesson exercises for a topic
// (not just the one just answered), excludes exercises whose MOST RECENT
// attempt was correct (CR-02 — not "ever answered correctly," which would
// permanently exclude an exercise after a single past success even if the
// topic later regresses to needs_review), and dedups against the current
// queue.
import type { Exercise } from "../lesson/lessonSchema";
import type { ExerciseStat } from "../state/progressSchema";

export function enqueueReviewItems(
  allExercises: Exercise[],
  topic: string,
  exerciseStats: Record<string, ExerciseStat>,
  currentQueue: string[],
): string[] {
  // CR-02: eligibility must reflect "not correctly answered in the CURRENT
  // needs_review episode," not "never correctly answered ever." A lifetime
  // `correct` counter never resets, so an exercise answered correctly once
  // in the past would be permanently excluded even after the topic later
  // regresses to needs_review and that same exercise is answered wrong
  // again. `lastAttemptCorrect` reflects only the most recent outcome.
  const eligible = allExercises
    .filter((ex) => ex.topicImpact.includes(topic))
    .filter((ex) => !(exerciseStats[ex.exerciseId]?.lastAttemptCorrect ?? false))
    .map((ex) => ex.exerciseId)
    .filter((id) => !currentQueue.includes(id));
  return [...currentQueue, ...eligible];
}
