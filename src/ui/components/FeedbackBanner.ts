// Correct/incorrect feedback (textContent only, never innerHTML).
export function renderFeedbackBanner(isCorrect: boolean, firstErrorHint?: string): HTMLElement {
  const el = document.createElement("div");
  el.className = `feedback-banner ${isCorrect ? "correct" : "incorrect"}`;

  if (isCorrect) {
    el.textContent = "Верно!";
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
