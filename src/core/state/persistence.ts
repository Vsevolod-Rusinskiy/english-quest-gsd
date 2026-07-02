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

export function load(): ProgressState {
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (!raw) return initialState();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("Corrupt progress JSON, resetting to fresh state");
    return initialState();
  }

  const result = StoredBlobSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(
      "Progress blob failed validation, resetting to fresh state",
      z.prettifyError(result.error),
    );
    return initialState();
  }
  if (result.data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    // Phase 1 ships schemaVersion 1 as the only version — no migration pipeline yet,
    // but the mismatch check must exist from day one.
    return initialState();
  }
  return result.data.data;
}

export function save(state: ProgressState): void {
  const blob = { schemaVersion: CURRENT_SCHEMA_VERSION, data: state };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(blob)); // SYNCHRONOUS, no debounce (D-03)
}
