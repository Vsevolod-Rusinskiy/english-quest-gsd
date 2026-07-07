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
    expect(el.textContent).toContain("освоено 2 / 4 тем");
  });

  it("never throws and shows a zero-state for an empty topicStats", () => {
    let el: HTMLElement;
    expect(() => {
      el = renderTopicMasterySummary({});
    }).not.toThrow();
    expect(el!.textContent).toContain("освоено 0 / 0 тем");
  });

  it("uses topicLabel() RU display names, never raw snake_case ids, when rendering per-topic labels", () => {
    const topicStats: Record<string, TopicStat> = {
      food_vocabulary: makeStat("mastered"),
    };
    const el = renderTopicMasterySummary(topicStats);
    // If per-topic chips are rendered, they must use RU labels not raw ids.
    expect(el.textContent).not.toContain("food_vocabulary");
  });
});
