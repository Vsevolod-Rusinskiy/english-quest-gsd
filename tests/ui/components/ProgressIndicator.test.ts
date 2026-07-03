import { describe, it, expect } from "vitest";
import {
  renderProgressIndicator,
  renderReviewProgressIndicator,
  renderProgressIndicatorComplete,
} from "../../../src/ui/components/ProgressIndicator";

describe("ProgressIndicator", () => {
  it('shows "Задание 1 из 19" from data length, not a hardcoded literal', () => {
    const el = renderProgressIndicator(1, 19);
    expect(el.textContent).toBe("Задание 1 из 19");
  });

  it("reflects an arbitrary current/total pair (denominator is data-driven)", () => {
    const el = renderProgressIndicator(5, 12);
    expect(el.textContent).toBe("Задание 5 из 12");
  });

  // Plan 03 (PROGRESS-04, D-02, T-02-05): distinct review-pass label/range,
  // never a main-sequence "N из 19" past the main total (Gap 2 overshoot).
  describe("renderReviewProgressIndicator", () => {
    it('shows "Повторение: 1 из 2" for the review sub-range, distinct from the main-pass label', () => {
      const el = renderReviewProgressIndicator(1, 2);
      expect(el.textContent).toBe("Повторение: 1 из 2");
    });

    it("reflects an arbitrary review current/total pair", () => {
      const el = renderReviewProgressIndicator(3, 5);
      expect(el.textContent).toBe("Повторение: 3 из 5");
    });
  });

  // Phase 5 (D-12 Gap 2 fix): a completion-specific variant that only ever
  // accepts `total` (no current/overshoot risk by construction) — never
  // renders "N+1 из N" at lesson-complete.
  describe("renderProgressIndicatorComplete", () => {
    it('shows "Задание 19 из 19" (never "20 из 19") for a 19-exercise lesson', () => {
      const el = renderProgressIndicatorComplete(19);
      expect(el.textContent).toBe("Задание 19 из 19");
    });

    it("clamps to the same total on both sides for an arbitrary total", () => {
      const el = renderProgressIndicatorComplete(7);
      expect(el.textContent).toBe("Задание 7 из 7");
    });
  });
});
