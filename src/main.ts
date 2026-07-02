// Boot sequence: load lesson -> restore state -> mount UI -> subscribe (D-03, D-04, D-06).
import { loadLesson } from "./core/lesson/lessonLoader";
import { load as loadProgress } from "./core/state/persistence";
import { StateStore } from "./core/state/store";
import { LessonEngine } from "./core/lessonEngine";
import type { ProgressState } from "./core/state/progressSchema";
import { renderTheoryScreen } from "./ui/screens/TheoryScreen";
import { renderExerciseScreen, renderFeedbackBanner } from "./ui/screens/ExerciseScreen";
import { renderProgressIndicator } from "./ui/components/ProgressIndicator";

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
  let feedback: { atIndex: number; isCorrect: boolean; hint?: string } | null = null;

  function render(state: ProgressState): void {
    root.textContent = "";

    const topBar = document.createElement("div");
    topBar.className = "top-bar";
    const title = document.createElement("span");
    title.className = "heading";
    title.textContent = lesson.unitTitle;
    topBar.appendChild(title);

    if (state.currentPosition.theoryUnderstood) {
      topBar.appendChild(
        renderProgressIndicator(
          state.currentPosition.currentExerciseIndex + 1,
          engine.totalExercises,
        ),
      );
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
      const exercise = engine.exercises[index];

      if (exercise) {
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
            feedback = { atIndex: index, isCorrect: result.isCorrect, hint };

            if (result.isCorrect) {
              // Correct: position advances, so the exercise DOM must be rebuilt
              // for the new (or completed) index — a full render() is required.
              render(store.getState());
            } else {
              // WR-03: incorrect answer keeps the SAME exercise on screen
              // (currentExerciseIndex is unchanged, no dispatch to "advance_position").
              // Calling render() here would tear down and rebuild the exercise DOM
              // from scratch, wiping any partial input the child already entered
              // (typed text, tapped matching pairs, built order sequence). Instead,
              // only swap the feedback banner in place and leave the exercise
              // subtree — and its in-progress state — untouched.
              const previousBanner = main.querySelector(".feedback-banner");
              previousBanner?.remove();
              main.appendChild(renderFeedbackBanner(feedback.isCorrect, feedback.hint));
            }
          },
        });
        main.appendChild(exerciseNode);

        // Show the banner if it belongs to the exercise currently on screen
        // (incorrect answer: same index) OR to the one just answered correctly,
        // whose index has already advanced past by exactly one (D-04's immediate
        // advance semantics) — the banner still confirms what the child just did.
        // (This only fires on the initial render of this index / after a full
        // render() call — the incorrect-answer in-place update above handles the
        // no-render case directly.)
        const feedbackAppliesHere =
          feedback !== null &&
          (feedback.atIndex === index || (feedback.isCorrect && feedback.atIndex === index - 1));
        if (feedbackAppliesHere && feedback) {
          main.appendChild(renderFeedbackBanner(feedback.isCorrect, feedback.hint));
        }
      } else {
        // Lesson complete: index has advanced past the last exercise. Still show
        // the feedback banner for the just-answered final exercise (D-04 semantics:
        // banner belongs to index - 1 when the last answer was correct) before the
        // done message, exactly like the in-lesson case above.
        const feedbackAppliesHere =
          feedback !== null && feedback.isCorrect && feedback.atIndex === index - 1;
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
