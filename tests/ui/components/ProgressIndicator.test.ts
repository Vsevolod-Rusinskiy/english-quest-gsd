import { describe, it, expect } from "vitest";
import {
  renderProgressIndicator,
  renderReviewProgressIndicator,
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
});
