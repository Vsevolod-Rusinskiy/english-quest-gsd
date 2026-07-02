import { describe, it, expect, beforeEach } from "vitest";
import { mountApp } from "../../src/main";

// End-to-end walking-skeleton test (Task 1, RED until Task 5 wires main.ts).
// Mounts the real app against the real public/Lesson-1A.json served by Vite,
// then drives the happy path: theory -> Понятно -> first text-input exercise.
describe("lesson walking skeleton (e2e)", () => {
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
  });

  it("renders theory, advances to first text-input exercise, and shows progress", async () => {
    await mountApp(root);

    // Theory rule text renders.
    expect(root.textContent).toContain("Понятно");
    expect(root.textContent).toContain("Не понятно");

    // Tap "Понятно" to advance.
    const understoodButton = Array.from(root.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Понятно",
    );
    expect(understoodButton).toBeTruthy();
    understoodButton?.click();

    // First text-input exercise prompt renders with progress indicator + submit button.
    expect(root.textContent).toContain("Задание 1 из 19");
    expect(root.textContent).toContain("Проверить");
    const input = root.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
  });
});
