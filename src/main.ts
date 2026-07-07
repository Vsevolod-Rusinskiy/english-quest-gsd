// Boot sequence: load lesson -> restore state -> mount UI -> subscribe (D-03, D-04, D-06).
import { loadLesson } from "./core/lesson/lessonLoader";
import { load as loadProgress } from "./core/state/persistence";
import { StateStore } from "./core/state/store";
import { LessonEngine, type SessionEndResult } from "./core/lessonEngine";
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

export async function mountApp(root: HTMLElement): Promise<void> {
  // Halt on failure per D-06 — loadLesson renders the FatalError state itself.
  const lesson = await loadLesson(root);

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
    const title = document.createElement("span");
    title.className = "heading";
    title.textContent = lesson.unitTitle;
    topBar.appendChild(title);

    // Ruble balance chip (UI-02): live top-bar read of state.currentRewards —
    // same field SessionEndScreen already reads (line ~263 below), a second
    // read site, no new state.
    const rubleChip = document.createElement("span");
    rubleChip.className = "ruble-balance";
    rubleChip.textContent = `${state.currentRewards} ₽`;
    topBar.appendChild(rubleChip);

    if (state.currentPosition.theoryUnderstood) {
      if (engine.isReviewPass()) {
        // Capture the review-pass total the first time it's observed, before
        // any dequeue shrinks reviewQueue — avoids the Gap-2-style overshoot
        // by never rendering the main-sequence "N из 19" past the main total.
        if (reviewPassTotal === null) {
          reviewPassTotal = state.reviewQueue.length;
        }
        const consumed = reviewPassTotal - state.reviewQueue.length;
        topBar.appendChild(renderReviewProgressIndicator(consumed + 1, reviewPassTotal));
      } else {
        // D-12 Gap 2 fix: reuse engine.getCurrentExercise() — the SAME
        // completion signal the main-content block computes below — as the
        // single "is the main sequence complete" check, instead of
        // unconditionally computing currentExerciseIndex + 1 (which
        // overshoots to totalExercises + 1 once the index has already
        // advanced past the last exercise on the final correct answer).
        const topBarExercise = engine.getCurrentExercise();
        if (!topBarExercise) {
          topBar.appendChild(renderProgressIndicatorComplete(engine.totalExercises));
        } else {
          topBar.appendChild(
            renderProgressIndicator(
              state.currentPosition.currentExerciseIndex + 1,
              engine.totalExercises,
            ),
          );
        }
      }
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
        const exerciseNode = renderExerciseScreen({
          exercise,
          instructionRu: section?.instructionRu ?? "",
          instructionEn: section?.instructionEn ?? "",
          onSubmit: async (answer) => {
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

            const hint =
              result.hintRu ?? ("hint" in exercise ? exercise.hint.firstError : undefined);
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
              // rebuild the exercise DOM from scratch, wiping any partial input
              // the child already entered. Instead, only swap the feedback
              // banner in place and leave the exercise subtree untouched.
              const previousBanner = main.querySelector(".feedback-banner");
              previousBanner?.remove();
              main.appendChild(renderFeedbackBanner(feedback.isCorrect, feedback.hint, feedback.praiseRu));
            }
          },
        });
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
