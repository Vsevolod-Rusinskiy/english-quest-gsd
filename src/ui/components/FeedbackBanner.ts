// Correct/incorrect feedback (textContent only, never innerHTML).
export function renderFeedbackBanner(
  isCorrect: boolean,
  firstErrorHint?: string,
  praiseRu?: string,
): HTMLElement {
  const el = document.createElement("div");
  el.className = `feedback-banner ${isCorrect ? "correct" : "incorrect"}`;

  if (isCorrect) {
    el.textContent = "Верно!";
    // REWARD-03: Reward Advisor's agent-proposed, core-gated praise text —
    // only ever set when the agent's suggested reason matched a reward the
    // core actually granted (see lessonEngine.ts's cross-check gate). Shown
    // alongside, never instead of, the base "Верно!" confirmation.
    if (praiseRu) {
      const praise = document.createElement("p");
      praise.className = "praise-text";
      praise.textContent = praiseRu;
      el.appendChild(praise);
    }
  } else {
    const message = document.createElement("p");
    message.textContent = "Не совсем. Попробуй ещё раз.";
    el.appendChild(message);
    if (firstErrorHint) {
      const hint = document.createElement("p");
      hint.textContent = firstErrorHint;
      el.appendChild(hint);
    }
  }

  return el;
}
