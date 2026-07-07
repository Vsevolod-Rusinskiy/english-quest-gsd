import { describe, it, expect } from "vitest";
import { renderTopicMasterySummary } from "../../../src/ui/components/TopicMasterySummary";
import type { TopicStat } from "../../../src/core/state/progressSchema";

function makeStat(status: TopicStat["status"]): TopicStat {
  return { status, attempts: 1, correct: 1, errors: 0, correctStreak: 1 };
}

// UX-PROGRESS-04: compact topic-mastery summary — "освоено N / M тем" using
// topicLabel() RU names, safe on an empty topicStats (no divide/throw).
describe("renderTopicMasterySummary", () => {
  it("shows mastered count from a mixed-status topicStats fixture", () => {
    const topicStats: Record<string, TopicStat> = {
      food_vocabulary: makeStat("mastered"),
      non_action_verb: makeStat("mastered"),
      present_simple_negative: makeStat("in_progress"),
      restaurant_vocabulary: makeStat("not_started"),
    };
    const el = renderTopicMasterySummary(topicStats);
    expect(el).toBeTruthy();
    expect(el?.textContent).toContain("освоено 2 / 4 тем");
  });

  // 260707-pu4: renderTopicMasterySummary now returns null for an empty
  // topicStats instead of an always-rendered "освоено 0 / 0 тем" zero-state —
  // that line must never appear before any topic has been touched.
  it("returns null (never throws) for an empty topicStats", () => {
    let el: HTMLElement | null = null;
    expect(() => {
      el = renderTopicMasterySummary({});
    }).not.toThrow();
    expect(el).toBeNull();
  });

  it("uses topicLabel() RU display names, never raw snake_case ids, when rendering per-topic labels", () => {
    const topicStats: Record<string, TopicStat> = {
      food_vocabulary: makeStat("mastered"),
    };
    const el = renderTopicMasterySummary(topicStats);
    expect(el).toBeTruthy();
    // If per-topic chips are rendered, they must use RU labels not raw ids.
    expect(el?.textContent).not.toContain("food_vocabulary");
  });
});
