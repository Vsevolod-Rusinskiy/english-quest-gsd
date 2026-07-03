// Shared "thinking" cue (D-09) — reused verbatim at all 3 agent-wait call
// sites in main.ts (theory buttons, exercise submit, "Показать итоги").
// Zero-argument factory: createElement + textContent/setAttribute only.
export function renderThinkingIndicator(): HTMLElement {
  const el = document.createElement("div");
  el.className = "thinking-indicator";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = "Секунду, думаю…";
  return el;
}
