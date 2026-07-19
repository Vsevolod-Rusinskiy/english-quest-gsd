// Theory -> exercise orchestrator (Phase 1 slice + Phase 2 progress/reward wiring
// + Phase 3 Answer Checker wiring). Cites THEORY-01, THEORY-02, EXERCISE-01..05,
// CHECK-01, CHECK-02, CHECK-03, CHECK-04, PROGRESS-01/02/03, REWARD-01/02, RELY-03.
import type { Lesson, Exercise, Section } from "./lesson/lessonSchema";
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
import { callProgressAdvisor } from "./agents/progressAdvisor";
import { callParentReportGenerator } from "./agents/parentReportGenerator";
import { computeConfidenceScore } from "./personalization/confidenceScore";
import { applyDifficultyGuardrails } from "./personalization/difficultyGuardrails";
import { applyRecommendedFocusGuardrail } from "./personalization/recommendedFocusGuardrail";
import type { DifficultyMode } from "./state/progressSchema";

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

// Plan 04-03 (PERSONAL-01/02/03, REPORT-01/02, D-05/A3): the transient,
// render-facing result of handleSessionEnd() — mirrors TheoryStepResult's
// precedent (returned directly to the caller, never persisted verbatim; only
// confidenceScore/difficultyMode/lastRecommendedFocus/motivationSignals are
// durable studentProfile fields, written via the session_end dispatch).
export interface SessionEndResult {
  recommendedFocus: string;
  motivationalMessageRu: string;
  suggestedDifficulty: DifficultyMode;
  parentReportRu: string;
  headlineRu: string;
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

  // Plan 03 (05-03, gap closure, UI-02): resolves the parent Section for the
  // current exercise (main pass or review pass) so its instructionRu/
  // instructionEn can be threaded into the task card. Reuses
  // getCurrentExerciseId()'s already-correct main-pass/review-pass branching
  // (does not duplicate that resolution) — same section-scan pattern as
  // getCurrentExercise() above, one level up (Section instead of Exercise).
  getCurrentSection(): Section | null {
    const id = this.getCurrentExerciseId();
    if (id === null) return null;
    return this.lesson.sections.find((s) => s.exercises.some((e) => e.exerciseId === id)) ?? null;
  }

  // Phase 3 Plan 02 (THEORY-03, D-11); UNCAPPED 2026-07-18. "понятно" exits
  // immediately (THEORY-01/02, unchanged). "не понятно" branches by
  // simplifyRoundCount:
  //   - count === 0 (round 1): CORE-ONLY, no agent call — the caller-visible
  //     text is theory.explanationLevels[1] ("simple"); count -> 1.
  //   - count >= 1 (rounds 2+): await callTheoryTutor via the shared gateway
  //     for a FRESH, different re-explanation; count -> count+1. There is NO
  //     LONGER a cap — the child can tap "не понятно" indefinitely and keeps
  //     getting new LLM-generated variants. theory.maxSimplifyRounds is no
  //     longer consulted (the soft auto-transition to exercises was removed at
  //     user request). Only an explicit "понятно" advances to practice.
  //   - previousExplanation (the text currently on screen, threaded from the
  //     caller) is fed to the tutor as currentLevelText so each round builds a
  //     genuinely different explanation, and is re-served verbatim on agent
  //     failure (never fabricated, D-11 spirit).
  // Exactly one theory_step dispatch per call (single-dispatch invariant).
  async handleTheoryStep(
    understood: boolean,
    previousExplanation?: { textRu: string; exampleRu: string } | null,
  ): Promise<TheoryStepResult> {
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
    const { explanationLevels, rule } = this.lesson.theory;
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
      // Rounds 2+: call Theory Tutor via the shared gateway for a fresh
      // variant, unbounded. currentLevelText / fallbackLevel prefer the text
      // currently on screen (previousExplanation) so each round differs and a
      // failure re-serves the last-shown text verbatim; they fall back to the
      // pre-written simple level on the first agent round.
      const lastShown = {
        textRu: previousExplanation?.textRu ?? simpleLevel?.textRu ?? "",
        exampleRu: previousExplanation?.exampleRu ?? simpleLevel?.exampleRu ?? "",
      };
      const currentLevelText = lastShown.textRu || this.lesson.theory.rule;
      const tutorResult = await callTheoryTutor({
        rule,
        currentLevelText,
        fallbackLevel: lastShown,
        roundNumber: simplifyRoundCount + 1,
      });
      nextCount = simplifyRoundCount + 1;
      source = tutorResult.source;
      agentFailed = tutorResult.source === "core";
      explanation = { textRu: tutorResult.explanationRu, exampleRu: tutorResult.exampleRu };
    }

    // No cap: "не понятно" never auto-advances to practice — only an explicit
    // "понятно" does. The child keeps getting new LLM variants indefinitely.
    this.store.dispatch({
      type: "theory_step",
      theoryUnderstood: false,
      simplifyRoundCount: nextCount,
      source,
      agentFailed,
    });

    return { explanation };
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
      wordUpdates: delta.wordUpdates,
      exerciseTypeUpdates: delta.exerciseTypeUpdates,
      nextErrorStreak: delta.nextErrorStreak,
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

