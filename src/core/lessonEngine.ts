// Theory -> exercise orchestrator (Phase 1 slice + Phase 2 progress/reward wiring
// + Phase 3 Answer Checker wiring). Cites THEORY-01, THEORY-02, EXERCISE-01..05,
// CHECK-01, CHECK-02, CHECK-03, CHECK-04, PROGRESS-01/02/03, REWARD-01/02, RELY-03.
import type { Lesson, Exercise } from "./lesson/lessonSchema";
import type { StateStore } from "./state/store";
import { checkTextInput, type CheckResult } from "./answer-checking/checkTextInput";
import { checkSingleChoice } from "./answer-checking/checkSingleChoice";
import { checkMatching } from "./answer-checking/checkMatching";
import { checkOrderBuilder } from "./answer-checking/checkOrderBuilder";
import type { MatchingPair } from "../ui/exercise-renderers/matching";
import { evaluateAttempt } from "./progress/evaluateAttempt";
import { callAnswerChecker } from "./agents/answerChecker";
import { callTheoryTutor } from "./agents/theoryTutor";
import { callRewardAdvisor } from "./agents/rewardAdvisor";

export type AnswerPayload = string | MatchingPair[] | string[];

// Phase 3 Plan 02 (THEORY-03, D-11, RESEARCH.md Open Question 2): the
// explanation TEXT for the round just served — transient, NOT persisted in
// state (only simplifyRoundCount is). null once theoryUnderstood becomes
// true (soft transition or explicit "понятно"), since the theory screen is
// no longer shown at that point.
export interface TheoryStepResult {
  explanation: { textRu: string; exampleRu: string } | null;
}

// Plan 04-01 (REWARD-03, REWARD-04, D-04, A3): praiseRu is TRANSIENT
// per-dispatch metadata, never persisted to ProgressStateSchema (mirrors
// currentExplanation's precedent in main.ts) — it is returned directly from
// handleAnswer rather than threaded through the store's exercise_attempt
// dispatch/reducer, since the store's Action union stays unchanged and no
// new schema field is needed. undefined when this answer produced zero
// reward events, when the agent failed/was never called, or when none of
// its suggestedReasons matched a reason the core actually granted.
export interface HandleAnswerResult extends CheckResult {
  praiseRu?: string;
}

export class LessonEngine {
  readonly lesson: Lesson;
  readonly store: StateStore;
  readonly exercises: Exercise[];

  constructor(lesson: Lesson, store: StateStore) {
    this.lesson = lesson;
    this.store = store;
    this.exercises = lesson.sections.flatMap((section) => section.exercises);
  }

  get totalExercises(): number {
    return this.exercises.length;
  }

  // Review-pass cursor (PROGRESS-04, D-02, Pitfall 4). The main exercises
  // array is NEVER mutated — the review pass is a second cursor resolved by
  // looking up reviewQueue ids against this.exercises. Chosen model: since
  // completing a review item ALWAYS dequeues it (correct or not, D-02), the
  // head of reviewQueue is always the current review item — reviewPassIndex
  // stays at 0 and is intentionally left unused (kept in the schema for
  // forward-compatibility only, per the plan's explicit discretion clause).
  isReviewPass(): boolean {
    const state = this.store.getState();
    return (
      state.currentPosition.currentExerciseIndex >= this.totalExercises &&
      state.reviewQueue.length > 0
    );
  }

  getCurrentExerciseId(): string | null {
    const state = this.store.getState();
    const { currentExerciseIndex } = state.currentPosition;
    if (currentExerciseIndex < this.totalExercises) {
      return this.exercises[currentExerciseIndex].exerciseId;
    }
    if (state.reviewQueue.length > 0) {
      // Pitfall 5: reuse the ORIGINAL exerciseId, never a synthetic id, so
      // reward dedup (exerciseId, reason) correctly recognizes a re-visited
      // exercise instead of farming a second first_try_correct.
      return state.reviewQueue[0];
    }
    return null;
  }

  getCurrentExercise(): Exercise | null {
    const id = this.getCurrentExerciseId();
    if (id === null) return null;
    return this.exercises.find((e) => e.exerciseId === id) ?? null;
  }

