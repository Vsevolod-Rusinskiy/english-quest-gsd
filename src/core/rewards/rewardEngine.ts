// Fixed-rule reward engine (REWARD-01, REWARD-02, D-03/D-04/D-05).
// Pure function: NO network, NO agent call — Reward Advisor (Phase 4) proposes
// praise text/reasons on top of this, but never writes amounts. This module is
// the sole place SPEC §10 reward amounts are decided and dedup/limits enforced.
//
// Phase 2 scope decision (resolves RESEARCH.md Open Question 2): Phase 1 built
// no runtime "hint shown" tracking, but its FeedbackBanner already surfaces
// exercise.hint.firstError on every incorrect answer — so any prior incorrect
// attempt means the child saw a hint before a later correct answer. The
// recovery case (correct after a prior incorrect attempt) is therefore graded
// as correct_after_hint. fixed_mistake describes the same "correct after a
// previous incorrect" situation per SPEC, so granting both would double-pay
// one recovery; this engine intentionally emits only correct_after_hint for
// that case and leaves fixed_mistake reachable in the enum for a future phase
// if real hint-vs-mistake tracking is ever built to distinguish them.
import type { RewardEvent, RewardReason } from "../state/progressSchema";

export interface ComputeRewardEventsInput {
  exerciseId: string;
  isCorrect: boolean;
  priorAttempts: number; // count of prior attempts on this exercise (0 = first ever attempt)
  rewardHistory: RewardEvent[];
  currentCorrectStreak: number; // session-global streak value BEFORE this attempt
  // CR-01: plural — a single exercise can carry multiple topicImpact entries
  // that independently cross the mastery threshold in the same call. One
  // weak_topic_closed event is emitted per topic in this array.
  masteredTopics: string[];
}

export interface ComputeRewardEventsResult {
  rewardEvents: RewardEvent[];
  nextCorrectStreak: number;
}

const REWARD_AMOUNTS: Record<RewardReason, number> = {
  honest_attempt: 1,
  first_try_correct: 5,
  correct_after_hint: 3,
  fixed_mistake: 4,
  streak_bonus: 10,
  weak_topic_closed: 15,
};

function alreadyGranted(rewardHistory: RewardEvent[], exerciseId: string, reason: RewardReason): boolean {
  return rewardHistory.some((r) => r.exerciseId === exerciseId && r.reason === reason);
}

function makeEvent(
  reason: RewardReason,
  attemptNumber: number,
  extra: { exerciseId?: string; relatedTopic?: string },
): RewardEvent {
  return {
    rewardEventId: crypto.randomUUID(),
    reason,
    amount: REWARD_AMOUNTS[reason],
    attemptNumber,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

export function computeRewardEvents(input: ComputeRewardEventsInput): ComputeRewardEventsResult {
  const { exerciseId, isCorrect, priorAttempts, rewardHistory, currentCorrectStreak, masteredTopics } = input;
  const attemptNumber = priorAttempts + 1;
  const rewardEvents: RewardEvent[] = [];

  // honest_attempt +1: once per exercise, any attempt, correct or not (D-03 dedup).
  if (!alreadyGranted(rewardHistory, exerciseId, "honest_attempt")) {
    rewardEvents.push(makeEvent("honest_attempt", attemptNumber, { exerciseId }));
  }

  // first_try_correct vs correct_after_hint — mutually exclusive by priorAttempts branch.
  if (isCorrect && priorAttempts === 0) {
    if (!alreadyGranted(rewardHistory, exerciseId, "first_try_correct")) {
      rewardEvents.push(makeEvent("first_try_correct", attemptNumber, { exerciseId }));
    }
  } else if (isCorrect && priorAttempts > 0) {
    if (!alreadyGranted(rewardHistory, exerciseId, "correct_after_hint")) {
      rewardEvents.push(makeEvent("correct_after_hint", attemptNumber, { exerciseId }));
    }
  }

  // streak_bonus +10 (D-04, session-global, NOT deduped by exerciseId/reason).
  let nextCorrectStreak: number;
  if (isCorrect) {
    nextCorrectStreak = currentCorrectStreak + 1;
    if (nextCorrectStreak >= 5) {
      rewardEvents.push(makeEvent("streak_bonus", attemptNumber, {}));
      nextCorrectStreak = 0;
    }
  } else {
    nextCorrectStreak = 0;
  }

  // weak_topic_closed +15 (D-05) — fired directly off the FSM's entered_mastered
  // signal, never derived from a rewardHistory scan. CR-01: loop over ALL
  // mastered topics from this attempt (a single exercise's topicImpact can
  // cross the mastery threshold for more than one topic at once) and emit
  // one event per topic — never collapse to a single value.
  for (const topic of masteredTopics) {
    rewardEvents.push(makeEvent("weak_topic_closed", attemptNumber, { relatedTopic: topic }));
  }

  return { rewardEvents, nextCorrectStreak };
}
