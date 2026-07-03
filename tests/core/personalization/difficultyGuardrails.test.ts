// applyDifficultyGuardrails tests (PERSONAL-02, SPEC.md §12). Exhaustive
// transition matrix: same-mode no-op, one-step-up allowed/blocked,
// one-step-down allowed/blocked, two-step jump blocked (both directions),
// insufficient-signal no-change. Mirrors topicStatusMachine.test.ts's
// table-driven style (RESEARCH.md Pitfall 2).
import { describe, it, expect } from "vitest";
import { applyDifficultyGuardrails } from "../../../src/core/personalization/difficultyGuardrails";

describe("applyDifficultyGuardrails (PERSONAL-02)", () => {
  it("same-mode no-op: current normal, suggested normal -> normal", () => {
    expect(
      applyDifficultyGuardrails("normal", "normal", { correctStreak: 0, recentErrors: 0 }),
    ).toBe("normal");
  });

  it("one-step-up allowed: normal -> challenge with correctStreak >= 3", () => {
    expect(
      applyDifficultyGuardrails("normal", "challenge", { correctStreak: 3, recentErrors: 0 }),
    ).toBe("challenge");
  });

  it("one-step-up blocked (insufficient streak): normal -> challenge with correctStreak 1 stays normal", () => {
    expect(
      applyDifficultyGuardrails("normal", "challenge", { correctStreak: 1, recentErrors: 0 }),
    ).toBe("normal");
  });

  it("one-step-down allowed: normal -> easy with recentErrors >= 2", () => {
    expect(
      applyDifficultyGuardrails("normal", "easy", { correctStreak: 0, recentErrors: 2 }),
    ).toBe("easy");
  });

  it("one-step-down blocked (insufficient errors): normal -> easy with recentErrors 0 stays normal", () => {
    expect(
      applyDifficultyGuardrails("normal", "easy", { correctStreak: 0, recentErrors: 0 }),
    ).toBe("normal");
  });

  it("two-step jump blocked (up direction): easy -> challenge (even with correctStreak 3) advances at most one step to normal, never lands on challenge directly", () => {
    const result = applyDifficultyGuardrails("easy", "challenge", {
      correctStreak: 3,
      recentErrors: 0,
    });
    expect(result).not.toBe("challenge");
    expect(result).toBe("normal");
  });

  it("two-step jump blocked (down direction): challenge -> easy (even with recentErrors 2) advances at most one step to normal, never lands on easy directly", () => {
    const result = applyDifficultyGuardrails("challenge", "easy", {
      correctStreak: 0,
      recentErrors: 2,
    });
    expect(result).not.toBe("easy");
    expect(result).toBe("normal");
  });

  it("insufficient signal, no other change: easy -> normal with correctStreak 0 stays easy (no upward change without the streak gate)", () => {
    expect(
      applyDifficultyGuardrails("easy", "normal", { correctStreak: 0, recentErrors: 0 }),
    ).toBe("easy");
  });

  it("never returns the agent's raw suggestion verbatim without passing through the gate: challenge -> easy with insufficient errors stays challenge", () => {
    expect(
      applyDifficultyGuardrails("challenge", "easy", { correctStreak: 0, recentErrors: 1 }),
    ).toBe("challenge");
  });
});
