import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mountApp } from "../../src/main";

// End-to-end walking-skeleton test (Task 1, RED until Task 5 wires main.ts).
// Mounts the real app against the real public/Lesson-1A.json content, then drives the
// happy path: theory -> Понятно -> first text-input exercise -> reload-resume (Task 5).
//
// jsdom has no static file server, so fetch() is stubbed to serve the real file's bytes
// from disk (the same content Vite's dev server would serve at /Lesson-1A.json) — this
// keeps the real fetch -> JSON.parse -> Zod safeParse code path under test, only the
// network transport is substituted.
const lessonFixture = readFileSync(resolve(process.cwd(), "public/Lesson-1A.json"), "utf-8");

describe("lesson walking skeleton (e2e)", () => {
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

  it("resumes at the exact position after a simulated reload (PERSIST-02, D-04)", async () => {
    await mountApp(root);

    const understoodButton = Array.from(root.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Понятно",
    );
    understoodButton?.click();

    const input = root.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = "He is working";
    input.dispatchEvent(new Event("input"));
    const submitButton = Array.from(root.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Проверить",
    ) as HTMLButtonElement;
    submitButton.click();

    // Plan 03 (RESEARCH.md Pitfall 2): submit is now async — wait for the
    // post-settle DOM instead of asserting immediately after click().
    await vi.waitFor(() => expect(root.textContent).toContain("Верно!"));
    expect(root.textContent).toContain("Задание 2 из 19");

    // Simulate a fresh mount (new StateStore reading the same localStorage) —
    // this is what happens on a real browser reload.
    document.body.innerHTML = "";
    const freshRoot = document.createElement("div");
    freshRoot.id = "app";
    document.body.appendChild(freshRoot);

    await mountApp(freshRoot);

    // Resumes at the advanced position, not back at theory.
    expect(freshRoot.textContent).not.toContain("Не понятно");
    expect(freshRoot.textContent).toContain("Задание 2 из 19");
  });
});
