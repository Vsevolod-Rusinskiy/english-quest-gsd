// Compact topic-mastery summary (UX-PROGRESS-04) — a single slim,
// unobtrusive line: "освоено N / M тем" (N = mastered topics, M = total
// topics tracked). Kept minimal per CONTEXT.md #4's "first pass, keep it
// minimal and unobtrusive" guidance — no per-topic chip row this pass, to
// avoid cluttering the top-bar. Guards the empty-topicStats case (never
// divides/throws). createElement/textContent only; RU labels would come via
// topicLabel(id) if per-topic display is added later.
import type { TopicStat } from "../../core/state/progressSchema";

export function renderTopicMasterySummary(topicStats: Record<string, TopicStat>): HTMLElement {
  const el = document.createElement("div");
  el.className = "topic-mastery";

  const entries = Object.values(topicStats);
  const masteredCount = entries.filter((stat) => stat.status === "mastered").length;
  const total = entries.length;

  el.textContent = `освоено ${masteredCount} / ${total} тем`;

  return el;
}
