// Boot sequence: load lesson -> restore state -> mount UI -> subscribe (D-03, D-04, D-06).
import { loadLesson } from "./core/lesson/lessonLoader";
import { load as loadProgress } from "./core/state/persistence";
import { StateStore } from "./core/state/store";
import { LessonEngine, type SessionEndResult, type AnswerPayload } from "./core/lessonEngine";
import type { Exercise, Lesson } from "./core/lesson/lessonSchema";
import type { ProgressState } from "./core/state/progressSchema";
import { renderTheoryScreen, type TheoryExplanation } from "./ui/screens/TheoryScreen";
import { renderExerciseScreen, renderFeedbackBanner } from "./ui/screens/ExerciseScreen";
import {
  renderProgressIndicator,
  renderReviewProgressIndicator,
  renderProgressIndicatorComplete,
} from "./ui/components/ProgressIndicator";
import { renderSessionEndScreen } from "./ui/screens/SessionEndScreen";
import { renderThinkingIndicator } from "./ui/components/ThinkingIndicator";
import { renderRewardToast } from "./ui/components/RewardToast";
import { playCoinSound } from "./ui/sound/coin";
import { renderProgressBar } from "./ui/components/ProgressBar";
import { renderStreakChip } from "./ui/components/StreakChip";
import { renderTopicMasterySummary } from "./ui/components/TopicMasterySummary";