  // Phase 3 Plan 02 (THEORY-03, D-11): full round-sequencing implementation.
  // "понятно" exits immediately (THEORY-01/02, unchanged). "не понятно"
  // branches by simplifyRoundCount:
  //   - count === 0 (round 1): CORE-ONLY, no agent call — the caller-visible
  //     text is theory.explanationLevels[1] ("simple"); count -> 1.
  //   - count is 1 or 2 (rounds 2-3): await callTheoryTutor via the shared
  //     gateway; count -> count+1; source/agentFailed recorded from the
  //     gateway's result.
  //   - once the incremented count reaches theory.maxSimplifyRounds (3):
  //     SOFT TRANSITION — theoryUnderstood becomes true regardless of the
  //     last answer, the first exercise renders next.
  // Exactly one theory_step dispatch per call (single-dispatch invariant).
  async handleTheoryStep(understood: boolean): Promise<TheoryStepResult> {
    if (understood) {
      this.store.dispatch({
        type: "theory_step",
        theoryUnderstood: true,
        simplifyRoundCount: this.store.getState().currentPosition.simplifyRoundCount,
        source: "core",
        agentFailed: false,
      });
      return { explanation: null };
    }

    const state = this.store.getState();
    const { simplifyRoundCount } = state.currentPosition;
    const { explanationLevels, maxSimplifyRounds, rule } = this.lesson.theory;
    const simpleLevel = explanationLevels[1];

    let nextCount: number;
    let source: "core" | "agent" = "core";
    let agentFailed = false;
    // The text to show for the round just served (Open Question 2:
    // transient, returned to the caller, never persisted in state).
    let explanation: { textRu: string; exampleRu: string } = {
      textRu: simpleLevel?.textRu ?? "",
      exampleRu: simpleLevel?.exampleRu ?? "",
    };

    if (simplifyRoundCount === 0) {
      // Round 1: core-only, no agent call (D-11) — pre-written "simple" level.
      nextCount = 1;
    } else {
      // Rounds 2-3: call Theory Tutor via the shared gateway. On failure the
      // gateway's fallback re-serves simpleLevel verbatim (never fabricated).
      const currentLevelText = simpleLevel?.textRu ?? this.lesson.theory.rule;
      const tutorResult = await callTheoryTutor({
        rule,
        currentLevelText,
        fallbackLevel: {
          textRu: simpleLevel?.textRu ?? "",
          exampleRu: simpleLevel?.exampleRu ?? "",
        },
        roundNumber: simplifyRoundCount + 1,
      });
      nextCount = simplifyRoundCount + 1;
      source = tutorResult.source;
      agentFailed = tutorResult.source === "core";
      explanation = { textRu: tutorResult.explanationRu, exampleRu: tutorResult.exampleRu };
    }

    // Soft transition: reaching maxSimplifyRounds advances to practice
    // regardless of the last answer being "не понятно".
    const theoryUnderstood = nextCount >= maxSimplifyRounds;

    this.store.dispatch({
      type: "theory_step",
      theoryUnderstood,
      simplifyRoundCount: nextCount,
      source,
      agentFailed,
    });

    return { explanation: theoryUnderstood ? null : explanation };
  }

