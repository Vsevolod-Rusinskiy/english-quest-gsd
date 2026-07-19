import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mountApp } from "../../src/main";
import * as theoryTutorModule from "../../src/core/agents/theoryTutor";
import * as rewardAdvisorModule from "../../src/core/agents/rewardAdvisor";

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
  // Plan 04-01 (REWARD-03/04): a correct text-input answer below now
  // triggers a live Reward Advisor call whenever a reward event fires —
  // mock it to the no-praise fallback so this pre-existing e2e stays
  // offline/fast; Reward Advisor's own behavior is covered by
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

    // Plan 02 (THEORY-03): onUnderstoodChoice is now async (awaits
    // handleTheoryStep) — wait for the post-settle DOM instead of asserting
    // immediately after click().
    await vi.waitFor(() => expect(root.textContent).toContain("Задание 1 из 19"));
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

    // Plan 02 (THEORY-03): onUnderstoodChoice is now async — wait for the
    // exercise screen to render before querying its input.
    await vi.waitFor(() => expect(root.textContent).toContain("Задание 1 из 19"));

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

  // Plan 02 (THEORY-03 end-to-end, D-11): the full "не понятно" simplify
  // loop, DOM-driven — round 1 core-only, rounds 2-3 agent-backed (mocked),
  // soft transition at the cap, and "Понятно" immediate exit.
  describe("Theory Tutor simplify loop (THEORY-03, D-11)", () => {
    let theoryTutorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      theoryTutorSpy = vi.spyOn(theoryTutorModule, "callTheoryTutor").mockResolvedValue({
        explanationRu: "Agent-simplified explanation for round 2/3",
        exampleRu: "Agent example sentence",
        source: "agent",
      });
    });

    afterEach(() => {
      theoryTutorSpy.mockRestore();
    });

    it("round 1 'Не понятно' shows the pre-written simple level, stays on theory, no agent call", async () => {
      await mountApp(root);

      const notUnderstoodButton = () =>
        Array.from(root.querySelectorAll("button")).find(
          (btn) => btn.textContent === "Не понятно",
        ) as HTMLButtonElement;

      notUnderstoodButton().click();
      await vi.waitFor(() =>
        expect(root.textContent).toContain(
          "Привычка или всегда → простое время: I eat.",
        ),
      );
      expect(theoryTutorSpy).not.toHaveBeenCalled();
      // Still on theory — the understood/not-understood buttons remain.
      expect(root.textContent).toContain("Не понятно");
    });

    it("rounds 2+ call the (mocked) Theory Tutor for a new variant each time, with NO cap — 'Не понятно' never auto-transitions", async () => {
      await mountApp(root);

      const notUnderstoodButton = () =>
        Array.from(root.querySelectorAll("button")).find(
          (btn) => btn.textContent === "Не понятно",
        ) as HTMLButtonElement;

      notUnderstoodButton().click(); // round 1: core-only
      await vi.waitFor(() =>
        expect(root.textContent).toContain(
          "Привычка или всегда → простое время: I eat.",
        ),
      );

      notUnderstoodButton().click(); // round 2: agent-backed
      await vi.waitFor(() =>
        expect(root.textContent).toContain("Agent-simplified explanation for round 2/3"),
      );
      expect(theoryTutorSpy).toHaveBeenCalledTimes(1);
      expect(root.textContent).toContain("Не понятно");

      // Round 3 (previously the cap): still calls the agent, still on theory,
      // still shows the buttons — no transition to exercises. Wait for the
      // re-rendered button to be enabled again before the next click.
      notUnderstoodButton().click();
      await vi.waitFor(() => {
        expect(theoryTutorSpy).toHaveBeenCalledTimes(2);
        expect(notUnderstoodButton()?.disabled).toBe(false);
      });
      expect(root.textContent).toContain("Не понятно");
      expect(root.textContent).not.toContain("Задание 1 из 19");

      // Round 4+ keeps going indefinitely — one more to prove it is unbounded.
      notUnderstoodButton().click();
      await vi.waitFor(() => {
        expect(theoryTutorSpy).toHaveBeenCalledTimes(3);
        expect(notUnderstoodButton()?.disabled).toBe(false);
      });
      expect(root.textContent).toContain("Не понятно");
      expect(root.textContent).not.toContain("Задание 1 из 19");
    });

    it("'Понятно' at any point renders the first exercise immediately", async () => {
      await mountApp(root);

      const notUnderstoodButton = Array.from(root.querySelectorAll("button")).find(
        (btn) => btn.textContent === "Не понятно",
      ) as HTMLButtonElement;
      notUnderstoodButton.click();
      await vi.waitFor(() =>
        expect(root.textContent).toContain(
          "Привычка или всегда → простое время: I eat.",
        ),
      );

      const understoodButton = Array.from(root.querySelectorAll("button")).find(
        (btn) => btn.textContent === "Понятно",
      ) as HTMLButtonElement;
      understoodButton.click();

      await vi.waitFor(() => expect(root.textContent).toContain("Задание 1 из 19"));
      expect(theoryTutorSpy).not.toHaveBeenCalled();
    });
  });
});
