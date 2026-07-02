import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mountApp } from "../../src/main";
import { PROGRESS_KEY } from "../../src/core/state/persistence";

// Full-lesson traversal e2e (Task 3, EXERCISE-05 headline proof): boots the real app
// against the real public/Lesson-1A.json, answers all 18 text-input + 1 matching
// exercises correctly in order, and asserts "Задание N из 19" advances 1->19 with
// every step persisted to localStorage (position matches the current index).
const lessonFixture = readFileSync(resolve(process.cwd(), "public/Lesson-1A.json"), "utf-8");
const lessonData = JSON.parse(lessonFixture);
const allExercises = lessonData.sections.flatMap((s: { exercises: unknown[] }) => s.exercises);

describe("full lesson traversal (e2e)", () => {
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

  it("completes all 19 real exercises across text-input + matching, advancing progress 1->19 with persistence at every step", async () => {
    await mountApp(root);

    const understoodButton = Array.from(root.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Понятно",
    );
    expect(understoodButton).toBeTruthy();
    understoodButton?.click();

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
      // assertion must wait for the post-settle DOM (the feedback banner)
      // instead of asserting immediately after click().
      await vi.waitFor(() => expect(root.textContent).toContain("Верно!"));

      // Every advance persisted: localStorage position matches the current index.
      const raw = localStorage.getItem(PROGRESS_KEY);
      expect(raw).toBeTruthy();
      const blob = JSON.parse(raw as string);
      expect(blob.data.currentPosition.currentExerciseIndex).toBe(i + 1);
    }

    // Lesson-complete state reached: index has advanced past the last real exercise.
    expect(root.textContent).toContain("Урок завершён!");
  });
});
