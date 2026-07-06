// Topic-id -> Russian display-label lookup (SMOKE-FIX-01). Fixes a live
// smoke-test bug where raw internal snake_case topic-ids (from
// Lesson-1A.json's topicImpact ids, propagated through Progress Advisor's
// strugglingTopics/reviewTopics/recommendedFocus) leaked into user/parent-
// facing Russian text (SessionEndScreen, parentReportGenerator's fallback
// template). A lookup miss returns the raw id string unchanged and NEVER
// throws (T-nxg-01) — both an unrecognized future topic-id and an agent's
// free-form Russian recommendation text pass through this function safely.
export const TOPIC_LABELS: Record<string, string> = {
  food_vocabulary: "лексика: еда",
  non_action_verb: "глаголы-состояния",
  present_continuous_future_arrangement: "Present Continuous: планы на будущее",
  present_continuous_now: "Present Continuous: действие сейчас",
  present_simple_negative: "Present Simple: отрицание",
  present_simple_question_order: "Present Simple: порядок слов в вопросе",
  present_simple_third_person_negative: "Present Simple: отрицание в 3-м лице",
  restaurant_vocabulary: "лексика: ресторан",
};

export function topicLabel(id: string): string {
  return TOPIC_LABELS[id] ?? id;
}
