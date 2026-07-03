import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mountApp } from "../src/main";
import * as rewardAdvisorModule from "../src/core/agents/rewardAdvisor";
import * as answerCheckerModule from "../src/core/agents/answerChecker";
import * as progressAdvisorModule from "../src/core/agents/progressAdvisor";
import * as parentReportGeneratorModule from "../src/core/agents/parentReportGenerator";

// Phase 5 Plan 01: main.ts's render()/onSubmit branching logic has zero
// direct unit-test coverage before this phase (per 05-RESEARCH.md Wave 0
// Gaps) — this file covers the D-12 bug fixes and the new UI-01/UI-02
// surface (ruble chip, thinking-indicator, reward toast) at the DOM level,
// mirroring tests/e2e/lessonWalkingSkeleton.test.ts's mountApp + stubbed-fetch
// + mocked-agent pattern.
const lessonFixture = readFileSync(resolve(process.cwd(), "public/Lesson-1A.json"), "utf-8");
const lessonData = JSON.parse(lessonFixture);
const allExercises = lessonData.sections.flatMap((s: { exercises: unknown[] }) => s.exercises);

describe("main.ts render()/onSubmit (Phase 5 Plan 01)", () => {
  let root: HTMLElement;
  let rewardAdvisorSpy: ReturnType<typeof vi.spyOn>;
  let progressAdvisorSpy: ReturnType<typeof vi.spyOn>;
  let parentReportGeneratorSpy: ReturnType<typeof vi.spyOn>;

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

    // Same no-praise fallback mock as the existing e2e suite — keeps these
    // tests offline/fast; Reward Advisor's own behavior is covered elsewhere.
    rewardAdvisorSpy = vi
      .spyOn(rewardAdvisorModule, "callRewardAdvisor")
      .mockResolvedValue({ suggestedReasons: [], celebrationRu: undefined, source: "core" });

    // handleSessionEnd() (triggered by "Показать итоги") sequentially calls
    // Progress Advisor then Parent Report Generator — mock both to the same
    // fast, offline fallback-shaped results tests/e2e/fullLessonTraversal.test.ts
    // uses, so tests that reach lesson-complete stay fast.
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
  });

  afterEach(() => {
    rewardAdvisorSpy.mockRestore();
    progressAdvisorSpy.mockRestore();
    parentReportGeneratorSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  async function advanceThroughTheory(): Promise<void> {
    const understoodButton = Array.from(root.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Понятно",
    ) as HTMLButtonElement;
    understoodButton.click();
    await vi.waitFor(() => expect(root.textContent).toContain("Задание 1 из 19"));
  }

  function submitButton(): HTMLButtonElement {
    return Array.from(root.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Проверить",
    ) as HTMLButtonElement;
  }

  // Test A: D-12 Gap 1 — feedback banner must not leak onto a later render
  // not caused by its own answer. Root cause (05-RESEARCH.md Pitfall 1):
  // the lesson-complete branch's `feedbackAppliesHere` check is
  // `feedback.isCorrect && (feedback.atIndex === index - 1 || reviewQueue.length === 0)`
  // — once the lesson is complete, `reviewQueue.length === 0` is permanently
  // true, so `feedback` (never nulled) reapplies on EVERY later render of
  // the completion screen. Clicking "Показать итоги" (src/main.ts line 286)
  // triggers exactly such a later render with no new submit — the stale
  // banner from the final correct answer must NOT reappear there.
  it("clears the feedback banner on a later render not caused by a new submit (D-12 Gap 1)", async () => {
    await mountApp(root);
    await advanceThroughTheory();

    function correctAnswerFor(exerciseId: string): string {
      const ex = allExercises.find((e: { exerciseId: string }) => e.exerciseId === exerciseId);
      return ex.answerCheck.correctAnswers[0];
    }

    for (let i = 0; i < allExercises.length; i++) {
      const exercise = allExercises[i];
      if (exercise.type === "text-input") {
        const input = root.querySelector('input[type="text"]') as HTMLInputElement;
        input.value = correctAnswerFor(exercise.exerciseId);
        input.dispatchEvent(new Event("input"));
      } else if (exercise.type === "matching") {
        const leftButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("button.match-left"));
        const rightButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("button.match-right"));
        for (const pair of exercise.answerCheck.pairs) {
          const leftIndex = exercise.leftItems.findIndex((li: { id: string }) => li.id === pair.leftId);
          const rightIndex = exercise.rightOptions.findIndex((ro: { id: string }) => ro.id === pair.rightId);
          leftButtons[leftIndex].click();
          rightButtons[rightIndex].click();
        }
      }
      const btn = submitButton();
      btn.click();
      await vi.waitFor(() => expect(btn.disabled).toBe(false));
    }

    // Lesson complete: the final correct answer's banner is legitimately
    // shown once, alongside the explicit "Показать итоги" affordance.
    await vi.waitFor(() => expect(root.textContent).toContain("Показать итоги"));
    expect(root.querySelector(".feedback-banner")).toBeTruthy();

    // Tapping "Показать итоги" triggers a SECOND render() of this same
    // completion screen (src/main.ts line 286) with no new submit — the
    // stale banner from the final answer must not still be present.
    const showResultsButton = Array.from(root.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Показать итоги",
    ) as HTMLButtonElement;
    showResultsButton.click();
    await vi.waitFor(() => expect(root.textContent).not.toContain("Показать итоги"));

    expect(root.querySelector(".feedback-banner")).toBeFalsy();
  });

  // Test B: D-12 Gap 2 — progress indicator must never overshoot at
  // lesson-complete.
  it("never shows an overshoot progress indicator at lesson-complete (D-12 Gap 2)", async () => {
    await mountApp(root);
    await advanceThroughTheory();

    for (const exercise of allExercises) {
      if (exercise.type === "text-input") {
        const input = root.querySelector('input[type="text"]') as HTMLInputElement;
        input.value = exercise.answerCheck.correctAnswers[0];
        input.dispatchEvent(new Event("input"));
      } else if (exercise.type === "matching") {
        const leftButtons = Array.from(
          root.querySelectorAll<HTMLButtonElement>("button.match-left"),
        );
        const rightButtons = Array.from(
          root.querySelectorAll<HTMLButtonElement>("button.match-right"),
        );
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
      }
      const btn = submitButton();
      btn.click();
      await vi.waitFor(() => expect(btn.disabled).toBe(false));
    }

    await vi.waitFor(() => expect(root.textContent).toContain("Показать итоги"));

    const progressEl = root.querySelector(".progress-indicator");
    expect(progressEl).toBeTruthy();
    expect(progressEl?.textContent).toBe("Задание 19 из 19");
    expect(progressEl?.textContent).not.toBe("Задание 20 из 19");
    expect(progressEl?.textContent).not.toMatch(/^Задание 20 /);
  });

  // Test C: ruble balance chip (UI-02) — live top-bar element reading
  // state.currentRewards, not a hardcoded stub.
  it("shows a ruble-balance chip in the top bar reflecting state.currentRewards", async () => {
    await mountApp(root);

    const chip = root.querySelector(".ruble-balance");
    expect(chip).toBeTruthy();
    expect(chip?.textContent).toBe("0 ₽");
  });

  // Test D: thinking-indicator wiring at the exercise-submit call site —
  // uses a deliberately delayed callAnswerChecker mock (triggered by an
  // incorrect deterministic answer, so the agent gateway is actually
  // invoked) to create an observable window where the indicator must be
  // present, then confirms it is removed once the awaited call settles.
  it("shows a shared thinking-indicator while awaiting the agent call, removed once settled", async () => {
    let resolveAgent!: (value: { isCorrect: boolean; source: "core"; errorType: "unknown" }) => void;
    const answerCheckerSpy = vi
      .spyOn(answerCheckerModule, "callAnswerChecker")
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAgent = resolve;
          }),
      );

    try {
      await mountApp(root);
      await advanceThroughTheory();

      const input = root.querySelector('input[type="text"]') as HTMLInputElement;
      input.value = "definitely-wrong-answer";
      input.dispatchEvent(new Event("input"));
      submitButton().click();

      // While the agent call is still pending, the shared thinking-indicator
      // must be visible in the exercise DOM.
      await vi.waitFor(() => expect(root.querySelector(".thinking-indicator")).toBeTruthy());

      resolveAgent({ isCorrect: false, source: "core", errorType: "unknown" });
      await vi.waitFor(() => expect(root.textContent).toContain("Не совсем"));
      expect(root.querySelector(".thinking-indicator")).toBeFalsy();
    } finally {
      answerCheckerSpy.mockRestore();
    }
  });

  // Test E: reward toast (D-10) fires on a real reward delta, reading the
  // actual state diff rather than a hardcoded amount.
  it("shows a reward toast matching the actual state.currentRewards delta on a rewarding answer", async () => {
    await mountApp(root);
    await advanceThroughTheory();

    const firstExercise = allExercises[0];
    const before = JSON.parse(localStorage.getItem("english-quest-progress-v1") ?? "null");
    const rewardsBefore = before?.data?.currentRewards ?? 0;

    const input = root.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = firstExercise.answerCheck.correctAnswers[0];
    input.dispatchEvent(new Event("input"));
    submitButton().click();

    await vi.waitFor(() => expect(root.textContent).toContain("Задание 2 из 19"));

    const after = JSON.parse(localStorage.getItem("english-quest-progress-v1") ?? "null");
    const rewardsAfter = after?.data?.currentRewards ?? 0;
    const delta = rewardsAfter - rewardsBefore;
    expect(delta).toBeGreaterThan(0);

    const toast = document.querySelector(".reward-toast");
    expect(toast).toBeTruthy();
    expect(toast?.textContent).toBe(`+${delta} ₽`);
  });
});
