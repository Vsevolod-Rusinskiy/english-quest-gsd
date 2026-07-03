// Deterministic difficultyMode guardrail (PERSONAL-02, SPEC.md §12).
// Pure function: NO network, NO agent, NO state read/write beyond its
// explicit parameters. This is the ONLY function permitted to decide
// studentProfile.difficultyMode's next value — the Progress Advisor's
// suggestedDifficulty (src/core/agents/progressAdvisor.ts) is one INPUT to
// this function, never a direct assignment to state (CLAUDE.md's "agent
// proposes, core writes" boundary, T-04-05).
//
// Rules enforced (SPEC.md §12, D-09/D-10):
//   (a) No direct easy<->challenge jump — moving from easy toward challenge
//       or vice versa is capped to exactly ONE step per call (easy->normal
//       or challenge->normal), never landing directly on the opposite
//       extreme in one call.
//   (b) Upward movement (normal->challenge or easy->normal) requires
//       signals.correctStreak >= 3.
//   (c) Downward movement (normal->easy or challenge->normal) requires
//       signals.recentErrors >= 2.
//   (d) If suggested === current, or the relevant gate isn't met, return
//       current unchanged.
//
// Two-step-jump interpretation (test 7, documented per PATTERNS.md/RESEARCH.md
// guidance): when the agent suggests a 2-step jump (easy->challenge or
// challenge->easy) AND the corresponding gate IS met, this function advances
// ONE step toward the suggestion (to "normal") rather than making no change
// at all — "one step at a time toward the suggestion, capped to a single
// step per call" is the chosen behavior, since PERSONAL-02's guardrail is
// evaluated once per session-end call (D-10), so a genuinely-warranted trend
// should not be silently discarded, only rate-limited to one step. If the
// gate for that one step is NOT met, the two-step suggestion is treated
// identically to any other insufficient-signal case: no change at all.
import type { DifficultyMode } from "../state/progressSchema";

export interface DifficultyGuardrailSignals {
  correctStreak: number;
  recentErrors: number;
}

const ORDER: DifficultyMode[] = ["easy", "normal", "challenge"];
const RANK: Record<DifficultyMode, number> = { easy: 0, normal: 1, challenge: 2 };

export function applyDifficultyGuardrails(
  current: DifficultyMode,
  suggested: DifficultyMode,
  signals: DifficultyGuardrailSignals,
): DifficultyMode {
  if (suggested === current) {
    return current;
  }

  const currentRank = RANK[current];
  const suggestedRank = RANK[suggested];
  const direction = suggestedRank > currentRank ? 1 : -1;

  if (direction > 0) {
    // Upward: gate is 3-correct-streak (rule b). Cap to exactly one step
    // regardless of how many ranks the suggestion jumped (rule a).
    if (signals.correctStreak < 3) {
      return current;
    }
    return ORDER[currentRank + 1];
  }

  // Downward: gate is 2-recent-errors (rule c). Cap to exactly one step.
  if (signals.recentErrors < 2) {
    return current;
  }
  return ORDER[currentRank - 1];
}
