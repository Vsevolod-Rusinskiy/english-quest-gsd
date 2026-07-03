// Reward toast (D-10) — the visual celebration of an ALREADY-decided reward
// event, never new reward logic. Pure render function; caller (main.ts) owns
// mount/auto-dismiss timing. Uses createElement + textContent only.
export function renderRewardToast(amount: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "reward-toast";
  el.textContent = `+${amount} ₽`;
  return el;
}
