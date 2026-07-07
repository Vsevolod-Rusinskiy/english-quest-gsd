// Visual progress bar (UX-PROGRESS-04) — mirrors ProgressIndicator's
// existing 3-variant overshoot guarding (main/review/complete): the caller
// passes complete/review-appropriate current/total, and this component's
// clamp guarantees the fill never exceeds 100% even if current > total.
// createElement/style/textContent only, never innerHTML.
export function renderProgressBar(current: number, total: number): HTMLElement {
  const track = document.createElement("div");
  track.className = "progress-bar";
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuenow", String(current));
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", String(total));

  const fraction = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;

  const fill = document.createElement("div");
  fill.className = "progress-bar-fill";
  fill.style.width = `${fraction * 100}%`;
  track.appendChild(fill);

  return track;
}
