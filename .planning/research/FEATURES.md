# Feature Research

**Domain:** Kids' interactive language-learning / ed-tech practice app (single-lesson MVP)
**Researched:** 2026-07-01
**Confidence:** MEDIUM (ecosystem patterns are well-established and cross-corroborated across multiple products; specific numeric/UX choices for this project are project-defined in SPEC.md, not derived from external sources — flagged per item below)

## Context

This research targets a narrow slice: not "build a Duolingo," but "build the single-lesson skeleton that Duolingo, Prodigy, Khan Academy Kids, and DreamBox all share underneath their much larger content libraries." SPEC.md already fixes most implementation decisions (5 fixed agents, localStorage only, fixed reward table, 4 exercise types). This document validates those choices against the ecosystem and flags what's genuinely table stakes vs. differentiating vs. scope creep to avoid.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in *any* credible kids' learning-practice product. Missing these makes the product feel broken or like a static quiz, not a "learning app."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multiple exercise types in one lesson (multiple-choice, fill-in-text, matching, ordering) | Every reviewed product (Duolingo, Prodigy, Kahoot) mixes exercise formats within a session — a single-format quiz reads as a test, not a "quest." SPEC.md already commits to exactly these 4: `text-input`, `single-choice`, `matching`, `order-builder`. | MEDIUM | Rendering + validation logic differs per type; SPEC.md's `answerCheck` schema (`correctAnswers`/`acceptedAnswers` vs `pairs`) already unifies most of this. |
| Immediate feedback per answer (correct/incorrect + gentle retry) | Universal across all reviewed products — kids' apps never batch-grade at the end. Delayed feedback breaks the loop that makes the format feel like a game rather than a worksheet. | LOW | SPEC.md §15 already specifies "верно (зелёное + рубли), ошибка (спокойная подсказка + «попробуй ещё»)". |
| Visible progress-through-lesson indicator (e.g., "task 5 of 19") | Standard in every gamified learning UI — reduces anxiety ("how much is left") and is core to the game-like feel. Confirmed across Duolingo lesson bars and Kahoot's live progress. | LOW | Already in SPEC.md top panel spec. |
| Non-punitive treatment of mistakes (hint, retry, no penalty) | Cross-product pattern for kids specifically: Prodigy's cosmetic-only monetization and Duolingo's streak-freeze both exist to keep failure low-stakes. A kids' app that punishes wrong answers (docking currency, harsh visuals) reliably produces disengagement in this age group. | LOW | SPEC.md explicitly states "Ошибка не наказывается" (§10) and rewards `fixed_mistake` — already aligned. |
| Persistent progress across sessions (doesn't reset on reload/close) | Table stakes for *any* app with a concept of "progress" — a session that resets on refresh feels broken, not like a lightweight MVP. | LOW–MEDIUM | SPEC.md commits to `localStorage` single-key persistence — sufficient for single-device MVP; explicitly out of scope: multi-device sync. |
| Some form of reward/points for effort, not just correctness | Confirmed across every reviewed kids' product (Duolingo XP, Prodigy coins, Kahoot points) — a practice app with literally zero positive-feedback economy underperforms on engagement even among adults, and children's ed-tech treats this as baseline, not differentiator. | MEDIUM | SPEC.md's fixed reward table (`honest_attempt`, `first_try_correct`, etc.) matches this pattern closely — see Differentiators below for what makes it more than generic points. |
| Basic mistake-driven review within the same or a following session | Table stakes at the "review queue" level, though *sophisticated* spaced-repetition scheduling (see below) is not — every product studied resurfaces recently-missed items rather than only reviewing on a fixed external calendar. | MEDIUM | SPEC.md's 2-error threshold → `reviewQueue` is a reasonable, simple table-stakes implementation, not full SRS (see Anti-Features). |
| A short, simple explanation step before practice (theory/rule + example) | Common baseline in structured lesson apps (as opposed to flashcard-only apps) — kids need the rule stated once before drilling it, otherwise exercises feel arbitrary. | LOW–MEDIUM | SPEC.md's theory step with "understood / not understood" + simplify rounds is already scoped correctly as table stakes, not a differentiator. |

### Differentiators (Competitive Advantage)

Features that go beyond the baseline and specifically match this project's Core Value ("проверить механику обучения целиком... без единого «сломанного» состояния, даже если агент недоступен").

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| LLM-assisted fuzzy answer checking with typed error classification (typo / wrong tense / missing article / etc.) | Most reviewed products either do exact-match text input (Duolingo) or avoid free-text entirely, using tap-to-select word banks to sidestep the fuzzy-matching problem. A genuinely open free-text answer with typed error diagnosis (not just right/wrong) is materially richer feedback than table-stakes apps typically offer at this budget/scope. Confirms this is a real differentiator, not something "everyone already does." | HIGH | SPEC.md's `Answer Checker` agent + deterministic fallback (exact-match) is the correct shape: cheap path first, agent only for ambiguous cases. This is the single highest-value, highest-risk feature in the MVP. |
| Deterministic core + agent-as-advisor architecture with mandatory fallback for every agent | Ecosystem products rarely expose *why* a number changed or guarantee the app can't break if a backend call fails — most commercial apps simply have a live backend and don't need to reason about "agent unavailable." This project's constraint (fully client-side, LLM optional per-call) is unusual and is a genuine architectural differentiator worth highlighting, not something copied from a competitor. | HIGH | This is the project's stated secondary goal (diploma architecture practice) — treat as first-class differentiator, not incidental. |
| Personalized next-focus + difficulty suggestion from an LLM advisor, gated by deterministic guardrails | Adaptive difficulty exists in commercial products (Prodigy adjusts math difficulty via its own algorithm) but is normally a black-box in-house algorithm. Here it's explicit and inspectable: Progress Advisor *suggests*, core enforces guardrails (no easy→challenge jump, direction change only between lessons). This transparency/predictability is a differentiator for the "practice the architecture" goal even though the end-user-visible effect (adaptive difficulty) is table stakes elsewhere. | MEDIUM | Note: the *user-facing outcome* (personalization) is closer to table-stakes-adjacent in the broader market; what differentiates is the guardrail design. |
| Reward reasons tied to honest effort and mistake-correction, not just streaks/speed | Directly addresses the #1 pitfall identified in gamification research: rewarding activity/speed over genuine understanding. Fixed reward causes (`honest_attempt`, `fixed_mistake`, `correct_after_hint`) are a deliberate anti-pattern-avoidance choice that most commercial apps don't bother making explicit. | LOW–MEDIUM | Already fully specified in SPEC.md §10; flag this in the roadmap as a selling point of the reward system, not just an implementation detail. |
| Short LLM-generated (with template fallback) parent report after each lesson | Parent dashboards researched (Khan Academy, DreamBox, SplashLearn) show cumulative multi-session stats via persistent dashboards — a *narrative, single-lesson* report generated per session is lighter-weight and more digestible for a single-lesson MVP context than a full dashboard, and is unusual among the products studied (most show numbers/charts, not prose). | MEDIUM | SPEC.md's fallback-template design is the right MVP posture — don't over-invest in the LLM path since template fallback covers the acceptance criteria. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good, are common in mature products, but would be scope creep or actively harmful for this single-lesson MVP.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Full spaced-repetition scheduling engine (SM-2/FSRS-style intervals, multi-day review calendar) | Ecosystem research shows this is the gold standard for retention in mature apps (Lingvist, Anki-likes) and is the "obvious" way to do "review weak topics." | Requires multi-day usage data the MVP will never generate (single lesson, single session validated), and adds a scheduling subsystem disproportionate to a 19-exercise lesson. SPEC.md already correctly scopes this out — review queue is same-session, threshold-based, not calendar-based. | Keep the simple 2-error → `reviewQueue` + same-session retry model already in SPEC.md. Revisit true SRS only if/when multi-lesson, multi-day usage becomes the validated pattern. |
| Avatar customization / cosmetic shop for spent currency | Directly modeled after Prodigy's most visible differentiator and generally correlated with retention in the reward research. | SPEC.md explicitly places this out of scope (post-MVP) — building a shop UI, inventory model, and cosmetic asset pipeline is unrelated to validating the answer-checking/progress/reward *mechanics*, which is the stated Core Value. Currency with nowhere to spend is fine for an MVP whose goal is mechanic validation, not retention optimization. | Track `currentRewards` balance and `rewardHistory` ledger now (already spec'd); defer the spend/shop loop entirely to post-MVP. |
| Leaderboards / social competition / leagues | Confirmed as a major Duolingo engagement driver (weekly leagues, 10 tiers). | Requires multiple concurrent users and a backend/sync layer — directly conflicts with the project's `localStorage`-only, single-student (`studentId: primary`), no-backend constraints. Also generally inappropriate for a single child working alone on one lesson. | None needed for MVP; if ever revisited, would require the backend + multi-student work already explicitly out of scope. |
| Streak mechanic (daily login streak + streak freeze) | The single most iconic Duolingo gamification feature; "obviously" the app should have one. | Streaks require multi-day return-visit tracking, which a single-lesson MVP acceptance criteria (§18 in SPEC.md) never exercises — building it produces UI and state with no way to validate it in this milestone, and research also flags streak mechanics as a source of kid anxiety around missed days (mitigated by streak-freeze in mature products, which is extra complexity this MVP shouldn't take on). | The existing "серия из 5" (in-session streak_bonus) captures the motivational core of streaks without the multi-day tracking/anxiety surface. Defer daily streaks to post-MVP if multi-lesson usage is validated. |
| AI-generated new exercises / dynamic content generation | Natural extension once an LLM is already in the loop for answer checking — "why not have it generate more practice?" | SPEC.md explicitly scopes this out (Exercise Generator is post-MVP) for good reason: generated exercises need their own answer-key/acceptedAnswers authoring and quality control, which is a different (and much larger) problem than checking answers to *pre-authored* content. Conflating the two risks destabilizing the answer-checking mechanic this MVP is meant to validate. | Keep all lesson content in the pre-authored `Lesson-1A.json`; revisit generation only after the checking/progress/reward loop is validated on fixed content. |
| Rich parent analytics dashboard (charts, multi-lesson trends, mastery heatmaps) | Directly modeled on Khan Academy / DreamBox / SplashLearn dashboards found in research — feels like the "professional" version of a parent report. | Requires multi-lesson history to be meaningful; with one lesson, a dashboard would show a single data point dressed up as a chart — misleading and wasted effort. SPEC.md's scope (one short text report per lesson) is correctly sized. | Ship the single-lesson narrative report now (already spec'd); if multi-lesson usage is validated, aggregate `lessonHistory` into a real dashboard later. |
| Voice/speech exercises, listening/reading as separate modes | Common in mature language apps (Duolingo speaking exercises, listening comprehension) and often requested as "the next obvious skill type." | Explicitly out of scope per PROJECT.md/SPEC.md — introduces microphone permissions, audio asset pipeline, and speech-recognition accuracy problems orthogonal to the text-based mechanic validation this MVP targets. | Text-based exercise types only (`text-input`, `single-choice`, `matching`, `order-builder`) for MVP; audio is a distinct milestone. |
| Adult/teacher content-approval workflow before a lesson is shown to the child | Common in classroom-oriented products (Kahoot, Prodigy classroom mode) where a teacher curates/approves content. | `requiresAdultApproval: false` is already fixed in PROJECT.md for MVP — content is a single hand-authored lesson file, so an approval workflow has no real gatekeeping function yet and would only add UI with no content pipeline behind it. | Revisit if/when a content-authoring or multi-lesson pipeline exists that actually needs a review gate. |

