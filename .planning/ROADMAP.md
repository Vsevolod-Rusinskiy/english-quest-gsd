# Roadmap: English Quest

## Overview

English Quest ships as five phases that build strictly bottom-up: a deterministic core that can run the entire lesson (theory shell, all 4 exercise types, exact-match checking, persistence) with zero AI dependency; then the progress/review/reward rule engine that must be fully guardrailed before any agent can influence it; then the shared Agent Gateway trust boundary wired to the two highest-frequency agents (Answer Checker, Theory Tutor); then the three session/lesson-end agents (Progress Advisor, Reward Advisor, Parent Report Generator) that reuse the same gateway; and finally the kid-friendly Roblox-inspired visual polish layer on top of a data flow that is already fully correct. Every phase after Phase 1 is independently verifiable without a live LLM call, because each one's deterministic fallback path is a first-class deliverable, not an afterthought.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Deterministic Core, Lesson Rendering & Persistence** - Child can complete the full lesson (theory + all 4 exercise types) with exact-match answer checking, and progress survives a page reload (completed 2026-07-02)
- [x] **Phase 2: Progress Tracking, Review Queue & Reward Engine** - Core tracks topic mastery, queues weak topics for same-session review, and awards/ledgers rubles by fixed rules, with no agent involved (completed 2026-07-02)
- [x] **Phase 3: Agent Gateway, Answer Checker & Theory Tutor** - Ambiguous text answers get LLM-assisted checking with typed errors, and confused kids get a simpler explanation, both through one shared trust boundary with automatic fallback (completed 2026-07-03)
- [ ] **Phase 4: Progress Advisor, Reward Advisor & Parent Report** - Session-end personalization, reward praise text, and the parent report all work through the same gateway with core-enforced guardrails and template fallback
- [ ] **Phase 5: Kid-Friendly Visual Design** - The lesson experience looks and feels like a bright, blocky, Roblox-inspired kids' app

## Phase Details

### Phase 1: Deterministic Core, Lesson Rendering & Persistence

**Goal**: Child can complete the full lesson (theory + all 4 exercise types) end-to-end using only deterministic logic, and progress survives a page reload
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: THEORY-01, THEORY-02, EXERCISE-01, EXERCISE-02, EXERCISE-03, EXERCISE-04, EXERCISE-05, CHECK-01, CHECK-02, PERSIST-01, PERSIST-02
**Success Criteria** (what must be TRUE):

  1. Child sees the theory block (rule + example) before the first exercise and can mark it "понятно" or "не понятно"
  2. Child can complete all 19 exercises across the 4 types in `Lesson-1A.json` (`text-input`, `single-choice`, `matching`, `order-builder`) and sees "задание N из 19" progress at every step
  3. Text-input answers that exactly match `acceptedAnswers` (after case/whitespace/punctuation normalization) are marked correct without any network call; single-choice/matching/order-builder are graded purely by deterministic comparison
  4. Reloading the browser mid-lesson restores exactly where the child left off, reading from the single `english-quest-progress-v1` localStorage key

