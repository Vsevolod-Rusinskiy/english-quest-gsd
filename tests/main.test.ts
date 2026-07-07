import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mountApp } from "../src/main";
import * as rewardAdvisorModule from "../src/core/agents/rewardAdvisor";
import * as answerCheckerModule from "../src/core/agents/answerChecker";
import * as progressAdvisorModule from "../src/core/agents/progressAdvisor";
import * as parentReportGeneratorModule from "../src/core/agents/parentReportGenerator";
import { fillCorrectTextAnswer } from "./helpers/multiBlankAnswers";

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
        fillCorrectTextAnswer(root, exercise.exerciseId, correctAnswerFor(exercise.exerciseId));
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
        fillCorrectTextAnswer(root, exercise.exerciseId, exercise.answerCheck.correctAnswers[0]);
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

  // Test C2 (260707-pu4): top-bar two-row DOM structure — row1 holds title +
  // ruble chip; .topic-mastery must be ABSENT at exercise-start (before any
  // answer, topicStats empty), proving Task 1's null-return + Task 2's guard
  // are wired end-to-end. jsdom doesn't compute real layout, so this asserts
  // DOM structure/presence, not pixel width, per the plan's stated scope.
  it("renders the top bar as two rows and hides .topic-mastery when topicStats is empty", async () => {
    await mountApp(root);
    await advanceThroughTheory();

    const row1 = root.querySelector(".top-bar .top-bar-row-1");
    expect(row1).toBeTruthy();
    expect(row1?.querySelector(".heading")).toBeTruthy();
    expect(row1?.querySelector(".ruble-balance")).toBeTruthy();

    expect(root.querySelector(".topic-mastery")).toBeNull();
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

  // Test F (WR-02 gap fix): praiseRu wiring end-to-end through a real
  // handleAnswer() call — not just FeedbackBanner.test.ts's isolated
  // hand-passed-string unit test. Mocks callRewardAdvisor to return a
  // source:"agent" response whose suggestedReasons actually matches a
  // reward event the first exercise's first-try-correct answer grants
  // (honest_attempt + first_try_correct), proving the cross-check gate in
  // lessonEngine.ts lets a genuinely-granted reason through to the DOM.
  it("renders Reward Advisor's praiseRu in the feedback banner when its suggested reason matches an actually-granted reward (WR-02)", async () => {
    rewardAdvisorSpy.mockResolvedValue({
      suggestedReasons: ["first_try_correct"],
      celebrationRu: "Отличная работа с первой попытки!",
      source: "agent",
    });

    await mountApp(root);
    await advanceThroughTheory();

    const firstExercise = allExercises[0];
    const input = root.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = firstExercise.answerCheck.correctAnswers[0];
    input.dispatchEvent(new Event("input"));
    submitButton().click();

    await vi.waitFor(() => expect(root.textContent).toContain("Задание 2 из 19"));

    const praise = root.querySelector(".praise-text");
    expect(praise).toBeTruthy();
    expect(praise?.textContent).toBe("Отличная работа с первой попытки!");
  });

  // Tests G/H/I (UX-HINT-03): escalating authored hints on wrong text-input
  // answers, replacing the old result.hintRu-first priority. The agent's
  // Answer Checker is mocked to keep these tests offline/fast (its own
  // behavior is covered by answerChecker's own tests) — a deliberately-wrong
  // answer always routes through it (D-10) since the deterministic check
  // fails first.
  describe("escalating authored hints on wrong text-input answers (UX-HINT-03)", () => {
    let answerCheckerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      answerCheckerSpy = vi.spyOn(answerCheckerModule, "callAnswerChecker").mockResolvedValue({
        isCorrect: false,
        source: "agent",
        errorType: "unknown",
        confidence: 0.9,
        hintRu: "Агентская подсказка, которая не должна заменять авторскую.",
      });
    });

    afterEach(() => {
      answerCheckerSpy.mockRestore();
    });

    it("shows exercise.hint.firstError on the 1st wrong attempt (ex001 has secondError)", async () => {
      await mountApp(root);
      await advanceThroughTheory();

      const ex001 = allExercises.find(
        (e: { exerciseId: string }) => e.exerciseId === "eq-1a-ex001",
      );

      const input = root.querySelector('input[type="text"]') as HTMLInputElement;
      input.value = "wrong answer";
      input.dispatchEvent(new Event("input"));
      submitButton().click();

      await vi.waitFor(() => expect(root.textContent).toContain("Не совсем"));

      const banner = root.querySelector(".feedback-banner");
      expect(banner?.textContent).toContain(ex001.hint.firstError);
      expect(banner?.textContent).not.toContain(ex001.hint.secondError);
      // Agent hintRu no longer replaces the authored hint.
      expect(banner?.textContent).not.toContain("Агентская подсказка");
    });

    it("escalates to exercise.hint.secondError on the 2nd+ wrong attempt on the SAME exercise", async () => {
      await mountApp(root);
      await advanceThroughTheory();

      const ex001 = allExercises.find(
        (e: { exerciseId: string }) => e.exerciseId === "eq-1a-ex001",
      );

      const input = root.querySelector('input[type="text"]') as HTMLInputElement;

      // 1st wrong attempt.
      input.value = "wrong answer one";
      input.dispatchEvent(new Event("input"));
      submitButton().click();
      await vi.waitFor(() => expect(root.textContent).toContain("Не совсем"));

      // 2nd wrong attempt on the same, still-current exercise (WR-03: the
      // field is not cleared/advanced on an incorrect main-pass answer).
      input.value = "wrong answer two";
      input.dispatchEvent(new Event("input"));
      submitButton().click();
      await vi.waitFor(() =>
        expect(root.querySelector(".feedback-banner")?.textContent).toContain(
          ex001.hint.secondError,
        ),
      );

      const banner = root.querySelector(".feedback-banner");
      expect(banner?.textContent).toContain(ex001.hint.secondError);
    });

    it("falls back to firstError on the 2nd+ wrong attempt when secondError is absent (ex010)", async () => {
      await mountApp(root);
      await advanceThroughTheory();

      const ex010 = allExercises.find(
        (e: { exerciseId: string }) => e.exerciseId === "eq-1a-ex010",
      );
      expect(ex010.hint.secondError).toBeUndefined();

      // Advance to ex010 (the 10th exercise) with correct answers, mocking
      // the deterministic path each time (no agent call needed for correct
      // answers).
      answerCheckerSpy.mockRestore();
      for (let i = 0; i < 9; i++) {
        const exercise = allExercises[i];
        fillCorrectTextAnswer(root, exercise.exerciseId, exercise.answerCheck.correctAnswers[0]);
        const btn = submitButton();
        btn.click();
        await vi.waitFor(() => expect(btn.disabled).toBe(false));
      }
      await vi.waitFor(() => expect(root.textContent).toContain("Задание 10 из 19"));

      // Re-stub the agent for the two wrong attempts on ex010.
      answerCheckerSpy = vi.spyOn(answerCheckerModule, "callAnswerChecker").mockResolvedValue({
        isCorrect: false,
        source: "agent",
        errorType: "unknown",
        confidence: 0.9,
        hintRu: "Агентская подсказка, которая не должна заменять авторскую.",
      });

      const input = root.querySelector('input[type="text"]') as HTMLInputElement;
      input.value = "wrong one";
      input.dispatchEvent(new Event("input"));
      submitButton().click();
      await vi.waitFor(() => expect(root.textContent).toContain("Не совсем"));
      expect(root.querySelector(".feedback-banner")?.textContent).toContain(
        ex010.hint.firstError,
      );

      input.value = "wrong two";
      input.dispatchEvent(new Event("input"));
      submitButton().click();
      await vi.waitFor(() =>
        expect(root.querySelector(".feedback-banner")?.textContent).toContain(
          ex010.hint.firstError,
        ),
      );

      // Never blank — firstError still shown, not an undefined/absent hint.
      const banner = root.querySelector(".feedback-banner");
      expect(banner?.textContent).toContain(ex010.hint.firstError);
    });
  });
});
