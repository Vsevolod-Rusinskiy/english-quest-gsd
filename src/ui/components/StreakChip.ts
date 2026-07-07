// Correct-answer streak chip (UX-PROGRESS-04) — only shows for a genuine run
// (streak >= 2 per CONTEXT.md #4), so it reads as a reward rather than
// clutter ("🔥 0"/"🔥 1" never render). createElement/textContent only.
export function renderStreakChip(streak: number): HTMLElement | null {
  if (streak < 2) return null;

  const chip = document.createElement("span");
  chip.className = "streak-chip";
  chip.textContent = `🔥 ${streak}`;
  return chip;
}
