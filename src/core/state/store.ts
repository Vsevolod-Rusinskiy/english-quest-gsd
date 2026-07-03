// In-memory StateStore with dispatch/subscribe, save-on-dispatch (D-03).
// save() is called ONLY here — never from UI input listeners (Pitfall 3).
import type { ProgressState, TopicStat, RewardEvent, WordStat, ExerciseTypeStat } from "./progressSchema";
import { save } from "./persistence";

export type Action =
  | {
      type: "theory_step";
      // Phase 3 Plan 02 (THEORY-03, D-11): the engine (not the reducer)
      // decides theoryUnderstood — true on an explicit "понятно" tap OR on
      // reaching maxSimplifyRounds (soft transition), false while still
      // mid-simplify-loop. The reducer honors this rather than hardcoding
      // true as the Phase 1 stub did.
      theoryUnderstood: boolean;
      // The new persisted round count to write into currentPosition
      // (D-11, RESEARCH.md Open Question 2) — 0 on an immediate "понятно"
      // exit (no simplify loop was entered this call), incremented by the
      // engine otherwise.
      simplifyRoundCount: number;
      // RELY-03/D-08: mirrors exercise_attempt's source/agentFailed
      // convention — source:"agent" only when Theory Tutor's call
      // succeeded this step; agentFailed:true when an agent call was
      // attempted (rounds 2-3) and fell back to core.
      source: "core" | "agent";
      agentFailed: boolean;
    }
  | {
      type: "exercise_attempt";
      exerciseId: string;
      isCorrect: boolean;
      // Phase 2 (PROGRESS-01/02/03, REWARD-01/02): the FULL evaluateAttempt()
      // delta folds into this SAME action so one dispatch = one save = one
      // render per answer (Pitfall 3) — no topic_status_updated / review_queue_
      // updated / reward_granted action types.
      topicUpdates: Record<string, TopicStat>;
      reviewQueueAdditions: string[];
      rewardEvents: RewardEvent[];
      nextCorrectStreak: number;
      // Phase 4 Plan 02 (PERSONAL-01, D-11/D-12): wordStats/exerciseTypeStats
      // deltas fold into this SAME dispatch alongside topicUpdates — no new
      // action type, same single-dispatch-per-answer invariant.
      wordUpdates: Record<string, WordStat>;
      exerciseTypeUpdates: Record<string, ExerciseTypeStat>;
      // Session-global "consecutive incorrect" counter, mirrors
      // nextCorrectStreak's exact shape/reset semantics (RESEARCH.md Open
      // Question 1, resolved) — feeds the confidenceScore formula.
      nextErrorStreak: number;
      // Phase 2 Plan 03 (PROGRESS-04, D-02): set when this answer was for the
      // CURRENT review-pass item — the reduce branch removes it from
      // reviewQueue as part of this SAME dispatch (dequeue whether correct
      // or not, folded into the single exercise_attempt reduce, not a new
      // action type).
      reviewDequeueId?: string;
      // Phase 3 (RELY-03, D-08): every exercise_attempt records whether the
      // verdict came from the deterministic core or an agent, and whether an
      // agent call was attempted and failed (fell back to core) — folds into
      // this SAME dispatch, no new action type, per the single-dispatch
      // invariant. Deterministic exact-match / non-text-input answers always
      // record source:"core", agentFailed:false (D-10 — no agent call at all).
      source: "core" | "agent";
      agentFailed: boolean;
    }
  | { type: "advance_position" };

export type Listener = (state: ProgressState) => void;

export class StateStore {
  private state: ProgressState;
  private listeners: Set<Listener> = new Set();

  constructor(initial: ProgressState) {
    this.state = initial;
  }

  getState(): ProgressState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(action: Action): void {
    this.state = this.reduce(this.state, action);
    save(this.state); // synchronous write after every state-changing action (D-03)
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private reduce(state: ProgressState, action: Action): ProgressState {
    switch (action.type) {
      case "theory_step":
        return {
          ...state,
          currentPosition: {
            ...state.currentPosition,
            theoryUnderstood: action.theoryUnderstood,
            simplifyRoundCount: action.simplifyRoundCount,
          },
        };
      case "exercise_attempt": {
        const prevStat = state.exerciseStats[action.exerciseId] ?? {
          attempts: 0,
          correct: 0,
          lastAttemptCorrect: false,
          lastAttemptSource: "core" as const,
          lastAttemptAgentFailed: false,
        };
        const addedRewardTotal = action.rewardEvents.reduce((sum, e) => sum + e.amount, 0);
        return {
          ...state,
          exerciseStats: {
            ...state.exerciseStats,
            [action.exerciseId]: {
              attempts: prevStat.attempts + 1,
              correct: prevStat.correct + (action.isCorrect ? 1 : 0),
              // CR-02: overwritten every attempt (not accumulated) so
              // enqueueReviewItems can distinguish "resolved in the current
              // needs_review episode" from a lifetime correct count.
              lastAttemptCorrect: action.isCorrect,
              // Phase 3 (RELY-03, D-08): overwritten every attempt, same
              // "most recent" convention as lastAttemptCorrect above.
              lastAttemptSource: action.source,
              lastAttemptAgentFailed: action.agentFailed,
            },
          },
          topicStats: { ...state.topicStats, ...action.topicUpdates },
          // Apply additions then removal: a review answer can simultaneously
          // enqueue NEW ids (re-triggered needs_review on a different topic)
          // and dequeue the just-completed one — the completed item must end
          // up removed even if it were somehow present in additions too.
          reviewQueue: [
            ...state.reviewQueue,
            ...action.reviewQueueAdditions.filter((id) => !state.reviewQueue.includes(id)),
          ].filter((id) => id !== action.reviewDequeueId),
          rewardHistory: [...state.rewardHistory, ...action.rewardEvents],
          currentRewards: state.currentRewards + addedRewardTotal,
          currentCorrectStreak: action.nextCorrectStreak,
          wordStats: { ...state.wordStats, ...action.wordUpdates },
          exerciseTypeStats: { ...state.exerciseTypeStats, ...action.exerciseTypeUpdates },
          currentErrorStreak: action.nextErrorStreak,
        };
      }
      case "advance_position":
        return {
          ...state,
          currentPosition: {
            ...state.currentPosition,
            currentExerciseIndex: state.currentPosition.currentExerciseIndex + 1,
          },
        };
      default:
        return state;
    }
  }
}
