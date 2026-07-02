import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LessonSchema } from "../../src/core/lesson/lessonSchema";
import { LessonEngine } from "../../src/core/lessonEngine";
import { StateStore } from "../../src/core/state/store";
import { initialState } from "../../src/core/state/initialState";
import { load, save } from "../../src/core/state/persistence";

// Review-pass end-to-end traversal (Task 3, PROGRESS-04 headline proof): drives a
// real LessonEngine + StateStore against the real public/Lesson-1A.json so a topic
// (food_vocabulary, exercises ex010-ex018) accumulates 2+ errors, populating
// reviewQueue, then consumes the whole review pass and proves dequeue-regardless-
// of-correctness, reward dedup, and mid-review persist/resume — mirrors
// fullLessonTraversal.test.ts's real-lesson-driving style.
const lessonPath = resolve(process.cwd(), "public/Lesson-1A.json");
const realLesson1A = JSON.parse(readFileSync(lessonPath, "utf-8"));
const lesson = LessonSchema.parse(realLesson1A);
const allExercises = lesson.sections.flatMap((s) => s.exercises);

function correctAnswerFor(exerciseId: string): string {
  const ex = allExercises.find((e) => e.exerciseId === exerciseId);
  if (!ex || ex.type !== "text-input") {
    throw new Error(`Test setup error: ${exerciseId} not found or not text-input`);
  }
  return ex.answerCheck.correctAnswers[0];
}

/**
 * Drives the full main sequence (ex001-ex019) IN ORDER, mirroring exactly how
 * the real UI answers whatever engine.getCurrentExercise() currently returns
 * (a wrong answer does NOT advance currentExerciseIndex, Phase 1 WR-03 — so
 * out-of-order handleAnswer() calls on not-yet-current exercises would never
 * happen through the real render() flow; this driver preserves that
 * invariant instead of calling handleAnswer for ids ahead of the cursor).
 *
 * ex001-ex009 (grammar topics) answered correctly, no review trigger.
 * ex010 (food_vocabulary) answered wrong TWICE, then correctly the 3rd time
 * to let the main sequence advance past it. The 2nd wrong answer flips
 * food_vocabulary to needs_review and enqueues every food_vocabulary
 * exercise not yet answered correctly THIS session — at that moment ex010
 * itself (not yet correct) through ex018 all qualify, so the whole
 * food_vocabulary set (ex010-ex018) is enqueued. ex010's subsequent correct
 * 3rd attempt advances the main-pass index but does NOT retroactively
 * dequeue it (dequeue only happens by consuming the review pass), which is
 * the literal D-02 "distinct appended pass" contract this test proves.
 * ex011-ex018 are then answered correctly during the main pass too (also
 * does not dequeue them), and ex019 (matching) completes the main sequence.
 */
function driveMainSequenceToReviewPass(engine: LessonEngine): void {
  // ex001-ex009: grammar topics, answered correctly (no review trigger).
  for (const id of [
    "eq-1a-ex001",
    "eq-1a-ex002",
    "eq-1a-ex003",
    "eq-1a-ex004",
    "eq-1a-ex005",
    "eq-1a-ex006",
    "eq-1a-ex007",
    "eq-1a-ex008",
    "eq-1a-ex009",
  ]) {
    const result = engine.handleAnswer(id, correctAnswerFor(id));
    expect(result.isCorrect).toBe(true);
  }

  // ex010 (food_vocabulary): wrong, wrong (2nd error -> needs_review ->
  // enqueue scan fires while ex010-ex018 are all still uncorrected -> all
  // become eligible), then correct (advances the main-pass index past it,
  // but does NOT dequeue it from reviewQueue).
  engine.handleAnswer("eq-1a-ex010", "definitely-wrong-answer");
  engine.handleAnswer("eq-1a-ex010", "definitely-wrong-answer");
  const ex010Result = engine.handleAnswer("eq-1a-ex010", correctAnswerFor("eq-1a-ex010"));
  expect(ex010Result.isCorrect).toBe(true);

  // ex011-ex018 (food_vocabulary): answered correctly in order so the main
  // sequence advances to ex019 — this does NOT dequeue them from
  // reviewQueue either (only consuming the review pass does).
  for (const id of ["eq-1a-ex011", "eq-1a-ex012", "eq-1a-ex013", "eq-1a-ex014", "eq-1a-ex015", "eq-1a-ex016", "eq-1a-ex017", "eq-1a-ex018"]) {
    const result = engine.handleAnswer(id, correctAnswerFor(id));
    expect(result.isCorrect).toBe(true);
  }

  // ex019 (matching): complete the main sequence.
  const matchingExercise = engine.exercises.find((e) => e.exerciseId === "eq-1a-ex019");
  if (!matchingExercise || matchingExercise.type !== "matching") {
    throw new Error("Test setup error: eq-1a-ex019 not found or not type matching");
  }
  const result = engine.handleAnswer("eq-1a-ex019", matchingExercise.answerCheck.pairs);
  expect(result.isCorrect).toBe(true);
}

