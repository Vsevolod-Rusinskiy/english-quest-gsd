import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mountApp } from "../../src/main";
import { PROGRESS_KEY } from "../../src/core/state/persistence";
import * as rewardAdvisorModule from "../../src/core/agents/rewardAdvisor";
import * as progressAdvisorModule from "../../src/core/agents/progressAdvisor";
import * as parentReportGeneratorModule from "../../src/core/agents/parentReportGenerator";
import { LessonSchema } from "../../src/core/lesson/lessonSchema";
import { LessonEngine } from "../../src/core/lessonEngine";
import { StateStore } from "../../src/core/state/store";
import { initialState } from "../../src/core/state/initialState";

// Full-lesson traversal e2e (Task 3, EXERCISE-05 headline proof): boots the real app
// against the real public/Lesson-1A.json, answers all 18 text-input + 1 matching
// exercises correctly in order, and asserts "Задание N из 19" advances 1->19 with
// every step persisted to localStorage (position matches the current index).
const lessonFixture = readFileSync(resolve(process.cwd(), "public/Lesson-1A.json"), "utf-8");
const lessonData = JSON.parse(lessonFixture);
const allExercises = lessonData.sections.flatMap((s: { exercises: unknown[] }) => s.exercises);

describe("full lesson traversal (e2e)", () => {
  let root: HTMLElement;
  // Plan 04-01 (REWARD-03/04): every correct answer below now triggers a
  // live Reward Advisor call whenever a reward event fires — mock it to the
  // no-praise fallback so this pre-existing traversal e2e stays offline/fast;
  // Reward Advisor's own behavior is covered by
  // tests/core/agents/rewardAdvisor.test.ts and lessonEngine.test.ts's
  // dedicated wiring tests.
  let rewardAdvisorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(lessonFixture, { status: 200 })),
    );

    rewardAdvisorSpy = vi
      .spyOn(rewardAdvisorModule, "callRewardAdvisor")
      .mockResolvedValue({ suggestedReasons: [], celebrationRu: undefined, source: "core" });
  });

  afterEach(() => {
    rewardAdvisorSpy.mockRestore();
  });

  it("completes all 19 real exercises across text-input + matching, advancing progress 1->19 with persistence at every step", async () => {
    await mountApp(root);

    const understoodButton = Array.from(root.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Понятно",
    );
    expect(understoodButton).toBeTruthy();
    understoodButton?.click();

    // Plan 02 (THEORY-03): onUnderstoodChoice is now async — wait for the
    // first exercise screen to render before driving the traversal loop.
    await vi.waitFor(() => expect(root.textContent).toContain("Задание 1 из 19"));

    for (let i = 0; i < allExercises.length; i++) {
      const exercise = allExercises[i];
      expect(root.textContent).toContain(`Задание ${i + 1} из 19`);

      if (exercise.type === "text-input") {
        const input = root.querySelector('input[type="text"]') as HTMLInputElement;
        expect(input).toBeTruthy();
        input.value = exercise.answerCheck.correctAnswers[0];
        input.dispatchEvent(new Event("input"));
      } else if (exercise.type === "matching") {
        const leftButtons = Array.from(
          root.querySelectorAll<HTMLButtonElement>("button.match-left"),
        );
        const rightButtons = Array.from(
          root.querySelectorAll<HTMLButtonElement>("button.match-right"),
        );
        expect(leftButtons).toHaveLength(exercise.leftItems.length);

        for (const pair of exercise.answerCheck.pairs) {
          const leftIndex = exercise.leftItems.findIndex(
            (li: { id: string }) => li.id === pair.leftId,
          );
          const rightIndex = exercise.rightOptions.findIndex(
            (ro: { id: string }) => ro.id === pair.rightId,
          );
          leftButtons[leftIndex].click();
          rightButtons[rightIndex].click();
        }
      } else {
        throw new Error(`Unexpected exercise type in real lesson data: ${exercise.type}`);
      }

      const submitButton = Array.from(root.querySelectorAll("button")).find(
        (btn) => btn.textContent === "Проверить",
      ) as HTMLButtonElement;
      expect(submitButton.disabled).toBe(false);
      submitButton.click();

      // Plan 03 (RESEARCH.md Pitfall 2): submit is now async — the click
      // handler returns before handleAnswer's promise settles, so the
      // assertion must wait for the post-settle DOM (the feedback banner).
      // Plan 04-01: handleAnswer now awaits an additional Reward Advisor
      // call before its dispatch — this widens the async gap between
      // submitButton.click() and the render actually reflecting the new
      // exercise, enough that a bare "Верно!" text check can pass on STALE
      // DOM still showing the previous render's leftover banner (the
      // previous exercise's "Верно!" was already present before this
      // submit). Wait on the PERSISTED position (the authoritative signal
      // that handleAnswer's dispatch(es) actually completed) instead of a
      // banner-text substring that can be true even before this submit's
      // dispatch fires.
      await vi.waitFor(() => {
        const raw = localStorage.getItem(PROGRESS_KEY);
        expect(raw).toBeTruthy();
        const blob = JSON.parse(raw as string);
        expect(blob.data.currentPosition.currentExerciseIndex).toBe(i + 1);
      });
      expect(root.textContent).toContain("Верно!");

      // Every advance persisted: localStorage position matches the current index.
      const raw = localStorage.getItem(PROGRESS_KEY);
      expect(raw).toBeTruthy();
      const blob = JSON.parse(raw as string);
      expect(blob.data.currentPosition.currentExerciseIndex).toBe(i + 1);
    }

    // Lesson-complete state reached (Plan 04-03, D-05): the bare "Урок
    // завершён!" message is replaced by an explicit "Показать итоги"
    // affordance — the combined SessionEndScreen only renders after that
    // button is tapped and handleSessionEnd() resolves.
    expect(root.textContent).not.toContain("Урок завершён!");
    expect(root.textContent).toContain("Показать итоги");
  });

  // Plan 04-03 (PERSONAL-01/02/03, REPORT-01/02): drives the engine directly
  // (rather than simulated DOM clicks, matching this file's existing style
  // of asserting on persisted/engine-level state alongside DOM text) to
  // prove handleSessionEnd() produces a valid confidenceScore/difficultyMode
  // decision and a non-empty transient report/recommendation.
  it("session-end (Plan 04-03): a completed session's handleSessionEnd() produces a valid confidenceScore/difficultyMode and non-empty parentReportRu/recommendedFocus", async () => {
    let progressAdvisorSpy: ReturnType<typeof vi.spyOn> | undefined;
    let parentReportGeneratorSpy: ReturnType<typeof vi.spyOn> | undefined;
    try {
      progressAdvisorSpy = vi.spyOn(progressAdvisorModule, "callProgressAdvisor").mockResolvedValue({
        recommendedFocus: "present_continuous_now",
        suggestedDifficulty: "normal",
        reviewSuggestions: [],
        motivationalMessageRu: "Ты молодец, продолжай в том же духе!",
        sessionAdvice: "continue",
        source: "agent",
      });
      parentReportGeneratorSpy = vi
        .spyOn(parentReportGeneratorModule, "callParentReportGenerator")
        .mockResolvedValue({
          parentReportRu: "Ребёнок отлично справился сегодня!",
          headlineRu: "Итоги урока",
          source: "agent",
        });

      const lesson = LessonSchema.parse(lessonData);
      const store = new StateStore(initialState(lesson.lessonId));
      const engine = new LessonEngine(lesson, store);

      // Drive the full traversal at the engine level (all 18 text-input +
      // 1 matching exercises, correctly answered).
      for (const exercise of lesson.sections.flatMap((s) => s.exercises)) {
        if (exercise.type === "text-input") {
          await engine.handleAnswer(exercise.exerciseId, exercise.answerCheck.correctAnswers[0]);
        } else if (exercise.type === "matching") {
          await engine.handleAnswer(exercise.exerciseId, exercise.answerCheck.pairs);
        }
      }

      expect(engine.getCurrentExercise()).toBeNull();

      const result = await engine.handleSessionEnd();

      const state = store.getState();
      expect(typeof state.studentProfile.confidenceScore).toBe("number");
      expect(state.studentProfile.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(state.studentProfile.confidenceScore).toBeLessThanOrEqual(1);
      expect(["easy", "normal", "challenge"]).toContain(state.studentProfile.difficultyMode);
      expect(result.parentReportRu.length).toBeGreaterThan(0);
      expect(result.recommendedFocus.length).toBeGreaterThan(0);
    } finally {
      progressAdvisorSpy?.mockRestore();
      parentReportGeneratorSpy?.mockRestore();
    }
  });
});