// DEV-only cheat-button helper: the correct AnswerPayload for `exercise`,
// read straight from its own authored answerCheck data (never fabricated) —
// exactly what checkTextInput/checkSingleChoice/checkMatching/checkOrderBuilder
// already accept as correct, so it goes through the real check, not a bypass.
function correctAnswerForExercise(exercise: Exercise): AnswerPayload {
  switch (exercise.type) {
    case "text-input":
      return exercise.answerCheck.correctAnswers[0];
    case "single-choice":
      return exercise.answerCheck.correctOptionId;
    case "matching":
      return exercise.answerCheck.pairs;
    case "order-builder":
      return exercise.answerCheck.correctOrder;
    default: {
      const _exhaustive: never = exercise;
      throw new Error(`Unhandled exercise type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// DEV-only manual-testing speed-up: cap the lesson to its first N exercises
// (spanning sections in order) so a full run-through takes minutes, not the
// full 19-exercise lesson. Guarded by import.meta.env.MODE === "development" — Vite dead-code-
// eliminates this from production builds, the real lesson is never
// truncated for an actual learner. Returns the SAME lesson object unchanged
// outside dev.
const DEV_MAX_EXERCISES = 10;
function applyDevExerciseLimit(lesson: Lesson): Lesson {
  if (import.meta.env.MODE !== "development") return lesson;
  let remaining = DEV_MAX_EXERCISES;
  const sections = lesson.sections
    .map((section) => {
      const kept = section.exercises.slice(0, Math.max(0, remaining));
      remaining -= kept.length;
      return { ...section, exercises: kept };
    })
    .filter((section) => section.exercises.length > 0);
  return { ...lesson, sections };
}

export async function mountApp(root: HTMLElement): Promise<void> {
  // Halt on failure per D-06 — loadLesson renders the FatalError state itself.
  const lesson = applyDevExerciseLimit(await loadLesson(root));

  const progressState = loadProgress(lesson.lessonId);
  const store = new StateStore(progressState);
  const engine = new LessonEngine(lesson, store);

  // Transient (non-persisted) render-only feedback: which exercise index was just
  // answered and the verdict. Reset to null whenever a fresh screen is (re)built for
  // a DIFFERENT index than the one the feedback belongs to, so it never leaks onto a
  // later, not-yet-answered exercise.
  let feedback: {
    atIndex: number;
    exerciseId: string;
    isCorrect: boolean;
    hint?: string;
    praiseRu?: string;
  } | null = null;

  // Phase 3 Plan 02 (THEORY-03, D-11, RESEARCH.md Open Question 2): the
  // currently-active theory explanation text — transient/in-memory, NOT
  // persisted (only simplifyRoundCount lives in state). null on the initial
  // pre-simplify view (TheoryScreen falls back to explanationLevels[0]).
  let currentExplanation: TheoryExplanation | null = null;

  // Review-pass progress-indicator denominator (PROGRESS-04, D-02, T-02-05):
  // reviewQueue shrinks as items dequeue, so the total is captured once, the
  // first time the review pass is observed non-empty, rather than re-read
  // from the live (shrinking) reviewQueue.length every render — otherwise
  // "Повторение: N из K" would have a K that decreases mid-pass.
  let reviewPassTotal: number | null = null;

  // Plan 04-03 (D-05/D-08, RESEARCH.md Pitfall 6): the result of
  // handleSessionEnd(), captured once the explicit "Показать итоги" tap
  // resolves — transient/in-memory only (mirrors currentExplanation's
  // precedent), never persisted verbatim. null before the button is tapped;
  // once set, the combined SessionEndScreen renders instead of the button.
  let sessionEndResult: SessionEndResult | null = null;

  function render(state: ProgressState): void {
    root.textContent = "";

    const topBar = document.createElement("div");
    topBar.className = "top-bar";

    // 260707-pu4: row1 (identity/reward) always renders regardless of
    // theoryUnderstood — title + chips show on every screen, same as before
    // the two-row restructure.
    const row1 = document.createElement("div");
    row1.className = "top-bar-row-1";

    const title = document.createElement("span");
    title.className = "heading";
    title.textContent = lesson.unitTitle;
    row1.appendChild(title);

    // Architecture explainer link: opens docs/MECHANICS.html (served from
    // public/docs/ so it survives `vite build`, not just `vite dev`) in a
    // NEW tab (target="_blank") so the child's in-progress lesson state in
    // the current tab is never disturbed. Visible in every mode (not a dev
    // tool) — this is real project documentation.
    const mechanicsLink = document.createElement("a");
    mechanicsLink.className = "mechanics-link";
    mechanicsLink.href = "/docs/MECHANICS.html";
    mechanicsLink.target = "_blank";
    mechanicsLink.rel = "noopener";
    mechanicsLink.textContent = "Как это работает?";
    row1.appendChild(mechanicsLink);

    // Ruble balance chip (UI-02): live top-bar read of state.currentRewards —
    // same field SessionEndScreen already reads (line ~263 below), a second
    // read site, no new state.
    const rubleChip = document.createElement("span");
    rubleChip.className = "ruble-balance";
    rubleChip.textContent = `${state.currentRewards} ₽`;
    row1.appendChild(rubleChip);

    // Streak chip (UX-PROGRESS-04): only mounted when renderStreakChip
    // returns non-null (streak >= 2) — reads state.currentCorrectStreak,
    // no new state.
    const streakChip = renderStreakChip(state.currentCorrectStreak);
    if (streakChip) {
      row1.appendChild(streakChip);
    }
    topBar.appendChild(row1);

    if (state.currentPosition.theoryUnderstood) {
      // 260707-pu4: row2 (progress) — progress-indicator text, progress
      // bar, and topic-mastery summary, for main/review/complete alike.
      const row2 = document.createElement("div");
      row2.className = "top-bar-row-2";

      if (engine.isReviewPass()) {
        // Capture the review-pass total the first time it's observed, before
        // any dequeue shrinks reviewQueue — avoids the Gap-2-style overshoot
        // by never rendering the main-sequence "N из 19" past the main total.
        if (reviewPassTotal === null) {
          reviewPassTotal = state.reviewQueue.length;
        }
        const consumed = reviewPassTotal - state.reviewQueue.length;
        row2.appendChild(renderReviewProgressIndicator(consumed + 1, reviewPassTotal));
        // UX-PROGRESS-04: review-pass progress bar, same consumed+1/total
        // pair as the text indicator above — clamp guarantees no overshoot.
        row2.appendChild(renderProgressBar(consumed + 1, reviewPassTotal));
      } else {
        // D-12 Gap 2 fix: reuse engine.getCurrentExercise() — the SAME
        // completion signal the main-content block computes below — as the
        // single "is the main sequence complete" check, instead of
        // unconditionally computing currentExerciseIndex + 1 (which
        // overshoots to totalExercises + 1 once the index has already
        // advanced past the last exercise on the final correct answer).
        const topBarExercise = engine.getCurrentExercise();
        if (!topBarExercise) {
          row2.appendChild(renderProgressIndicatorComplete(engine.totalExercises));
          // UX-PROGRESS-04: complete state — full bar, no overshoot risk by
          // construction (current === total).
          row2.appendChild(renderProgressBar(engine.totalExercises, engine.totalExercises));
        } else {
          row2.appendChild(
            renderProgressIndicator(
              state.currentPosition.currentExerciseIndex + 1,
              engine.totalExercises,
            ),
          );
          row2.appendChild(
            renderProgressBar(
              state.currentPosition.currentExerciseIndex + 1,
              engine.totalExercises,
            ),
          );
        }
      }

      // UX-PROGRESS-04 / 260707-pu4: compact topic-mastery summary, mounted
      // once in row2, for main/review/complete alike — reads
      // state.topicStats only, no new state. Guarded like streakChip since
      // renderTopicMasterySummary now returns null for empty topicStats.
      const masteryEl = renderTopicMasterySummary(state.topicStats);
      if (masteryEl) {
        row2.appendChild(masteryEl);
      }

      topBar.appendChild(row2);
    }
    root.appendChild(topBar);

    const main = document.createElement("div");
    main.className = "main-content";

    if (!state.currentPosition.theoryUnderstood) {
      const theoryNode = renderTheoryScreen({
        theory: lesson.theory,
        currentExplanation,
        onUnderstoodChoice: async (understood) => {
          // Phase 3 Plan 02 (RESEARCH.md Pitfall 2): handleTheoryStep is
          // async (rounds 2-3 await callTheoryTutor over the network).
          // Thinking cue — disable both theory buttons the instant the tap
          // begins, before the await, so the up-to-16s worst case (D-07's 8s
          // timeout x2) never reads as a frozen/broken UI. Re-enabled in a
          // finally. Unsubscribe/resubscribe around the await mirrors the
          // submit handler's established pattern (Pitfall 3) — no other
          // dispatch can race in during this window.
          const buttons = theoryNode.querySelectorAll<HTMLButtonElement>(".theory-buttons button");
          buttons.forEach((btn) => (btn.disabled = true));
          // Phase 5 (D-09): shared thinking-indicator, same component reused
          // at all 3 agent-wait call sites.
          const thinkingEl = renderThinkingIndicator();
          theoryNode.appendChild(thinkingEl);

          let result;
          try {
            unsubscribeRender();
            result = await engine.handleTheoryStep(understood);
          } finally {
            thinkingEl.remove();
            unsubscribeRender = store.subscribe(render);
            buttons.forEach((btn) => (btn.disabled = false));
          }

          currentExplanation = result.explanation;
          render(store.getState());
        },
      });
      main.appendChild(theoryNode);
    } else {
      const index = state.currentPosition.currentExerciseIndex;
      // Plan 03 (PROGRESS-04, D-02): serve via getCurrentExercise() so the
      // main pass AND the appended review pass share one rendering path —
      // no new screen, no direct engine.exercises[index] lookup once past
      // the main sequence (that would show "Урок завершён!" prematurely
      // whenever a non-empty reviewQueue remains, per Task 2's <behavior>).
      const exercise = engine.getCurrentExercise();
      const inReviewPass = engine.isReviewPass();

      if (exercise) {
        // Feedback is keyed by exerciseId, not by the main-sequence index —
        // during the review pass currentExerciseIndex no longer changes
        // per-answer (dequeue IS the advance), so an index-based key would
        // never match the next review item's re-render.
        const feedbackKey = exercise.exerciseId;
        // Plan 03 (05-03, gap closure, UI-02): resolve the current exercise's
        // parent Section so its bilingual instructionRu/instructionEn can be
        // threaded into the task card — the single shared render call site
        // covers both the main pass and the review pass (same
        // getCurrentExercise()-derived exercise above).
        const section = engine.getCurrentSection();
        // Named (not inline) so a DEV-only cheat button below can invoke the
        // EXACT same submit path (agent calls, rewards, feedback,
        // persistence) a real submit uses — never a parallel shortcut that
        // could drift from real behavior. References `exerciseNode` by
        // closure before its `const` below is assigned; safe because this
        // function is only ever CALLED later (on click), after
        // `exerciseNode` is bound.
        const handleSubmitAnswer = async (answer: AnswerPayload): Promise<void> => {
            // Plan 03 (RESEARCH.md Pitfall 2): handleAnswer is now async (it
            // may await callAnswerChecker over the network). "Thinking" cue —
            // disable the submit button THE INSTANT submit begins, before the
            // await, so the up-to-16s worst case (D-07's 8s timeout x2) never
            // reads as a frozen/broken UI. Re-enabled in a finally.
            const submitButton = exerciseNode.querySelector<HTMLButtonElement>(
              ".submit-row button",
            );
            if (submitButton) submitButton.disabled = true;
            // Phase 5 (D-09): shared thinking-indicator, same component
            // reused at all 3 agent-wait call sites.
            const thinkingEl = renderThinkingIndicator();
            exerciseNode.appendChild(thinkingEl);

            // Phase 5 (D-10, 05-PATTERNS.md correction — HandleAnswerResult
            // has NO rewardAmount field): capture currentRewards immediately
            // before the try block so the reward-toast trigger below can
            // diff against the post-await value. Safe here because
            // handleAnswer is the ONLY call site that can change
            // currentRewards between these two reads within this single
            // dispatch window (Pitfall 3's established invariant).
            const rewardsBefore = store.getState().currentRewards;

            let result;
            try {
              // handleAnswer's dispatch(es) are synchronous and would trigger the
              // subscribed render() before `feedback` below is set (dispatch fires
              // mid-call, before handleAnswer returns). Unsubscribe for the
              // duration of this call so at most ONE explicit, fully-informed render
              // happens after `feedback` is captured. Now spans an async gap
              // (the await below) instead of a purely sync one — the same
              // reasoning still holds: no other dispatch can race in during
              // this window because nothing else calls store.dispatch outside
              // theory/submit handlers (Pitfall 3).
              unsubscribeRender();
              result = await engine.handleAnswer(exercise.exerciseId, answer);

              const rewardsDelta = store.getState().currentRewards - rewardsBefore;
              if (rewardsDelta > 0) {
                // UX-COIN-01: synthesized cling alongside the visual toast —
                // fire-and-forget, synchronous, never throws (see coin.ts).
                playCoinSound();
                const toastEl = renderRewardToast(rewardsDelta);
                document.body.appendChild(toastEl);
                setTimeout(() => toastEl.remove(), 1950);
              }
            } finally {
              thinkingEl.remove();
              unsubscribeRender = store.subscribe(render);
              if (submitButton) submitButton.disabled = false;
            }

            // UX-HINT-03: authored hint (from lesson data) is now the
            // PRIMARY hint, escalating by attempt count — 1st wrong attempt
            // -> firstError, 2nd+ -> secondError (falling back to
            // firstError when absent, only 9/19 exercises define it). The
            // agent's result.hintRu is supplementary only and, per
            // CONTEXT.md #3's recommendation, dropped from the banner
            // entirely this pass rather than risk a confusing agent hint
            // replacing the reliable authored one. Read AFTER
            // engine.handleAnswer resolves so the just-recorded attempt is
            // reflected.
            const attempts = store.getState().exerciseStats[exercise.exerciseId]?.attempts ?? 0;
            const hint =
              "hint" in exercise
                ? attempts >= 2
                  ? (exercise.hint.secondError ?? exercise.hint.firstError)
                  : exercise.hint.firstError
                : undefined;
            feedback = {
              atIndex: index,
              exerciseId: feedbackKey,
              isCorrect: result.isCorrect,
              hint,
              praiseRu: result.praiseRu,
            };

            // WR-02: review-pass answers used to always call render() here
            // (result.isCorrect || inReviewPass was always true while
            // inReviewPass), tearing down to the next review item even on an
            // incorrect answer. The freshly rendered next item's feedbackKey
            // never matches the just-answered exercise's id, so the banner
            // silently never showed for an incorrect review-pass answer. Now
            // branched three ways: main-pass correct, review-pass correct
            // (still auto-advances), review-pass incorrect (stays on screen
            // with the banner + explicit continue step).
            if (result.isCorrect && !inReviewPass) {
              // Main-pass correct answer advances currentExerciseIndex — a
              // DIFFERENT exercise is now current, so the DOM must be rebuilt.
              render(store.getState());
              // D-12 Gap 1 fix: this render() is the ONE render `feedback`
              // was captured for (feedbackAppliesHere's atIndex === index - 1
              // clause matches it) — null it out immediately after so no
              // LATER render (not caused by a new submit) can show this
              // stale banner again.
              feedback = null;
            } else if (inReviewPass && result.isCorrect) {
              // Correct review-pass answers still advance automatically — no
              // extra confirmation step needed, matching prior behavior.
              // (The banner for a correct review answer is not shown here;
              // render() below rebuilds the DOM to the next item, and the
              // feedbackAppliesHere check has no matching screen to attach
              // a banner to for a review-pass advance, same as before.)
              render(store.getState());
              // D-12 Gap 1 fix: same one-shot consumption as the main-pass
              // correct branch above.
              feedback = null;
            } else if (inReviewPass) {
              // Incorrect review-pass answer: the item already dequeued
              // (dispatch above is unconditional per D-02), but the DOM must
              // NOT tear down yet — otherwise the next review item's
              // feedbackKey would never match this just-answered exercise's
              // id and the "incorrect" banner would never render at all.
              // Keep this exercise's DOM in place, show the banner, and
              // require an explicit "Продолжить" tap before advancing.
              const previousBanner = main.querySelector(".feedback-banner");
              previousBanner?.remove();
              main.appendChild(renderFeedbackBanner(feedback.isCorrect, feedback.hint, feedback.praiseRu));

              const continueButton = document.createElement("button");
              continueButton.type = "button";
              continueButton.className = "continue-button";
              continueButton.textContent = "Продолжить";
              continueButton.addEventListener("click", () => {
                // WR-03: null feedback here too, matching the other 3
                // consumption sites' "null right after use" invariant —
                // defense-in-depth against a future review-queue change
                // that could re-present this exerciseId immediately.
                feedback = null;
                render(store.getState());
              });
              main.appendChild(continueButton);
            } else {
              // WR-03: incorrect main-pass answer keeps the SAME exercise on
              // screen (currentExerciseIndex is unchanged, no dispatch to
              // "advance_position"). Calling render() here would tear down and
              // rebuild the exercise DOM from scratch. Instead, only swap the
              // feedback banner in place and leave the exercise subtree
              // otherwise untouched.
              const previousBanner = main.querySelector(".feedback-banner");
              previousBanner?.remove();
              main.appendChild(renderFeedbackBanner(feedback.isCorrect, feedback.hint, feedback.praiseRu));

              // Clear the wrong answer rather than leaving it for the child to
              // edit in place — the escalating authored hint (firstError then
              // secondError) now guides the retry, so a fresh empty field is
              // clearer than stale wrong text. Covers both the single
              // inline-blank and multi-blank (UX-INLINE-02) layouts.
              const blankInputs = exerciseNode.querySelectorAll<HTMLInputElement>(
                'input[type="text"]',
              );
              blankInputs.forEach((inp) => (inp.value = ""));
              const retrySubmit = Array.from(
                exerciseNode.querySelectorAll<HTMLButtonElement>("button"),
              ).find((btn) => btn.textContent === "Проверить");
              if (retrySubmit) retrySubmit.disabled = true;
              blankInputs[0]?.focus();
            }
        };

        const exerciseNode = renderExerciseScreen({
          exercise,
          instructionRu: section?.instructionRu ?? "",
          instructionEn: section?.instructionEn ?? "",
          onSubmit: handleSubmitAnswer,
        });

        // DEV-only cheat button (manual-testing speed): fills+submits the
        // CORRECT answer for the exercise on screen, through the exact same
        // handleSubmitAnswer path a real submit uses. import.meta.env.MODE === "development" is
        // statically false in production builds, so Vite dead-code-eliminates
        // this entire block — never ships.
        if (import.meta.env.MODE === "development") {
          const cheatButton = document.createElement("button");
          cheatButton.type = "button";
          cheatButton.className = "dev-cheat-button";
          cheatButton.textContent = "DEV: верный ответ";
          cheatButton.addEventListener("click", () => {
            void handleSubmitAnswer(correctAnswerForExercise(exercise));
          });
          exerciseNode.appendChild(cheatButton);
        }
        main.appendChild(exerciseNode);

        // Show the banner if it belongs to the exercise currently on screen
        // (incorrect main-pass answer: same index+id) OR to the one just
        // answered correctly on the main pass, whose index has already
        // advanced past by exactly one (D-04's immediate advance semantics —
        // this also covers the last main exercise transitioning straight into
        // a non-empty reviewQueue: inReviewPass is now true, but the feedback
        // still belongs to the main-pass answer that caused the transition,
        // so this must NOT be gated on !inReviewPass) OR to the one just
        // consumed in the review pass (matched by exerciseId, since the index
        // no longer moves per review answer).
        const feedbackAppliesHere =
          feedback !== null &&
          (feedback.exerciseId === feedbackKey ||
            (feedback.isCorrect && feedback.atIndex === index - 1));
        if (feedbackAppliesHere && feedback) {
          main.appendChild(renderFeedbackBanner(feedback.isCorrect, feedback.hint, feedback.praiseRu));
        }
      } else {
        // Lesson complete: main sequence done AND reviewQueue empty (Task 2
        // <behavior>: the completion message appears only when BOTH are
        // true — getCurrentExercise() already encodes exactly that check).
        // Still show the feedback banner for the just-answered final
        // exercise before the done message, matched by whichever key
        // (index-based for a main-pass finish, exerciseId-based for the
        // last review item) the just-completed answer used.
        const feedbackAppliesHere =
          feedback !== null &&
          feedback.isCorrect &&
          (feedback.atIndex === index - 1 || state.reviewQueue.length === 0);
        if (feedbackAppliesHere && feedback) {
          main.appendChild(renderFeedbackBanner(feedback.isCorrect, feedback.hint, feedback.praiseRu));
        }

        // Plan 04-03 (D-05/D-08): replaces the bare "Урок завершён!" message.
        // Once sessionEndResult is available (the button tap resolved),
        // render the combined SessionEndScreen; otherwise show the explicit
        // "Показать итоги" affordance — RESEARCH.md Pitfall 6's recommended
        // option (a): an explicit user tap triggers handleSessionEnd(),
        // avoiding any render-time auto-firing side effect.
        if (sessionEndResult) {
          main.appendChild(
            renderSessionEndScreen({
              recommendedFocus: sessionEndResult.recommendedFocus,
              motivationalMessageRu: sessionEndResult.motivationalMessageRu,
              suggestedDifficulty: sessionEndResult.suggestedDifficulty,
              parentReportRu: sessionEndResult.parentReportRu,
              headlineRu: sessionEndResult.headlineRu,
              rublesEarned: state.currentRewards,
            }),
          );
        } else {
          const showResultsButton = document.createElement("button");
          showResultsButton.type = "button";
          showResultsButton.className = "show-results-button";
          showResultsButton.textContent = "Показать итоги";
          showResultsButton.addEventListener("click", async () => {
            // Same unsubscribe/thinking-cue/resubscribe shape as onSubmit/
            // onUnderstoodChoice (D-08's session-end thinking-cue).
            showResultsButton.disabled = true;
            // Phase 5 (D-09): shared thinking-indicator, same component
            // reused at all 3 agent-wait call sites.
            const thinkingEl = renderThinkingIndicator();
            main.appendChild(thinkingEl);

            let result: SessionEndResult;
            try {
              unsubscribeRender();
              result = await engine.handleSessionEnd();
            } finally {
              thinkingEl.remove();
              unsubscribeRender = store.subscribe(render);
              showResultsButton.disabled = false;
            }

            sessionEndResult = result;
            render(store.getState());
          });
          main.appendChild(showResultsButton);
        }
      }
    }

    root.appendChild(main);
  }

  // Re-render on every state change (the only path that reaches StateStore.dispatch
  // is theory-button taps and exercise submit — never a raw input listener, Pitfall 3).
  let unsubscribeRender = store.subscribe(render);
  render(store.getState());
}

const appRoot = document.querySelector<HTMLElement>("#app");
if (appRoot) {
  void mountApp(appRoot);
}
