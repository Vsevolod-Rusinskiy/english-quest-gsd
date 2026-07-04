# Milestones

## v1.0 MVP (Shipped: 2026-07-04)

**Phases completed:** 5 phases, 14 plans, 40 tasks

**Key accomplishments:**

- Theory-to-first-exercise walking skeleton on vanilla TypeScript + Vite + Zod: fail-loudly lesson validation, deterministic text-input checking, and synchronous localStorage persistence that survives a reload.
- Three pure deterministic checkers (option-id, pair-id-set, ordered-token equality) closing out CHECK-02 for all four exercise types, plus hand-authored Zod-valid fixtures for the two types Lesson-1A.json has zero real examples of.
- All 4 exercise-type renderers (text-input from Plan 01, plus single-choice/matching/order-builder built here) wired through an exhaustive `renderExercise` dispatcher into a `LessonEngine` that routes every type to its Plan 02 deterministic checker — proven end-to-end by a full 19-exercise traversal of the real `Lesson-1A.json`.
- Typed Zod schema extension (topicStats/rewardHistory/reviewQueue) plus two pure functions — nextTopicStatus() (D-06 FSM) and enqueueReviewItems() (D-02 scan) — with 27 new table-driven unit tests, zero new dependencies.
- Fixed-rule reward engine (computeRewardEvents, SPEC §10 amounts) and a single per-answer aggregator (evaluateAttempt) wired into LessonEngine.handleAnswer, so answering a real Lesson-1A exercise now updates topicStats, runs the topic-status FSM, populates reviewQueue, and appends a rewardHistory ledger entry — all folded into exactly one enriched exercise_attempt dispatch per answer.
- A distinct, resumable review pass appended after the main 19-exercise sequence — `LessonEngine.getCurrentExercise()` resolves main-vs-review position from a second cursor over the immutable `this.exercises` array, `main.ts` serves review items through the existing renderers unchanged, and a `reviewDequeueId` field folds queue removal into the same single `exercise_attempt` dispatch, closing PROGRESS-04 end to end.
- Shared `callAgent()` trust-boundary gateway (validate -> retry-once -> fallback) on `@anthropic-ai/sdk` against a third-party LLM router, with Answer Checker as the first live agent wired into an now-async `handleAnswer` pipeline.
- Second live agent (Theory Tutor) built on the unchanged Plan 01 gateway - a confused child tapping "Не понятно" now gets round 1 pre-written simplification, rounds 2-3 an agent-generated explanation, and a soft transition to practice at the 3-round cap, with the round count durably persisted and the fallback always re-serving (never fabricating) theory text.
- Reward Advisor agent (thin callAgent() wrapper reusing RewardReasonSchema) wired live into LessonEngine.handleAnswer, gated to one call per answer with a core-side cross-check that discards any praise text not matching an actually-granted reward reason.
- wordStats/exerciseTypeStats/currentErrorStreak schema extension, confidenceScore + difficultyGuardrails pure functions, and a thin Progress Advisor agent wrapper — all built and tested in isolation, no session-end orchestration wiring yet (Plan 03's scope).
- Parent Report Generator (5th and final agent) built as a thin `callAgent()` wrapper with a fully deterministic 6-field template fallback; `LessonEngine.handleSessionEnd()` sequentially resolves Progress Advisor -> guardrails -> Parent Report Generator into ONE `session_end` dispatch; the bare "Урок завершён!" message is replaced by an explicit "Показать итоги" button leading to a combined `SessionEndScreen`.
- Bright/blocky CSS token overhaul in style.css, two new shared components (ThinkingIndicator, RewardToast), a live ruble-balance top-bar chip, and both Phase-1-deferred D-12 bugs (stale feedback banner, progress-indicator overshoot) fixed in main.ts.
- Chunky/blocky CSS applied to all 4 exercise-type option/chip classNames and theory toggle buttons, plus 2 real gaps (missing praiseRu rendering, unstyled SessionEndScreen) found and fixed during the mandatory human-verify checkpoint's live browser walkthrough.
- Threaded Section-level instructionRu/instructionEn into all 4 exercise renderers via a new LessonEngine.getCurrentSection() resolver, closing the Phase 1-origin gap that left task cards English-prompt-only despite bilingual instruction data being schema-validated and populated since Phase 1.

---
