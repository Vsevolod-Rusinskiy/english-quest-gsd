import { describe, it, expect } from "vitest";
import { renderStreakChip } from "../../../src/ui/components/StreakChip";

// UX-PROGRESS-04: streak chip only rewards a RUN (streak >= 2), never shows
// "🔥 0" / "🔥 1" clutter.
describe("renderStreakChip", () => {
  it("returns null for streak 0", () => {
    expect(renderStreakChip(0)).toBeNull();
  });

  it("returns null for streak 1", () => {
    expect(renderStreakChip(1)).toBeNull();
  });

  it("returns a chip element with '🔥 2' for streak 2", () => {
    const chip = renderStreakChip(2);
    expect(chip).not.toBeNull();
    expect(chip!.classList.contains("streak-chip")).toBe(true);
    expect(chip!.textContent).toBe("🔥 2");
  });

  it("returns a chip element with '🔥 5' for streak 5", () => {
    const chip = renderStreakChip(5);
    expect(chip!.textContent).toBe("🔥 5");
  });
});
