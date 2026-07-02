// Versioned localStorage load/save, defensive read (Pattern 2, D-03, PERSIST-01).
import * as z from "zod";
import { ProgressStateSchema, type ProgressState } from "./progressSchema";
import { initialState } from "./initialState";

export const PROGRESS_KEY = "english-quest-progress-v1";
export const CURRENT_SCHEMA_VERSION = 1;

const StoredBlobSchema = z.object({
  schemaVersion: z.number(),
  data: ProgressStateSchema,
});

export function load(currentLessonId?: string): ProgressState {
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (!raw) return initialState(currentLessonId);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("Corrupt progress JSON, resetting to fresh state");
    return initialState(currentLessonId);
  }

  const result = StoredBlobSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      "Progress blob failed validation, resetting to fresh state",
      z.prettifyError(result.error),
    );
    return initialState(currentLessonId);
  }
  if (result.data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    // Phase 1 ships schemaVersion 1 as the only version — no migration pipeline yet,
    // but the mismatch check must exist from day one.
    return initialState(currentLessonId);
  }
  // WR-02: a stored blob with no lessonId (legacy) or a lessonId that doesn't
  // match the currently-loaded lesson is stale — currentExerciseIndex and
  // exerciseStats would silently desync against different lesson content.
  if (
    currentLessonId !== undefined &&
    result.data.data.lessonId !== undefined &&
    result.data.data.lessonId !== currentLessonId
  ) {
    return initialState(currentLessonId);
  }
  return result.data.data;
}

export function save(state: ProgressState): void {
  const blob = { schemaVersion: CURRENT_SCHEMA_VERSION, data: state };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(blob)); // SYNCHRONOUS, no debounce (D-03)
  } catch (err) {
    console.warn("Failed to persist progress (quota/private mode?)", err);
    // Continue without persistence rather than crashing the dispatch cycle;
    // the in-memory state and listeners still update normally.
  }
}
