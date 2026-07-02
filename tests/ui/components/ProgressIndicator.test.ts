import { describe, it, expect } from "vitest";
import { renderProgressIndicator } from "../../../src/ui/components/ProgressIndicator";

describe("ProgressIndicator", () => {
  it('shows "Задание 1 из 19" from data length, not a hardcoded literal', () => {
    const el = renderProgressIndicator(1, 19);
    expect(el.textContent).toBe("Задание 1 из 19");
  });

  it("reflects an arbitrary current/total pair (denominator is data-driven)", () => {
    const el = renderProgressIndicator(5, 12);
    expect(el.textContent).toBe("Задание 5 из 12");
  });
});
