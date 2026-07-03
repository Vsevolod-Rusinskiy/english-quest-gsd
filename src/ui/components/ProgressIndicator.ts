// "Задание N из total" (EXERCISE-05). total reads from lesson data length
// (sections[].exercises.length), never a hardcoded literal (Open Question 2).
export function renderProgressIndicator(current: number, total: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "label progress-indicator";
  el.textContent = `Задание ${current} из ${total}`;
  return el;
}

// Review-pass variant (PROGRESS-04, D-02, T-02-05): distinct label + sub-range
// so the review pass never renders currentExerciseIndex+1 past the main total
// (would compound Phase 1 UAT Gap 2's overshoot). Zero innerHTML, same
// createElement/textContent pattern as the main-pass indicator above.
export function renderReviewProgressIndicator(current: number, total: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "label progress-indicator review-progress-indicator";
  el.textContent = `Повторение: ${current} из ${total}`;
  return el;
}

// Completion variant (Phase 5, D-12 Gap 2 fix): accepts only `total` — no
// current/overshoot risk by construction, never renders "N+1 из N" at
// lesson-complete.
export function renderProgressIndicatorComplete(total: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "label progress-indicator progress-indicator-complete";
  el.textContent = `Задание ${total} из ${total}`;
  return el;
}
