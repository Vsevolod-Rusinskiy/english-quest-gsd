import { describe, it, expect } from "vitest";
import { renderProgressBar } from "../../../src/ui/components/ProgressBar";

// UX-PROGRESS-04: visual progress bar mirroring ProgressIndicator's 3-variant
// (main/review/complete) overshoot guarding — the fill fraction is clamped
// to [0, 1] so it never exceeds 100% width even if current > total.
describe("renderProgressBar", () => {
  it("uses createElement/textContent/style only, never innerHTML", () => {
    const el = renderProgressBar(1, 19);
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("sets fill width to current/total as a percentage", () => {
    const el = renderProgressBar(5, 20);
    const fill = el.querySelector<HTMLElement>(".progress-bar-fill");
    expect(fill).toBeTruthy();
    expect(fill!.style.width).toBe("25%");
  });

  it("clamps fill to 100% width, never overshoots, when current > total", () => {
    const el = renderProgressBar(20, 19);
    const fill = el.querySelector<HTMLElement>(".progress-bar-fill");
    expect(fill!.style.width).toBe("100%");
  });

  it("renders a full bar for the complete state (current === total)", () => {
    const el = renderProgressBar(19, 19);
    const fill = el.querySelector<HTMLElement>(".progress-bar-fill");
    expect(fill!.style.width).toBe("100%");
  });

  it("never overshoots for a review-pass current/total pair", () => {
    const el = renderProgressBar(3, 3);
    const fill = el.querySelector<HTMLElement>(".progress-bar-fill");
    expect(fill!.style.width).toBe("100%");
  });

  it("handles total === 0 safely (never divides by zero / NaN width)", () => {
    const el = renderProgressBar(0, 0);
    const fill = el.querySelector<HTMLElement>(".progress-bar-fill");
    expect(fill!.style.width).toBe("0%");
  });

  it("exposes progressbar ARIA attributes for accessibility", () => {
    const el = renderProgressBar(5, 20);
    expect(el.getAttribute("role")).toBe("progressbar");
    expect(el.getAttribute("aria-valuenow")).toBe("5");
    expect(el.getAttribute("aria-valuemin")).toBe("0");
    expect(el.getAttribute("aria-valuemax")).toBe("20");
  });
});
