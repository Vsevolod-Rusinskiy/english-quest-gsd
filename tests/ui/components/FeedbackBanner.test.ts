import { describe, it, expect } from "vitest";
import { renderFeedbackBanner } from "../../../src/ui/components/FeedbackBanner";

// REWARD-03 gap fix (found during Phase 5's human-verify checkpoint walkthrough):
// Reward Advisor's agent-proposed, core-gated praise text (praiseRu) was computed
// and cross-checked in lessonEngine.ts but never actually rendered anywhere in the
// UI — this covers the fix that threads it into the correct-answer banner.
describe("renderFeedbackBanner", () => {
  it("correct, no praiseRu -> shows only 'Верно!', no .praise-text element", () => {
    const el = renderFeedbackBanner(true);
    expect(el.textContent).toBe("Верно!");
    expect(el.querySelector(".praise-text")).toBeNull();
  });

  it("correct with praiseRu -> shows 'Верно!' plus a .praise-text element with the praise copy", () => {
    const el = renderFeedbackBanner(true, undefined, "Отличная серия!");
    expect(el.textContent).toContain("Верно!");
    const praise = el.querySelector(".praise-text");
    expect(praise).not.toBeNull();
    expect(praise?.textContent).toBe("Отличная серия!");
  });

  it("incorrect answer ignores praiseRu even if passed (never shown for a wrong answer)", () => {
    const el = renderFeedbackBanner(false, "hint text", "should not appear");
    expect(el.querySelector(".praise-text")).toBeNull();
    expect(el.textContent).not.toContain("should not appear");
  });
});
