// In-memory StateStore with dispatch/subscribe, save-on-dispatch (D-03).
// save() is called ONLY here — never from UI input listeners (Pitfall 3).
import type { ProgressState } from "./progressSchema";
import { save } from "./persistence";

export type Action =
  | { type: "theory_step"; understood: boolean }
  | { type: "exercise_attempt"; exerciseId: string; isCorrect: boolean }
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
          currentPosition: { ...state.currentPosition, theoryUnderstood: true },
        };
      case "exercise_attempt": {
        const prevStat = state.exerciseStats[action.exerciseId] ?? { attempts: 0, correct: 0 };
        return {
          ...state,
          exerciseStats: {
            ...state.exerciseStats,
            [action.exerciseId]: {
              attempts: prevStat.attempts + 1,
              correct: prevStat.correct + (action.isCorrect ? 1 : 0),
            },
          },
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