## Feature Dependencies

```
Theory step (rule + "understood/not understood")
    └──precedes──> Exercise loop (4 exercise types)

Exercise loop (4 exercise types)
    └──requires──> Deterministic answer checking (normalize + exact/pairs/order compare)
                       └──gap-filled-by──> Answer Checker agent (ambiguous text-input only)
                                              └──requires-fallback──> strict-compare fallback (errorType: unknown)

Deterministic answer checking
    └──feeds──> topicStats / wordStats / exerciseTypeStats counters
                       └──feeds──> Topic status thresholds (Не изучено→В процессе→Повторить→Выучено)
                                      └──feeds──> reviewQueue (2+ errors on a topic)
                                                     └──enables──> Same-session review pass

topicStats / wordStats / exerciseTypeStats
    └──feeds──> Progress Advisor (next focus, difficulty, session advice)
                       └──gated-by──> difficultyMode guardrails (no easy→challenge jump; change only between lessons)

Exercise result (per attempt)
    └──feeds──> Reward Advisor (suggests reasons/praise text)
                       └──verified-and-applied-by──> Core reward engine (fixed amounts/limits, rewardHistory ledger)

Full lesson snapshot (results + weak topics + rewards + recommendation)
    └──feeds──> Parent Report Generator
                       └──has-fallback──> Template report (same fields, no LLM)

localStorage persistence (single key, single studentProfile)
    └──underlies──> ALL of the above (everything is inert without persisted state surviving reload)

Avatar/shop, leaderboards, streak-freeze, SRS scheduling, exercise generation
    └──excluded-from-MVP, all would require──> backend and/or multi-session data this MVP doesn't produce
```

