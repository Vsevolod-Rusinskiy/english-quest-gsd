// applyRecommendedFocusGuardrail tests (PERSONAL-03, SMOKE-FIX-02). Mirrors
// difficultyGuardrails.test.ts's table-driven vitest style. Covers: valid-id
// passthrough, the exact live-observed hallucinated string -> fallback,
// empty-string -> fallback, and a "never throws / always returns a string"
// assertion.
import { describe, it, expect } from "vitest";
import { applyRecommendedFocusGuardrail } from "../../../src/core/personalization/recommendedFocusGuardrail";

describe("applyRecommendedFocusGuardrail (PERSONAL-03, SMOKE-FIX-02)", () => {
  it("valid id passthrough: a candidate that IS a key of TOPIC_LABELS returns unchanged, ignoring the fallback", () => {
    expect(
      applyRecommendedFocusGuardrail("present_continuous_now", "Продолжай практиковаться"),
    ).toBe("present_continuous_now");
  });

  it("invalid id -> fallback: the live-observed hallucinated mixed-language string returns the fallback verbatim", () => {
    const hallucinated =
      "present_simple_question_order with question formation in real contexts (building on the strong foundation in present continuous)";
    expect(applyRecommendedFocusGuardrail(hallucinated, "food_vocabulary")).toBe(
      "food_vocabulary",
    );
  });

  it("empty string -> fallback: candidate '' returns the fallback", () => {
    expect(applyRecommendedFocusGuardrail("", "Продолжай практиковаться")).toBe(
      "Продолжай практиковаться",
    );
  });

  it("never throws: whitespace, very long strings, and strings containing valid-id substrings all return a string, never an exception", () => {
    const candidates = [
      "   ",
      "a".repeat(10_000),
      "present_continuous_now_but_not_quite",
      "prefix_present_continuous_now",
    ];
    for (const candidate of candidates) {
      expect(() => applyRecommendedFocusGuardrail(candidate, "fallback")).not.toThrow();
      expect(typeof applyRecommendedFocusGuardrail(candidate, "fallback")).toBe("string");
    }
  });

  it("fallback identity: the value returned on a miss is exactly the fallback argument, not a recomputed/substituted value", () => {
    const fallback = "Продолжай практиковаться";
    expect(applyRecommendedFocusGuardrail("not_a_real_topic_id", fallback)).toBe(fallback);
  });
});
