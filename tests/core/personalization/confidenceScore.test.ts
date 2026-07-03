// confidenceScore tests (PERSONAL-01, SPEC.md §12). Table-driven: pure formula
// clamp(correctRatio + 0.05*streak - 0.1*errorsInARow, 0, 1), including
// clamp-to-0 and clamp-to-1 boundary cases.
import { describe, it, expect } from "vitest";
import { computeConfidenceScore } from "../../../src/core/personalization/confidenceScore";

describe("computeConfidenceScore (SPEC.md §12 formula)", () => {
  it.each([
    // [correctRatio, streak, errorsInARow, expected]
    [0.5, 0, 0, 0.5],
    [0.8, 2, 0, 0.9], // 0.8 + 0.05*2 = 0.9
    [0.5, 0, 3, 0.2], // 0.5 - 0.1*3 = 0.2
    [0.5, 4, 2, 0.5], // 0.5 + 0.2 - 0.2 = 0.5
    [0.9, 3, 0, 1], // 0.9 + 0.15 = 1.05 -> clamped to 1 (clamp-to-1 case)
    [0.0, 0, 10, 0], // 0 - 1.0 = -1.0 -> clamped to 0 (clamp-to-0 case)
  ])(
    "computeConfidenceScore({correctRatio: %f, streak: %i, errorsInARow: %i}) === %f",
    (correctRatio, streak, errorsInARow, expected) => {
      expect(computeConfidenceScore({ correctRatio, streak, errorsInARow })).toBeCloseTo(expected, 5);
    },
  );

  it("clamps to 0 for a very low ratio combined with a high errorsInARow", () => {
    expect(computeConfidenceScore({ correctRatio: 0.1, streak: 0, errorsInARow: 20 })).toBe(0);
  });

  it("clamps to 1 for ratio 1 combined with a high streak", () => {
    expect(computeConfidenceScore({ correctRatio: 1, streak: 10, errorsInARow: 0 })).toBe(1);
  });
});
