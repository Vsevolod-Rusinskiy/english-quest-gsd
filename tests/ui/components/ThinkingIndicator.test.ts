import { describe, it, expect } from "vitest";
import { renderThinkingIndicator } from "../../../src/ui/components/ThinkingIndicator";

// Phase 5 (D-09): a single shared thinking-indicator component reused across
// all 3 agent-wait call sites in main.ts (theory buttons, exercise submit,
// "Показать итоги") — this test covers the pure render function in isolation.
describe("ThinkingIndicator", () => {
  it("returns an HTMLElement with the shared thinking-indicator class", () => {
    const el = renderThinkingIndicator();
    expect(el.className).toContain("thinking-indicator");
  });

  it('has the exact shared copy "Секунду, думаю…" per 05-UI-SPEC.md Copywriting Contract', () => {
    const el = renderThinkingIndicator();
    expect(el.textContent).toBe("Секунду, думаю…");
  });

  it('exposes role="status" for accessibility', () => {
    const el = renderThinkingIndicator();
    expect(el.getAttribute("role")).toBe("status");
  });

  it('exposes aria-live="polite" for accessibility', () => {
    const el = renderThinkingIndicator();
    expect(el.getAttribute("aria-live")).toBe("polite");
  });
});