### Dependency Notes

- **Exercise loop requires deterministic answer checking, not the reverse:** normalization/exact-compare must exist and work standalone (per SPEC.md §9 step 3) before the Answer Checker agent is layered on for the ambiguous `text-input` remainder — the agent is a gap-filler for cases the deterministic path can't resolve, not the primary path. This ordering matters for phase sequencing: build and verify exact-match checking before wiring the agent.
- **reviewQueue depends on topic-status thresholds, which depend on per-attempt counters:** you cannot build a working review queue before the counters (`topicStats`) and the 2-error threshold rule exist — this is a strict build-order dependency, not parallelizable.
- **Progress Advisor's suggestions are gated by deterministic guardrails that must exist independently:** the "no easy→challenge jump" and "change only between lessons" rules are core-owned logic that must exist and be enforced *before* the advisor's suggestions can be safely applied — otherwise a bad/hallucinated agent output could whipsaw difficulty. Build guardrails first, wire the advisor second.
- **Reward Advisor enhances but does not gate the reward engine:** per SPEC.md, the core can apply reward rules with zero agent input (pure fallback) — the agent only adds praise text and reason suggestions the core still verifies. This means the reward *engine* can be built and fully tested before the agent integration exists at all.
- **Parent Report Generator conflicts with (is deliberately smaller than) a multi-lesson dashboard:** don't let "parent-facing feature" scope creep from a single templated report into a persistent dashboard — the single-lesson data model doesn't support a meaningful dashboard yet (see Anti-Features).
- **Streak/leaderboard/shop features all conflict with the no-backend, single-student, single-session-validated constraint:** any attempt to add them mid-MVP will pull in multi-day state tracking or multi-user sync that the current architecture doesn't support — treat any request for these as a signal to defer, not to lightly extend the current model.