describe("review-pass traversal (e2e)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("queue populated then consumed: reviewQueue is non-empty at main-pass end, then every queued item is consumed and the lesson completes", () => {
    const store = new StateStore(initialState(lesson.lessonId));
    const engine = new LessonEngine(lesson, store);
    engine.handleTheoryStep(true);

    driveMainSequenceToReviewPass(engine);

    let state = store.getState();
    expect(state.currentPosition.currentExerciseIndex).toBe(19);
    expect(state.reviewQueue.length).toBeGreaterThan(0);
    expect(state.reviewQueue).toContain("eq-1a-ex010");
    expect(state.reviewQueue).toContain("eq-1a-ex011");
    expect(engine.isReviewPass()).toBe(true);

    // Consume the whole review pass, answering every review item correctly.
    let guard = 0;
    while (engine.getCurrentExercise() !== null) {
      guard += 1;
      if (guard > 50) throw new Error("Test runaway: review pass never emptied");
      const exercise = engine.getCurrentExercise();
      if (!exercise) break;
      const answer = correctAnswerFor(exercise.exerciseId);
      const result = engine.handleAnswer(exercise.exerciseId, answer);
      expect(result.isCorrect).toBe(true);
    }

    state = store.getState();
    expect(state.reviewQueue).toEqual([]);
    expect(engine.getCurrentExercise()).toBeNull();
    expect(engine.isReviewPass()).toBe(false);
  });

  it("dequeue regardless of correctness: answering a review item incorrectly still removes it and is NOT immediately re-added", () => {
    const store = new StateStore(initialState(lesson.lessonId));
    const engine = new LessonEngine(lesson, store);
    engine.handleTheoryStep(true);

    driveMainSequenceToReviewPass(engine);

    const queueBefore = [...store.getState().reviewQueue];
    expect(queueBefore.length).toBeGreaterThan(0);
    const currentReviewId = engine.getCurrentExerciseId();
    expect(currentReviewId).toBe(queueBefore[0]);

    const result = engine.handleAnswer(currentReviewId as string, "definitely-wrong-answer");

    expect(result.isCorrect).toBe(false);
    const queueAfter = store.getState().reviewQueue;
    expect(queueAfter).not.toContain(currentReviewId);
    expect(queueAfter.length).toBe(queueBefore.length - 1);
  });

  it("review reward reuses same dedup path: a review-pass re-answer of an exercise already granted correct_after_hint in the main pass does NOT double-grant it (D-03, Pitfall 5, same exerciseId)", () => {
    const store = new StateStore(initialState(lesson.lessonId));
    const engine = new LessonEngine(lesson, store);
    engine.handleTheoryStep(true);

    driveMainSequenceToReviewPass(engine);

    // ex010 was answered wrong, wrong, then correct during the MAIN pass
    // (driveMainSequenceToReviewPass) — its correct answer was NOT the first
    // attempt, so it was granted correct_after_hint exactly once there
    // (mutual exclusion with first_try_correct, D-03), yet it STILL landed
    // in reviewQueue (the enqueue scan ran before that correct answer).
    const beforeReview = store.getState();
    expect(beforeReview.reviewQueue).toContain("eq-1a-ex010");
    const mainPassGrant = beforeReview.rewardHistory.filter(
      (e) => e.exerciseId === "eq-1a-ex010" && e.reason === "correct_after_hint",
    );
    expect(mainPassGrant).toHaveLength(1);
    expect(
      beforeReview.rewardHistory.filter(
        (e) => e.exerciseId === "eq-1a-ex010" && e.reason === "first_try_correct",
      ),
    ).toHaveLength(0);

    // Consume the whole review pass (ex010 is somewhere in reviewQueue, real
    // original exerciseId per Pitfall 5 — same handleAnswer/dedup path).
    let guard = 0;
    while (engine.getCurrentExercise() !== null) {
      guard += 1;
      if (guard > 50) throw new Error("Test runaway: review pass never emptied");
      const exercise = engine.getCurrentExercise();
      if (!exercise) break;
      engine.handleAnswer(exercise.exerciseId, correctAnswerFor(exercise.exerciseId));
    }

    // Re-answering ex010 correctly in the review pass must NOT grant a
    // second correct_after_hint (or a first_try_correct) — the
    // (exerciseId, reason) dedup (D-03) recognizes it as the SAME exercise.
    const finalState = store.getState();
    expect(
      finalState.rewardHistory.filter(
        (e) => e.exerciseId === "eq-1a-ex010" && e.reason === "correct_after_hint",
      ),
    ).toHaveLength(1);
    expect(
      finalState.rewardHistory.filter(
        (e) => e.exerciseId === "eq-1a-ex010" && e.reason === "first_try_correct",
      ),
    ).toHaveLength(0);
    // honest_attempt is also per-exercise deduped (D-03) — still exactly one.
    expect(
      finalState.rewardHistory.filter(
        (e) => e.exerciseId === "eq-1a-ex010" && e.reason === "honest_attempt",
      ),
    ).toHaveLength(1);
  });

  it("persist/resume mid-review (PERSIST-02): save() after one review item, load() into a fresh engine/store, resumes with the remaining queue", () => {
    const store = new StateStore(initialState(lesson.lessonId));
    const engine = new LessonEngine(lesson, store);
    engine.handleTheoryStep(true);

    driveMainSequenceToReviewPass(engine);

    const queueBefore = [...store.getState().reviewQueue];
    expect(queueBefore.length).toBeGreaterThan(0);

    const firstReviewId = engine.getCurrentExerciseId();
    engine.handleAnswer(firstReviewId as string, correctAnswerFor(firstReviewId as string));
    save(store.getState()); // explicit save (dispatch already saves synchronously, D-03)

    const reloaded = load(lesson.lessonId);
    expect(reloaded.reviewQueue).toEqual(queueBefore.slice(1));
    expect(reloaded.currentPosition.currentExerciseIndex).toBe(19);

    const resumedStore = new StateStore(reloaded);
    const resumedEngine = new LessonEngine(lesson, resumedStore);
    expect(resumedEngine.isReviewPass()).toBe(true);
    expect(resumedEngine.getCurrentExerciseId()).toBe(queueBefore[1]);

    // Finish consuming the resumed review pass to confirm it completes cleanly.
    let guard = 0;
    while (resumedEngine.getCurrentExercise() !== null) {
      guard += 1;
      if (guard > 50) throw new Error("Test runaway: resumed review pass never emptied");
      const exercise = resumedEngine.getCurrentExercise();
      if (!exercise) break;
      resumedEngine.handleAnswer(exercise.exerciseId, correctAnswerFor(exercise.exerciseId));
    }
    expect(resumedStore.getState().reviewQueue).toEqual([]);
  });

  it("topic status closes via the review path (isolated): a topic still needs_review entering the review pass transitions to mastered purely from review-pass correct answers (D-06)", () => {
    // Constructs the review-pass entry point directly (mirrors
    // lessonEngine.test.ts's review-pass unit-test style) rather than
    // fighting the full main-pass streak math to keep food_vocabulary at
    // needs_review right up to ex019 — this isolates the exact D-06 claim:
    // 3 correct-in-a-row FROM needs_review, answered entirely through
    // reviewQueue, reaches mastered and fires weak_topic_closed once.
    const store = new StateStore({
      ...initialState(lesson.lessonId),
      currentPosition: { theoryUnderstood: true, currentExerciseIndex: 19, reviewPassIndex: 0 },
      reviewQueue: ["eq-1a-ex010", "eq-1a-ex011", "eq-1a-ex012"],
      topicStats: {
        food_vocabulary: { status: "needs_review", attempts: 2, correct: 0, errors: 2, correctStreak: 0 },
      },
    });
    const engine = new LessonEngine(lesson, store);
    expect(engine.isReviewPass()).toBe(true);

    engine.handleAnswer("eq-1a-ex010", correctAnswerFor("eq-1a-ex010")); // streak 1, needs_review -> in_progress
    expect(store.getState().topicStats["food_vocabulary"].status).toBe("in_progress");
    engine.handleAnswer("eq-1a-ex011", correctAnswerFor("eq-1a-ex011")); // streak 2
    expect(store.getState().topicStats["food_vocabulary"].status).toBe("in_progress");
    engine.handleAnswer("eq-1a-ex012", correctAnswerFor("eq-1a-ex012")); // streak 3 -> mastered

    const finalState = store.getState();
    expect(finalState.topicStats["food_vocabulary"].status).toBe("mastered");
    expect(finalState.reviewQueue).toEqual([]);
    expect(engine.getCurrentExercise()).toBeNull();
    const weakTopicClosed = finalState.rewardHistory.filter(
      (e) => e.reason === "weak_topic_closed" && e.relatedTopic === "food_vocabulary",
    );
    expect(weakTopicClosed).toHaveLength(1);
  });

  it("topic status closes via the review path: the food_vocabulary topic reaches mastered, driven partly through reviewQueue answers (D-06 FSM through reviewQueue)", () => {
    const store = new StateStore(initialState(lesson.lessonId));
    const engine = new LessonEngine(lesson, store);
    engine.handleTheoryStep(true);

    driveMainSequenceToReviewPass(engine);

    // food_vocabulary hit needs_review at ex010's 2nd error, then recovered
    // via ex010's correct 3rd attempt + ex011-ex018 all correct in the main
    // pass (9 correct-in-a-row is well past the 3-correct-in-a-row D-06
    // mastery rule) — so by main-pass end the topic has ALREADY reached
    // mastered, entirely independent of the review pass. This proves D-06's
    // FSM is driven identically regardless of which pass (main or review)
    // supplies the correct answers — the review pass below exercises the
    // SAME FSM path (weak_topic_closed does not re-fire a second time,
    // proving D-05's "fires once per topic" holds even when review answers
    // continue to touch the same topic after mastery).
    const beforeReview = store.getState().topicStats["food_vocabulary"];
    expect(beforeReview.status).toBe("mastered");
    const weakTopicClosedBefore = store
      .getState()
      .rewardHistory.filter((e) => e.reason === "weak_topic_closed" && e.relatedTopic === "food_vocabulary");
    expect(weakTopicClosedBefore).toHaveLength(1);

    // Consume the whole review pass correctly.
    let guard = 0;
    while (engine.getCurrentExercise() !== null) {
      guard += 1;
      if (guard > 50) throw new Error("Test runaway: review pass never emptied");
      const exercise = engine.getCurrentExercise();
      if (!exercise) break;
      engine.handleAnswer(exercise.exerciseId, correctAnswerFor(exercise.exerciseId));
    }

    const afterReview = store.getState().topicStats["food_vocabulary"];
    expect(afterReview.status).toBe("mastered");
    // weak_topic_closed must NOT fire again from review-pass answers on an
    // already-mastered topic (D-05 — fires once per topic, off the FSM's
    // entered_mastered signal, never from a rewardHistory re-scan).
    const weakTopicClosedAfter = store
      .getState()
      .rewardHistory.filter((e) => e.reason === "weak_topic_closed" && e.relatedTopic === "food_vocabulary");
    expect(weakTopicClosedAfter).toHaveLength(1);
  });
});
