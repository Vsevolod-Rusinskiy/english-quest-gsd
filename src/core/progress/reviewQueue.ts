// Review-queue population scan (PROGRESS-03, D-02).
// Pure function: NO I/O, NO agent. Scans ALL lesson exercises for a topic
// (not just the one just answered), excludes exercises already answered
// correctly this session, and dedups against the current queue.
import type { Exercise } from "../lesson/lessonSchema";
import type { ExerciseStat } from "../state/progressSchema";

export function enqueueReviewItems(
  allExercises: Exercise[],
  topic: string,
  exerciseStats: Record<string, ExerciseStat>,
  currentQueue: string[],
): string[] {
  const eligible = allExercises
    .filter((ex) => ex.topicImpact.includes(topic))
    .filter((ex) => (exerciseStats[ex.exerciseId]?.correct ?? 0) === 0)
    .map((ex) => ex.exerciseId)
    .filter((id) => !currentQueue.includes(id));
  return [...currentQueue, ...eligible];
}