## MVP Definition

This mirrors PROJECT.md's Active requirements — restated here through a features lens to confirm nothing is missing and nothing extra has crept in.

### Launch With (v1) — matches PROJECT.md Active requirements exactly

- [ ] Theory step (rule + example, understood/not-understood, capped simplify rounds via Theory Tutor + fallback) — table stakes, precedes all exercises
- [ ] 4 exercise types rendered from `Lesson-1A.json` (`text-input`, `single-choice`, `matching`, `order-builder`) — table stakes
- [ ] Deterministic normalize + exact-compare for `text-input`, with Answer Checker agent + fallback for ambiguous cases — differentiator, core mechanic under test
- [ ] Attempt/correct/error/streak counters + topic status thresholds — table stakes, feeds everything downstream
- [ ] Same-session `reviewQueue` for 2+-error topics — table stakes (simple version, not full SRS)
- [ ] Fixed-amount reward engine with ledger (`rewardHistory`) + Reward Advisor (reasons/praise) with fallback — differentiator (honest-effort-weighted rewards)
- [ ] Progress Advisor (next focus/difficulty/session advice) gated by core guardrails, with fallback — differentiator
- [ ] Parent Report Generator (short narrative) with template fallback — differentiator, appropriately scoped down from a full dashboard
- [ ] `localStorage` persistence across reload, single key — table stakes
- [ ] Fallback-on-failure for all 5 agents (1 retry, then deterministic fallback) — differentiator, core architectural goal
- [ ] Kid-friendly visual style (blocky, bright, rounded, Roblox-inspired) — table stakes for the target age group

