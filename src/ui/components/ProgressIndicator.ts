// "Задание N из total" (EXERCISE-05). total reads from lesson data length
// (sections[].exercises.length), never a hardcoded literal (Open Question 2).
export function renderProgressIndicator(current: number, total: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "label progress-indicator";
  el.textContent = `Задание ${current} из ${total}`;
  return el;
}
