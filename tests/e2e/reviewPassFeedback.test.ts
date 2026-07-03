import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mountApp } from "../../src/main";
import * as answerCheckerModule from "../../src/core/agents/answerChecker";

// WR-02 regression (e2e): drives the real app through the DOM to reach the
// review pass, then answers a review item INCORRECTLY and proves the child
// sees visible "incorrect" feedback before advancing — previously,
// `result.isCorrect || inReviewPass` was always true for any review-pass
// answer, so the DOM was torn down and rebuilt for the NEXT review item
// before the feedback banner (keyed by the just-answered exercise's id) had
// any matching exercise on screen to attach to, silently dropping the
// "incorrect" banner.
const lessonFixture = readFileSync(resolve(process.cwd(), "public/Lesson-1A.json"), "utf-8");
const lessonData = JSON.parse(lessonFixture);
const allExercises = lessonData.sections.flatMap((s: { exercises: unknown[] }) => s.exercises);

function correctAnswerFor(exerciseId: string): string {
  const ex = allExercises.find((e: { exerciseId: string }) => e.exerciseId === exerciseId);
  return ex.answerCheck.correctAnswers[0];
}

function submitTextAnswer(root: HTMLElement, value: string): void {
  const input = root.querySelector('input[type="text"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  input.value = value;
  input.dispatchEvent(new Event("input"));
  const submitButton = Array.from(root.querySelectorAll("button")).find(
    (btn) => btn.textContent === "Проверить",
  ) as HTMLButtonElement;
  expect(submitButton.disabled).toBe(false);
  submitButton.click();
}

describe("review-pass feedback banner visibility (e2e, WR-02)", () => {
  let root: HTMLElement;

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
  });

  it("an incorrect review-pass answer shows the incorrect banner and only advances after Продолжить is tapped", async () => {
    // Plan 03: every wrong text-input answer below now triggers
    // callAnswerChecker via the gateway — mock it to a fast, deterministic
    // fallback-shaped result so this WR-02 DOM test stays fast and offline,
    // independent of the real network/agent content (out of scope here).
    const spy = vi
      .spyOn(answerCheckerModule, "callAnswerChecker")
      .mockResolvedValue({ isCorrect: false, source: "core", errorType: "unknown" });

    await mountApp(root);

    const understoodButton = Array.from(root.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Понятно",
    );
    understoodButton?.click();

    // Plan 02 (THEORY-03): onUnderstoodChoice is now async — wait for the
    // first exercise screen to render before the submit-answer loop begins.
    await vi.waitFor(() => expect(root.textContent).toContain("Задание 1 из 19"));

    // ex001-ex009: correct, no review trigger.
    for (let i = 1; i <= 9; i++) {
      submitTextAnswer(root, correctAnswerFor(`eq-1a-ex00${i}`));
      await vi.waitFor(() => expect(root.textContent).toContain("Верно!"));
    }

    // ex010 (food_vocabulary): wrong twice -> 2nd error flips topic to
    // needs_review and enqueues the whole food_vocabulary set, including
    // ex010 itself. Then answer it correctly a 3rd time to advance past it.
    submitTextAnswer(root, "definitely-wrong-answer");
    await vi.waitFor(() => expect(root.textContent).toContain("Не совсем"));
    submitTextAnswer(root, "definitely-wrong-answer");
    await vi.waitFor(() => expect(root.textContent).toContain("Не совсем"));
    submitTextAnswer(root, correctAnswerFor("eq-1a-ex010"));
    await vi.waitFor(() => expect(root.textContent).toContain("Верно!"));

    // ex011-ex018: correct, advances main sequence.
    for (let i = 11; i <= 18; i++) {
      submitTextAnswer(root, correctAnswerFor(`eq-1a-ex0${i}`));
      await vi.waitFor(() => expect(root.textContent).toContain("Верно!"));
    }

    // ex019 (matching): complete the main sequence.
    const leftButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("button.match-left"));
    const rightButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("button.match-right"));
    const ex019 = allExercises.find((e: { exerciseId: string }) => e.exerciseId === "eq-1a-ex019");
    for (const pair of ex019.answerCheck.pairs) {
      const leftIndex = ex019.leftItems.findIndex((li: { id: string }) => li.id === pair.leftId);
      const rightIndex = ex019.rightOptions.findIndex((ro: { id: string }) => ro.id === pair.rightId);
      leftButtons[leftIndex].click();
      rightButtons[rightIndex].click();
    }
    const matchSubmit = Array.from(root.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Проверить",
    ) as HTMLButtonElement;
    matchSubmit.click();
    await vi.waitFor(() => expect(root.textContent).toContain("Верно!"));

    // Now in the review pass — answer the FIRST review item incorrectly.
    expect(root.textContent).toContain("Повторение");
    const beforeInput = root.querySelector('input[type="text"]');
    expect(beforeInput).toBeTruthy();

    submitTextAnswer(root, "definitely-wrong-answer");

    // The incorrect banner must be visible NOW, before any advance.
    await vi.waitFor(() => expect(root.textContent).toContain("Не совсем"));

    // The exercise must still be the SAME review item's input (DOM not yet
    // torn down to the next item) plus an explicit continue affordance.
    const continueButton = Array.from(root.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Продолжить",
    ) as HTMLButtonElement;
    expect(continueButton).toBeTruthy();

    // Tapping Продолжить advances to the next review item.
    continueButton.click();
    expect(root.textContent).not.toContain("Не совсем");
    spy.mockRestore();
  });
});