### Add After Validation (v1.x)

- [ ] Multi-lesson content pipeline (beyond hand-authored `Lesson-1A.json`) — trigger: mechanic validated on lesson 1, need more content to keep testing
- [ ] Simple cross-lesson `lessonHistory` trend view for parents (still short, not a full dashboard) — trigger: 2+ lessons exist, single-lesson report starts feeling thin
- [ ] Daily-streak-lite (in-app-only, no push notifications) — trigger: multi-day usage pattern actually emerges in testing
- [ ] Adult content-approval toggle — trigger: content pipeline exists that needs gatekeeping

### Future Consideration (v2+)

- [ ] Full spaced-repetition scheduling (multi-day intervals) — defer until multi-day, multi-lesson retention is actually being measured; premature before that
- [ ] Avatar/cosmetic shop spending `currentRewards` — defer until retention/motivation optimization (not mechanic validation) becomes the goal
- [ ] Exercise Generator agent (dynamic content) — defer until the checking/progress/reward loop is proven stable on fixed content; generating content is a materially larger problem
- [ ] Multiple student profiles / accounts — defer until backend or a real multi-user need exists
- [ ] Voice/speaking/listening modes — defer to a distinct milestone; different technical surface entirely
- [ ] Backend + sync (enables leaderboards, multi-device, teacher/classroom features) — defer indefinitely unless the product direction changes from single-child local MVP

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 4 exercise types + deterministic checking | HIGH | MEDIUM | P1 |
| Answer Checker agent + fallback | HIGH | HIGH | P1 |
| topicStats/wordStats counters + status thresholds | HIGH | MEDIUM | P1 |
| Same-session reviewQueue | HIGH | MEDIUM | P1 |
| Fixed reward engine + ledger | HIGH | LOW–MEDIUM | P1 |
| Reward Advisor agent + fallback | MEDIUM | MEDIUM | P1 |
| Progress Advisor agent + guardrails | MEDIUM | MEDIUM | P1 |
| Theory step + Theory Tutor agent | MEDIUM | MEDIUM | P1 |
| Parent Report Generator + template fallback | MEDIUM | MEDIUM | P1 |
| localStorage persistence | HIGH | LOW | P1 |
| Agent fallback/retry framework | HIGH (architectural goal) | MEDIUM | P1 |
| Kid-friendly visual style | HIGH | LOW–MEDIUM | P1 |
| Multi-lesson content pipeline | MEDIUM | HIGH | P2 |
| Cross-lesson parent trend view | LOW–MEDIUM | MEDIUM | P2 |
| Daily-streak-lite | LOW | LOW–MEDIUM | P3 |
| Full SRS scheduling | MEDIUM (long-term) | HIGH | P3 |
| Avatar/cosmetic shop | LOW (for this milestone's goal) | MEDIUM–HIGH | P3 |
| Exercise Generator agent | MEDIUM (long-term) | HIGH | P3 |
| Voice/speaking modes | LOW (for this milestone's goal) | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (= PROJECT.md Active requirements, all already scoped correctly)
- P2: Should have, add when possible (early post-MVP)
- P3: Nice to have, future consideration (explicitly out of scope per PROJECT.md)

## Competitor Feature Analysis

| Feature | Duolingo | Prodigy Math | Khan Academy Kids / DreamBox (parent dashboard) | Our Approach |
|---------|----------|--------------|--------------------------------------------------|--------------|
| Exercise variety | Matching, drills, multiple choice, contextual stories | RPG battles gate math problems (mostly multiple choice/numeric input) | Varied by subject; mastery-tracked | 4 fixed types from pre-authored lesson JSON; no RPG wrapper, no story mode |
| Currency / rewards | XP + gems (minor) + lingots (milestone), spent on streak freezes/bonus content | Coins/spells earned per correct answer, spent on cosmetics only (never affects difficulty) | N/A (no in-app economy; dashboard-only) | Fixed-cause "рубли" ledger (honest attempt, first-try, hint-recovery, streak, weak-topic-closed); no spend loop in MVP — reward is proof-of-mechanic, not a retention lever yet |
| Adaptive difficulty | Algorithmic, mostly opaque to user | Proprietary in-house algorithm adjusts problem difficulty | N/A | Explicit, inspectable: LLM *suggests* focus/difficulty, deterministic core enforces guardrails (no big jumps, change only between lessons) — more transparent than either competitor by design |
| Weak-area review | Implicit via SRS-like review lessons over time | Adaptive difficulty implicitly re-serves weak areas | Color-coded mastery bands surfaced to parent, not necessarily re-served to child same-session | Explicit same-session `reviewQueue` triggered at 2+ errors on a topic — simpler and faster-feedback than calendar-based SRS, appropriate for single-lesson MVP |
| Free-text answer checking | Avoids most fuzzy text input (word-bank taps for many exercise types); exact-match where free text exists | Numeric/multiple-choice, avoids open text almost entirely | N/A | Open free-text with normalize+exact-match first, LLM Answer Checker + typed `errorType` for ambiguous cases, hard fallback to strict compare — more ambitious than either competitor's text-input handling |
| Parent-facing output | None (child-focused product) | Limited parent view of progress | Persistent multi-session dashboard (mastery %, time-on-task, discussion prompts) | Single-lesson narrative report (what was done, what's weak, rubles earned, one recommendation) with template fallback — deliberately lighter than a dashboard, appropriately sized to single-lesson MVP data |
| Resilience to backend/AI failure | N/A (live backend assumed always available) | N/A (live backend assumed always available) | N/A | Every agent has mandatory deterministic fallback; app never blocks or breaks on LLM failure — this is the project's own architectural differentiator, not found as an explicit design goal in any product researched |

## Sources

- [Duolingo gamification explained — StriveCloud](https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo)
- [How to Use Duolingo for Language Learning — Duolingo Blog](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/)
- [Is Duolingo Good for Kids? — Screenwise](https://screenwiseapp.com/guides/duolingo-and-language-learning-apps-for-kids)
- [Spaced Repetition Language Learning: The Ultimate Guide — PolyChat Blog](https://www.polychatapp.com/blog/spaced-repetition-language-learning)
- [Spaced Repetition App Guide — Make Headway](https://makeheadway.com/blog/spaced-repetition-app/)
- [Gamification in Learning Apps: Strategies & Benefits — Aimprosoft](https://www.aimprosoft.com/blog/gamification-in-learning-apps/)
- [The Promise and Pitfalls of Gamified Learning — School Principals 411](https://schoolprincipals.industry411.com/2026/06/30/the-promise-and-pitfalls-of-gamified-learning/)
- [Strategic Gamification in EdTech Products — Openfield](https://openfieldx.com/motivational-design-edtech-gamification/)
- [How can parents track the child's progress — SplashLearn Support](https://support.splashlearn.com/hc/en-us/articles/12275144246546-How-can-parents-track-the-child-s-progress-or-view-the-report)
- [Khan Academy Parent Dashboard — Khan Academy Help Center](https://support.khanacademy.org/hc/en-us/articles/360039664491-What-can-I-do-from-the-Khan-Academy-Parent-Dashboard)
- [Insights to Understand Your Child's Math Growth — DreamBox](https://www.dreambox.com/family/parent-dashboard)
- [There's more to fuzzy search than correcting typos — Algolia](https://www.algolia.com/blog/engineering/fuzzy-search-101)
- [Typo tolerance — Algolia docs](https://www.algolia.com/doc/guides/managing-results/optimize-results/typo-tolerance)
- [Prodigy Math — official site](https://www.prodigygame.com/main-en)
- [Prodigy: Kids Math Game App Review — Common Sense Media](https://www.commonsensemedia.org/app-reviews/prodigy-kids-math-game)
- [Top 10 gamification apps for education in 2026 — Jotform Blog](https://www.jotform.com/blog/gamification-apps-for-education/)
- Project's own `SPEC.md` and `PROJECT.md` (used as the ground truth for what is already committed vs. what this research validates or flags)

---
*Feature research for: kids' interactive language-learning practice app (single-lesson MVP)*
*Researched: 2026-07-01*