  // Plan 04-03 (PERSONAL-01/02/03, REPORT-01/02, D-06/D-07): the session-end
  // orchestrator. Progress Advisor resolves FIRST (agent success or
  // fallback — either way produces a FINAL core-decided recommendedFocus/
  // suggestedDifficulty via applyDifficultyGuardrails, the ONLY writer of
  // difficultyMode), and ONLY THEN is Parent Report Generator called,
  // receiving that FINAL recommendation. Exactly ONE session_end dispatch —
  // never Promise.all, never two dispatches for one user-visible event
  // (single-dispatch invariant, Pitfall 3 precedent).
  async handleSessionEnd(): Promise<SessionEndResult> {
    const state = this.store.getState();

    // Step 1 (PERSONAL-03): the core's OWN threshold-rule-derived weakest
    // topic — the topicStats entry with the highest error count (lowest
    // correct/attempts ratio), or a fixed generic string if topicStats is
    // empty. Used verbatim as Progress Advisor's fallback input, never
    // fabricated by the wrapper itself.
    const topicEntries = Object.entries(state.topicStats);
    let fallbackRecommendedFocus = "Продолжай практиковаться";
    if (topicEntries.length > 0) {
      const worst = topicEntries.reduce((worstEntry, entry) => {
        const [, stat] = entry;
        const [, worstStat] = worstEntry;
        const ratio = stat.attempts > 0 ? stat.correct / stat.attempts : 0;
        const worstRatio = worstStat.attempts > 0 ? worstStat.correct / worstStat.attempts : 0;
        return ratio < worstRatio ? entry : worstEntry;
      });
      fallbackRecommendedFocus = worst[0];
    }

    // Step 2/3: Progress Advisor resolves FIRST — sequential await, never
    // Promise.all (D-07/anti-pattern).
    const advisorResult = await callProgressAdvisor({
      topicStats: state.topicStats,
      wordStats: state.wordStats,
      exerciseTypeStats: state.exerciseTypeStats,
      currentDifficultyMode: state.studentProfile.difficultyMode,
      fallbackRecommendedFocus,
    });

    // Step 4 (PERSONAL-02): applyDifficultyGuardrails is the ONLY function
    // permitted to decide difficultyMode's next value — advisorResult.
    // suggestedDifficulty is one input, never assigned directly anywhere else.
    const finalDifficulty = applyDifficultyGuardrails(
      state.studentProfile.difficultyMode,
      advisorResult.suggestedDifficulty,
      { correctStreak: state.currentCorrectStreak, recentErrors: state.currentErrorStreak },
    );

    // PERSONAL-03 (T-ogs-01/T-ogs-02): applyRecommendedFocusGuardrail is the
    // core-side trust gate for the agent's recommendedFocus — the SAME
    // fallbackRecommendedFocus already passed into callProgressAdvisor above
    // is reused here (not a second/different fallback), so every downstream
    // consumer only ever sees a validated topic-id or that deterministic
    // fallback, never raw agent prose.
    const finalRecommendedFocus = applyRecommendedFocusGuardrail(
      advisorResult.recommendedFocus,
      fallbackRecommendedFocus,
    );

    // Step 5: confidenceScore (SPEC.md §12 formula, pure core computation).
    const exerciseStatValues = Object.values(state.exerciseStats);
    const totalAttempts = exerciseStatValues.reduce((sum, s) => sum + s.attempts, 0);
    const totalCorrect = exerciseStatValues.reduce((sum, s) => sum + s.correct, 0);
    const correctRatio = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
    const confidenceScore = computeConfidenceScore({
      correctRatio,
      streak: state.currentCorrectStreak,
      errorsInARow: state.currentErrorStreak,
    });

    // Step 6: Parent Report snapshot.
    const exercisesCompleted = Object.keys(state.exerciseStats).length;
    // Deliberately "currently correct" (final-outcome-per-exercise), not a
    // lifetime sum of every correct attempt — a parent reading "N верно"
    // expects "N exercises are correctly answered by the end of the
    // session," not an inflated count of every retry that happened to land
    // right along the way.
    const correctCount = exerciseStatValues.filter((s) => s.lastAttemptCorrect).length;
    // Lifetime-cumulative (topicStats persists across sessions), not
    // session-scoped — a topic can appear here even if untouched this
    // session, since there is no session-start snapshot to diff against.
    // Acceptable for this single-lesson MVP; revisit if multi-lesson history
    // makes stale struggling-topic reports confusing.
    const strugglingTopics = Object.entries(state.topicStats)
      .filter(([, stat]) => stat.status === "needs_review")
      .map(([topic]) => topic);
    const reviewTopics = state.reviewQueue;
    const rublesEarned = state.currentRewards;

    // Step 7: Parent Report Generator — called ONLY after Progress Advisor's
    // promise (steps 3-4) fully resolved, receiving the FINAL recommendation
    // (never the raw agent suggestion).
    const reportResult = await callParentReportGenerator({
      exercisesCompleted,
      correctCount,
      strugglingTopics,
      reviewTopics,
      rublesEarned,
      recommendation: finalRecommendedFocus,
    });

    // Step 8: ONE session_end dispatch.
    this.store.dispatch({
      type: "session_end",
      confidenceScore,
      difficultyMode: finalDifficulty,
      recommendedFocus: finalRecommendedFocus,
      motivationalMessageRu: advisorResult.motivationalMessageRu,
      parentReportRu: reportResult.parentReportRu,
      headlineRu: reportResult.headlineRu,
      progressAdvisorSource: advisorResult.source,
      progressAdvisorFailed: advisorResult.source === "core",
      parentReportSource: reportResult.source,
      parentReportFailed: reportResult.source === "core",
    });

    // Step 9: transient render-facing result.
    return {
      recommendedFocus: finalRecommendedFocus,
      motivationalMessageRu: advisorResult.motivationalMessageRu,
      suggestedDifficulty: finalDifficulty,
      parentReportRu: reportResult.parentReportRu,
      headlineRu: reportResult.headlineRu,
    };
  }
}
