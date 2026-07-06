// topicLabel() unit tests (T-nxg-01): a lookup miss must return the raw id
// verbatim and never throw. Each of the 8 known topic-impact ids from
// Lesson-1A.json must map to a distinct, non-empty Russian label.
import { describe, it, expect } from "vitest";
import { topicLabel, TOPIC_LABELS } from "../../../src/core/topics/topicLabels";

const KNOWN_TOPIC_IDS = [
  "food_vocabulary",
  "non_action_verb",
  "present_continuous_future_arrangement",
  "present_continuous_now",
  "present_simple_negative",
  "present_simple_question_order",
  "present_simple_third_person_negative",
  "restaurant_vocabulary",
];

describe("topicLabel", () => {
  it("returns a non-empty Russian string (contains Cyrillic) for a known id", () => {
    const label = topicLabel("present_simple_question_order");
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toBe("present_simple_question_order");
    expect(label).toMatch(/[а-яА-ЯёЁ]/);
  });

  it("maps each of the 8 known ids to a distinct human-readable Russian label", () => {
    const labels = KNOWN_TOPIC_IDS.map((id) => topicLabel(id));
    for (const id of KNOWN_TOPIC_IDS) {
      expect(TOPIC_LABELS[id]).toBeDefined();
    }
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
    }
    expect(new Set(labels).size).toBe(KNOWN_TOPIC_IDS.length);
  });

  it("returns the raw id verbatim for an unknown id, never throws", () => {
    expect(() => topicLabel("some_unknown_future_id")).not.toThrow();
    expect(topicLabel("some_unknown_future_id")).toBe("some_unknown_future_id");
  });

  it("returns an empty string for an empty id, never throws", () => {
    expect(() => topicLabel("")).not.toThrow();
    expect(topicLabel("")).toBe("");
  });
});
