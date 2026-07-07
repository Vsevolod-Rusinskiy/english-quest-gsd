// Compact topic-mastery summary (UX-PROGRESS-04) — a single slim,
// unobtrusive line: "освоено N / M тем" (N = mastered topics, M = total
// topics tracked). Kept minimal per CONTEXT.md #4's "first pass, keep it
// minimal and unobtrusive" guidance — no per-topic chip row this pass, to
// avoid cluttering the top-bar. Returns null (never divides/throws) for an
// empty topicStats — 260707-pu4: the "освоено 0 / 0 тем" zero-state must
// never render before any topic has been touched, so the caller guards the
// nullable return (mirroring StreakChip's `if (streakChip)` pattern) instead
// of an always-rendered element. createElement/textContent only; RU labels
// would come via topicLabel(id) if per-topic display is added later.
import type { TopicStat } from "../../core/state/progressSchema";

export function renderTopicMasterySummary(
  topicStats: Record<string, TopicStat>,
): HTMLElement | null {
  const entries = Object.values(topicStats);
  if (entries.length === 0) {
    return null;
  }

  const el = document.createElement("div");
  el.className = "topic-mastery";

  const masteredCount = entries.filter((stat) => stat.status === "mastered").length;
  const total = entries.length;

  el.textContent = `освоено ${masteredCount} / ${total} тем`;

  return el;
}