  async handleAnswer(exerciseId: string, answer: AnswerPayload): Promise<HandleAnswerResult> {
    const exercise = this.exercises.find((e) => e.exerciseId === exerciseId);
    if (!exercise) {
      throw new Error(`Unknown exerciseId: ${exerciseId}`);
    }

    // Every type routes to a Plan 02 deterministic core checker first. Each
    // branch validates the payload shape at runtime before forwarding it, so
    // a mismatched caller gets a clear Error instead of a silent,
    // nonsensical undefined-based comparison (WR-01).
    let result: CheckResult;
    // Phase 3 (RELY-03, D-08): true only when the text-input branch actually
    // invoked callAnswerChecker (an exact-match failure, D-10) — used below
    // to distinguish "agent attempted and fell back" (agentFailed:true) from
    // "no agent call at all" (agentFailed:false), since both end up with
    // result.source:"core" and are otherwise indistinguishable.
    let agentAttempted = false;
    switch (exercise.type) {
      case "text-input": {
        if (typeof answer !== "string") {
          throw new Error(`handleAnswer: expected string for exerciseId ${exerciseId}`);
        }
        const deterministicResult = checkTextInput(exercise, answer);
        // CHECK-03, D-09: an exact-match failure is the trigger to call
        // Answer Checker via the gateway — NOT immediately final. The await
        // MUST complete before evaluateAttempt runs below (D-10: only
        // text-input triggers the agent; every other branch stays fully
        // deterministic, no agent call at all).
        if (deterministicResult.isCorrect) {
          result = deterministicResult;
        } else {
          agentAttempted = true;
          result = await callAnswerChecker({
            prompt: exercise.prompt,
            correctAnswers: exercise.answerCheck.correctAnswers,
            acceptedAnswers: exercise.answerCheck.acceptedAnswers,
            childAnswer: answer,
          });
        }
        break;
      }
      case "single-choice":
        if (typeof answer !== "string") {
          throw new Error(`handleAnswer: expected string for exerciseId ${exerciseId}`);
        }
        result = checkSingleChoice(exercise, answer);
        break;
      case "matching":
        if (
          !Array.isArray(answer) ||
          answer.some((p) => typeof p !== "object" || p === null || !("leftId" in p))
        ) {
          throw new Error(`handleAnswer: expected MatchingPair[] for exerciseId ${exerciseId}`);
        }
        result = checkMatching(exercise, answer as MatchingPair[]);
        break;
      case "order-builder":
        if (!Array.isArray(answer) || answer.some((t) => typeof t !== "string")) {
          throw new Error(`handleAnswer: expected string[] for exerciseId ${exerciseId}`);
        }
        result = checkOrderBuilder(exercise, answer as string[]);
        break;
      default: {
        const _exhaustive: never = exercise;
        throw new Error(`Unhandled exercise type: ${JSON.stringify(_exhaustive)}`);
      }
    }

    // Phase 2: compute the ENTIRE per-answer update (topic loop, FSM, review
    // queue, rewards) as one pure evaluateAttempt() call, then fold it into
    // this SAME dispatch (Pitfall 3) — the conditional advance_position
    // dispatch below is Phase 1's existing second call site, unchanged.
    const state = this.store.getState();
    const priorAttempts = state.exerciseStats[exerciseId]?.attempts ?? 0;
    const delta = evaluateAttempt(state, exercise, result, priorAttempts, this.exercises);

    // Plan 04-01 (REWARD-03, REWARD-04, D-01/D-02/D-03): one Reward Advisor
    // call per answer (never per event) — only when this answer produced at
    // least one reward event. The core (not the agent) remains the sole
    // source of truth for which rewards actually happened: the agent's
    // suggestedReasons are cross-checked against delta.rewardEvents (this
    // answer's ALREADY core-decided grants) before praiseRu is ever
    // surfaced — an agent hallucinating an ungranted reason (e.g.
    // suggesting streak_bonus when no streak fired) results in
    // praiseRu:undefined, identical to an agent-failure outcome. This
    // mirrors the "agent proposes, core validates before use" framing
    // already established by answerChecker.ts's confidence-threshold gate.
    // Amounts/rewardHistory writes below are entirely untouched by this gate.
    let praiseRu: string | undefined;
    if (delta.rewardEvents.length > 0) {
      const advisorResult = await callRewardAdvisor({
        rewardEvents: delta.rewardEvents,
        attemptNumber: priorAttempts + 1,
        rewardHistory: state.rewardHistory,
        currentCorrectStreak: state.currentCorrectStreak,
      });
      const grantedReasons = new Set(delta.rewardEvents.map((e) => e.reason));
      const trustedReasons = advisorResult.suggestedReasons.filter((r) => grantedReasons.has(r));
      if (advisorResult.source === "agent" && trustedReasons.length > 0) {
        praiseRu = advisorResult.celebrationRu;
      }
    }

    // Plan 03 (PROGRESS-04, D-02): a review-pass answer dequeues the completed
    // item REGARDLESS of correctness — same single exercise_attempt dispatch,
    // no separate action type. Determined BEFORE the dispatch since the
    // dequeue check reads the current (pre-dispatch) reviewQueue head.
    const wasReviewPass = this.isReviewPass() && this.getCurrentExerciseId() === exerciseId;

    // Phase 3 (RELY-03, D-08): source/agentFailed reflect the FINAL result —
    // agent success -> source:"agent", agentFailed:false; agent fallback ->
    // source:"core", agentFailed:true (the agent was attempted and failed);
    // no agent call at all (deterministic path) -> source:"core",
    // agentFailed:false.
    const agentFailed = agentAttempted && result.source === "core";

    this.store.dispatch({
      type: "exercise_attempt",
      exerciseId,
      isCorrect: result.isCorrect,
      topicUpdates: delta.topicUpdates,
      reviewQueueAdditions: delta.reviewQueueAdditions,
      rewardEvents: delta.rewardEvents,
      nextCorrectStreak: delta.nextCorrectStreak,
      reviewDequeueId: wasReviewPass ? exerciseId : undefined,
      source: result.source,
      agentFailed,
    });
    // Main-pass correct answer: advance currentExerciseIndex (unchanged Phase 1
    // behavior). Review-pass answers never advance_position — the review cursor
    // is entirely reviewQueue-length-driven (dequeue above IS the advance).
    if (result.isCorrect && !wasReviewPass) {
      this.store.dispatch({ type: "advance_position" });
    }
    return { ...result, praiseRu };
  }
}