**Plans**: 3/3 plans complete
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: scaffold + theory + first text-input exercise + versioned persistence + reload-resume (THEORY-01/02, EXERCISE-01/05, CHECK-01, PERSIST-01/02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Deterministic checkers for single-choice/matching/order-builder + hand-authored fixtures (EXERCISE-02/03/04, CHECK-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Remaining exercise renderers + full 19-exercise lesson traversal (EXERCISE-02/03/04/05, CHECK-02)

### Phase 2: Progress Tracking, Review Queue & Reward Engine

**Goal**: Core tracks per-topic mastery, surfaces weak topics for same-session review, and pays out rubles by fixed, ledgered rules — entirely without agent involvement
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PROGRESS-01, PROGRESS-02, PROGRESS-03, PROGRESS-04, REWARD-01, REWARD-02
**Success Criteria** (what must be TRUE):

  1. Every exercise attempt updates per-exercise/topic counters (attempts, correct, errors, streaks) that a developer can inspect in state
  2. A topic that accumulates 2+ errors flips to "Повторить" status and its exercises appear in `reviewQueue`; other topics move through Не изучено → В процессе → Выучено by the same threshold rules
  3. Child can open and complete `reviewQueue` items within the same session, and completing them updates topic status
  4. Rubles are awarded only for the fixed reasons (`honest_attempt`, `first_try_correct`, `correct_after_hint`, `fixed_mistake`, `streak_bonus`, `weak_topic_closed`), each capped per exercise, and every award appears as an entry in `rewardHistory` with reason/amount/attemptNumber/timestamp

**Plans**: 3/3 plans complete
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Typed schema + topic-status FSM + reviewQueue population scan (PROGRESS-01/02/03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Reward engine + evaluateAttempt aggregator wired into handleAnswer via one dispatch (REWARD-01/02, completes PROGRESS-01/02/03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Review-pass cursor + UI wiring so the child completes reviewQueue items in-session (PROGRESS-04)

### Phase 3: Agent Gateway, Answer Checker & Theory Tutor

**Goal**: Ambiguous text-input answers get LLM-assisted checking with a typed error, and a confused child gets a simpler theory explanation — both routed through one shared, validated trust boundary that never breaks the lesson when the agent is unavailable
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: CHECK-03, CHECK-04, THEORY-03, RELY-01, RELY-02, RELY-03
**Success Criteria** (what must be TRUE):

  1. A text-input answer with no exact match triggers a call to the Answer Checker agent, and the child sees a verdict plus a typed `errorType` (not just right/wrong)
  2. Marking theory "не понятно" gets the child a simpler explanation from the Theory Tutor, capped at `maxSimplifyRounds`, after which the lesson moves on to practice regardless
  3. Killing/timing out/corrupting either agent's response results in exactly one retry, then a deterministic fallback (strict comparison with `errorType: unknown` for Answer Checker; a pre-written simpler explanation for Theory Tutor) — the lesson never stalls or crashes
  4. No agent JSON response is used to update state unless it first passes one shared schema+semantic validation function (same function for both agents), and every such event records whether the data came from `core` or `agent` plus whether a fallback fired

**Plans**: 2/2 plans complete
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Agent Gateway + Answer Checker vertical slice: shared callAgent() (validate→retry-once→fallback), Anthropic client, async handleAnswer, source/agentFailed event logging (CHECK-03/04, RELY-01/02/03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Theory Tutor vertical slice: simplifyRoundCount schema, D-11 round sequencing (round 1 core-only, rounds 2-3 agent, cap→soft transition), round-aware TheoryScreen, reusing the Wave 1 gateway (THEORY-03, RELY-01/02/03)

### Phase 4: Progress Advisor, Reward Advisor & Parent Report

**Goal**: Session/lesson-end personalization, reward praise text, and the parent-facing report are all agent-assisted but core-verified, each with a deterministic fallback that produces a usable result on its own
**Mode:** mvp
**Depends on**: Phase 2, Phase 3
**Requirements**: PERSONAL-01, PERSONAL-02, PERSONAL-03, REWARD-03, REWARD-04, REPORT-01, REPORT-02
**Success Criteria** (what must be TRUE):

  1. At session end, the child gets a suggested next focus, difficulty (easy/normal/challenge), and a wrap-up tip derived from `topicStats`/`wordStats`/`exerciseTypeStats`, but the actual difficulty applied always obeys core guardrails (no easy→challenge jump, changes only between lessons, up only after 3 correct in a row, down only after 2 errors) regardless of what the agent suggested
  2. If the Progress Advisor is unavailable, the session still ends with a valid next-focus/difficulty decision driven purely by threshold rules
  3. Reward events still get correct fixed amounts even when the Reward Advisor is down; when it's up, its suggested reason/praise text is only used if it matches a reward the core already decided to grant
  4. After the lesson, the parent sees a short report (exercises completed, correct count, struggling topics, review topics, rubles earned, one recommendation); if Parent Report Generator is unavailable, the same fields render via a template with no agent text

**Plans**: 2/3 plans executed
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Reward Advisor: live per-answer agent call folded into the existing exercise_attempt dispatch, cross-checked against already-granted reward reasons (REWARD-03/04)

**Wave 2** *(blocked on Wave 1 completion — shares store.ts/lessonEngine.ts)*

- [x] 04-02-PLAN.md — Personalization foundation: wordStats/exerciseTypeStats/currentErrorStreak schema, confidenceScore + difficultyGuardrails pure functions, Progress Advisor agent (PERSONAL-01/02/03)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 04-03-PLAN.md — Parent Report Generator + LessonEngine.handleSessionEnd() sequential orchestration + combined SessionEndScreen replacing "Урок завершён!" (PERSONAL-01/02/03, REPORT-01/02)

### Phase 5: Kid-Friendly Visual Design

**Goal**: The lesson experience looks and feels like a bright, blocky, Roblox-inspired kids' app across theory, exercises, rewards, and the parent report
**Mode:** mvp
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4
**Requirements**: UI-01, UI-02
**Success Criteria** (what must be TRUE):

  1. Every screen in the lesson (theory, all 4 exercise types, review, reward, parent report) uses a consistent childish, blocky, brightly colored visual style with large rounded buttons, with no Roblox branding, logos, or assets
  2. The lesson screen shows a top bar (lesson name, ruble balance, progress) at all times, plus a lesson title and a task card with RU+EN instructions for every exercise
  3. Waiting states for any agent call (Answer Checker, Theory Tutor, Progress Advisor, Reward Advisor, Parent Report Generator) show a calm, on-brand "thinking" indicator rather than a blank screen or generic spinner
  4. Wrong answers are presented with a non-punitive, encouraging tone consistent with the rest of the visual style

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Deterministic Core, Lesson Rendering & Persistence | 3/3 | Complete    | 2026-07-02 |
| 2. Progress Tracking, Review Queue & Reward Engine | 3/3 | Complete    | 2026-07-02 |
| 3. Agent Gateway, Answer Checker & Theory Tutor | 2/2 | Complete    | 2026-07-03 |
| 4. Progress Advisor, Reward Advisor & Parent Report | 2/3 | In Progress|  |
| 5. Kid-Friendly Visual Design | 0/TBD | Not started | - |
