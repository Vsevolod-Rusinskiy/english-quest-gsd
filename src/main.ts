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
        main.appendChild(
          renderExerciseScreen({
            exercise,
            onSubmit: (answer) => {
              // handleAnswer's dispatch(es) are synchronous and would trigger the
              // subscribed render() before `feedback` below is set (dispatch fires
              // mid-call, before handleAnswer returns). Unsubscribe for the
              // duration of this call so only ONE explicit, fully-informed render
              // happens after `feedback` is captured.
              unsubscribeRender();
              const result = engine.handleAnswer(exercise.exerciseId, answer);
              unsubscribeRender = store.subscribe(render);

              const hint = "hint" in exercise ? exercise.hint.firstError : undefined;
              feedback = { atIndex: index, isCorrect: result.isCorrect, hint };
              render(store.getState());
            },
          }),
        );

        // Show the banner if it belongs to the exercise currently on screen
        // (incorrect answer: same index) OR to the one just answered correctly,
        // whose index has already advanced past by exactly one (D-04's immediate
        // advance semantics) — the banner still confirms what the child just did.
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
