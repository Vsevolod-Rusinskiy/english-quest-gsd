// Boot sequence: load lesson -> restore state -> mount UI -> subscribe (D-03, D-04, D-06).
import { loadLesson } from "./core/lesson/lessonLoader";
import { load as loadProgress } from "./core/state/persistence";
import { StateStore } from "./core/state/store";
import { LessonEngine } from "./core/lessonEngine";
import type { ProgressState } from "./core/state/progressSchema";
import { renderTheoryScreen } from "./ui/screens/TheoryScreen";
import { renderExerciseScreen, renderFeedbackBanner } from "./ui/screens/ExerciseScreen";
import { renderProgressIndicator, renderReviewProgressIndicator } from "./ui/components/ProgressIndicator";

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
  let feedback: { atIndex: number; exerciseId: string; isCorrect: boolean; hint?: string } | null =
    null;

  // Review-pass progress-indicator denominator (PROGRESS-04, D-02, T-02-05):
  // reviewQueue shrinks as items dequeue, so the total is captured once, the
  // first time the review pass is observed non-empty, rather than re-read
  // from the live (shrinking) reviewQueue.length every render — otherwise
  // "Повторение: N из K" would have a K that decreases mid-pass.
  let reviewPassTotal: number | null = null;

  function render(state: ProgressState): void {
    root.textContent = "";

    const topBar = document.createElement("div");
    topBar.className = "top-bar";
    const title = document.createElement("span");
    title.className = "heading";
    title.textContent = lesson.unitTitle;
    topBar.appendChild(title);

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
        topBar.appendChild(
          renderProgressIndicator(
            state.currentPosition.currentExerciseIndex + 1,
            engine.totalExercises,
          ),
        );
      }
    }
    root.appendChild(topBar);

    const main = document.createElement("div");
    main.className = "main-content";

    if (!state.currentPosition.theoryUnderstood) {
      main.appendChild(
        renderTheoryScreen({
          theory: lesson.theory,
          onUnderstoodChoice: (understood) => engine.handleTheoryStep(understood),
        }),
      );
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
        const exerciseNode = renderExerciseScreen({
          exercise,
          onSubmit: (answer) => {
            // handleAnswer's dispatch(es) are synchronous and would trigger the
            // subscribed render() before `feedback` below is set (dispatch fires
            // mid-call, before handleAnswer returns). Unsubscribe for the
            // duration of this call so at most ONE explicit, fully-informed render
            // happens after `feedback` is captured.
            unsubscribeRender();
            const result = engine.handleAnswer(exercise.exerciseId, answer);
            unsubscribeRender = store.subscribe(render);

            const hint = "hint" in exercise ? exercise.hint.firstError : undefined;
            feedback = { atIndex: index, exerciseId: feedbackKey, isCorrect: result.isCorrect, hint };

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
            } else if (inReviewPass && result.isCorrect) {
              // Correct review-pass answers still advance automatically — no
              // extra confirmation step needed, matching prior behavior.
              // (The banner for a correct review answer is not shown here;
              // render() below rebuilds the DOM to the next item, and the
              // feedbackAppliesHere check has no matching screen to attach
              // a banner to for a review-pass advance, same as before.)
              render(store.getState());
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
              main.appendChild(renderFeedbackBanner(feedback.isCorrect, feedback.hint));

              const continueButton = document.createElement("button");
              continueButton.type = "button";
              continueButton.className = "continue-button";
              continueButton.textContent = "Продолжить";
              continueButton.addEventListener("click", () => render(store.getState()));
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
              main.appendChild(renderFeedbackBanner(feedback.isCorrect, feedback.hint));
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
          main.appendChild(renderFeedbackBanner(feedback.isCorrect, feedback.hint));
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
          main.appendChild(renderFeedbackBanner(feedback.isCorrect, feedback.hint));
        }

        const done = document.createElement("p");
        done.textContent = "Урок завершён!";
        main.appendChild(done);
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
