---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 0
status: Awaiting next milestone
stopped_at: "Completed quick task 260707-pu4 (top-bar two-row layout fix)"
last_updated: "2026-07-07T15:45:00.000Z"
last_activity: 2026-07-07
last_activity_desc: "Quick task 260707-pu4: fixed a top-bar layout regression found live-testing 260707-krq — the progress bar was rendering with zero visible width and the 6-element top-bar was cramped; restructured into two rows (identity/reward row + progress row) and hid the topic-mastery summary at 0 topics tracked"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
current_phase_name: kid-friendly-visual-design
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** Проверить механику обучения целиком: детерминированная проверка ответов + LLM-агенты там, где нужна интерпретация, персонализация по прогрессу, повторение слабых тем, начисление бонусов — без единого «сломанного» состояния, даже если агент недоступен.
**Current focus:** Planning next milestone (v1.0 shipped 2026-07-04)

## Current Position

Phase: Milestone v1.0 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-07-04 — Milestone v1.0 completed and archived

## Performance Metrics

**Velocity:**

- Total plans completed: 14
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | - | - |
| 2 | 3 | - | - |
| 03 | 2 | - | - |
| 04 | 3 | - | - |
| 05 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 03 P02 | 22min | 3 tasks | 16 files |
| Phase 04 P01 | 10min | 2 tasks | 9 files |
| Phase 04 P03 | 35min | 3 tasks | 8 files |
| Phase 05 P01 | 12min | 2 tasks | 9 files |
| Phase 05 P02 | 22min | 3 tasks | 7 files |
| Phase 05 P03 | 25min | 2 tasks | 9 files |
| Phase 260707-krq P01 | 9min | 5 tasks | 15 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Core/Roadmap: Hybrid architecture — deterministic core owns all numbers/state writes, exactly 5 agent-functions (Answer Checker, Theory Tutor, Progress Advisor, Reward Advisor, Parent Report Generator) propose only, each with mandatory deterministic fallback
- Roadmap: Agent Gateway built once as a shared trust boundary (Phase 3), reused by all 5 agents rather than reimplemented per agent
- Roadmap: Progress/Review/Reward rule engine (Phase 2) built and guardrailed before any agent is wired in, so agent output can never bypass core thresholds
- Roadmap: UI polish deliberately last (Phase 5) — renderers are stateless and depend only on the finalized state shape from Phases 1-4
- [Phase ?]: Theory Tutor reuses the Plan 01 Agent Gateway unchanged - a second, differently-shaped agent contract on the same callAgent<T>() proves D-05's shared-gateway design generalizes
- [Phase ?]: Theory Tutor's fallback re-serves the caller-supplied fallbackLevel verbatim on agent failure, never fabricating new simplified text (D-11)
- [Phase ?]: praiseRu returned transiently from handleAnswer (never dispatched/persisted), matching D-04/A3's transient-display-text framing
- [Phase ?]: Reward Advisor cross-check gate implemented as Set intersection against granted rewardEvents, discarding ungranted suggestions identically to an agent failure (REWARD-03)
- [Phase ?]: handleSessionEnd() sequentially resolves Progress Advisor -> guardrails -> Parent Report Generator into ONE session_end dispatch, never Promise.all (D-06/D-07)
- [Phase ?]: Fixed a plan-authored guardrail test premise inconsistent with Plan 02's already-tested contract: insufficient-signal case correctly stays unchanged, not normal
- [Phase ?]: D-12 Gap 1's actual leak point is the lesson-complete branch's feedbackAppliesHere check (reviewQueue.length === 0 permanently true post-completion), not the main-pass advance render — fixed by nulling feedback right after the render() call that legitimately shows it
- [Phase ?]: Reward-toast trigger uses a before/after state.currentRewards diff around handleAnswer(), per 05-PATTERNS.md's correction to RESEARCH.md's Assumption A1 (HandleAnswerResult has no rewardAmount field)
- [Phase ?]: Theory toggle buttons get a dedicated .theory-toggle className, keeping the CTA-only 52px/shadow treatment isolated to submit-row/show-results/continue buttons
- [Phase ?]: During Task 3's mandatory human-verify checkpoint (live browser walkthrough), 2 real gaps were found and fixed in-flight: Reward Advisor's praiseRu was computed/cross-checked but never rendered anywhere in the UI (wired into FeedbackBanner), and SessionEndScreen had zero visual treatment (added .child-section/.parent-section card styling)
- [Phase ?]: Chip/option unselected-state styling (.option/.match-left/.match-right/.bank-chip/.sequence-chip) is CSS-only - no exercise-renderer TS changes needed since selection/pairing already applies Plan 01's shared button.accent/.selected rule
- [Phase ?]: 05-03: getCurrentSection() built as a thin wrapper on getCurrentExerciseId(), keeping exactly one place that resolves current-exercise identity across main/review pass
- [Phase ?]: 260707-krq: Agent hintRu dropped entirely from the feedback banner (not kept as a secondary line); authored escalating hint (firstError/secondError) is now the sole hint shown — CONTEXT.md #3 explicitly recommended dropping the agent hint as cleanest, since the original live-test issue was a confusing agent hint replacing the reliable authored one
- [Phase ?]: 260707-krq: All text-input exercises (single AND multi-blank) now render inline blanks (blankCount >= 1), unifying the previously-inconsistent single-blank separate-box layout — Live-testing on ex005 found the old single-blank layout jarring next to the already-inline multi-blank exercises

### Pending Todos

- [UX finding, 2026-07-06, manual test] Theory screen "Не понятно" 3rd-tap transition feels abrupt: after `maxSimplifyRounds` (3) the soft transition (`theoryUnderstood = nextCount >= maxSimplifyRounds` in `handleTheoryStep`, [lessonEngine.ts](src/core/lessonEngine.ts:183)) auto-advances the child straight to the first exercise even though they just tapped "Не понятно" again — with no explanatory cue (e.g. "Давай попробуем на практике"). Behavior is intentional (prevents an infinite "не понятно" loop), but the jump can read as unexpected to a child. **Not yet fixed — to discuss how to address (add a transition message? a visible "последнее объяснение" hint on round 3?).**
- [Feature request, 2026-07-06, RESOLVED 2026-07-07 in quick-260707-krq] ~~Add a "cash register" (ka-ching) sound effect when rubles are awarded — play it at the same point the reward balance increases / `RewardToast` fires (before/after `state.currentRewards` diff in `main.ts`). Not yet implemented — to discuss (sound asset source, mute toggle for classroom use, autoplay-policy handling).~~ Fixed: `src/ui/sound/coin.ts` synthesizes a short two-note bell-like "cling" via the Web Audio API (no external asset, no mute toggle this pass), lazily creates/reuses one `AudioContext`, and degrades silently (try/catch, never throws) when the API is unavailable or blocked. Wired into the existing `rewardsDelta > 0` branch in `main.ts`.
- [Content/UX finding, 2026-07-06, RESOLVED 2026-07-07 in quick-260707-hby + quick-260707-krq] ~~Multi-blank text-input answer format is ambiguous. Exercises like `eq-1a-ex002` ("___ you usually ___ late?") have TWO blanks but ONE input box; the expected answer bundles in the already-printed "you usually", so a child who fills only the blanks ("don't have" for ex003) was FALSELY REJECTED.~~ Fixed in two steps: 260707-hby rendered multi-blank exercises inline; 260707-krq (UX-INLINE-02) unified SINGLE-blank exercises to the same inline path too (e.g. ex005 "I ___ going out to restaurants" now shows one inline input in the sentence, not a separate box below with a leftover "___"). All 18 text-input exercises now render consistently. Verified live on all 3 two-blank exercises (ex002/003/004) in 260707-hby; single-blank inline covered by unit tests in 260707-krq, pending a live look.
- [UX decision, 2026-07-06, RESOLVED 2026-07-07] ~~On an INCORRECT text-input answer the input field was intentionally NOT cleared — the same exercise stayed on screen with the child's text preserved so they could edit rather than retype (WR-03, by design in `main.ts`).~~ Changed per user decision: the field now clears and the submit button re-disables on an incorrect main-pass answer (commit `d0d40f8`), relying on the escalating authored hint (firstError/secondError, 260707-krq) to guide the retry instead of edit-in-place. Verified live: field empties, button disables, first input refocuses, banner shows the correct-attempt-count hint. Review-pass incorrect path (WR-02, explicit "Продолжить" step) untouched.
- [UX finding, 2026-07-07, RESOLVED 2026-07-07 in quick-260707-krq] ~~Wrong-answer hint relied only on `hint.firstError` (never escalated to the authored `hint.secondError` on repeated mistakes) and could be overridden by a confusing agent-generated hint (e.g. "add usually between don't and have" when "usually" was already printed).~~ Fixed: `main.ts` now shows the AUTHORED hint escalating by attempt count — `firstError` on attempt 1, `secondError` on attempt 2+ (falling back to `firstError` when a given exercise has no `secondError`, true for 9/19 exercises). Agent `hintRu` dropped from the banner entirely.
- [Feature request, 2026-07-07, RESOLVED 2026-07-07 in quick-260707-krq] ~~Progress data (session correct-streak, per-topic mastery status) was tracked in state but never surfaced in the UI beyond the "Задание N из 19" text and ruble chip.~~ Added to the top bar: a visual clamped progress bar (no overshoot across main/review/complete, mirrors `ProgressIndicator`'s 3-variant guarding), a "🔥 N" streak chip (shown only when `currentCorrectStreak >= 2`), and a compact "освоено N / M тем" topic-mastery summary line (`topicLabel()` names, first-pass minimal per design decision — no per-topic chip row yet).
- [Feature request, 2026-07-07, manual test] Show the exercise sentence's Russian translation ABOVE the English fill-in-the-blank version (e.g. above "He ___ at home today. (work)", show something like "Он ___ дома сегодня. (работать)") — user's reasoning: helps the child understand the sentence before attempting the blanks. **Not yet implemented — needs content authoring first**: `Lesson-1A.json`'s exercises currently have NO Russian translation field for `prompt` (confirmed via schema check — only `exerciseId/catalogRef/catalogItemRef/sourceRef/type/skill/prompt/targetWords/targetGrammar/answerCheck/hint/topicImpact`), so this needs (a) a new `promptRu` field added to the text-input exercise schema + all 18 exercises' data authored (translation, not just structure), then (b) a renderer change in `textInput.ts` to display it above the inline-blank sentence, styled like the existing `.instruction-ru` gray-hint pattern. To discuss: translate all 18 by hand, or have an agent assist with translation review (still authored/reviewed data, not a live per-render agent call — translations are static and should ship in `Lesson-1A.json`, never generated at runtime).

### Blockers/Concerns

- [v1.0] `single-choice`/`order-builder` have no real content in `Lesson-1A.json` (only `text-input`×18 + `matching`×1) — schema/checkers/renderers verified via hand-authored fixtures and live-browser testing, but real lesson content for these 2 types doesn't exist yet; needs content authoring before full end-to-end confidence (tracked as `CONTENT-01`, v2 scope)
- [v1.0, resolved+deployed 2026-07-06 in quick task 260705-rl5] ~~App calls a third-party LLM router (`api.llmrouter.ru`), not Anthropic directly — API key lives in `.env` → bundled into the built JS at compile time (browser-direct, no proxy)~~. A Cloudflare Worker key-proxy (`worker/`, deployed at `https://english-quest-llm-proxy.leto99999.workers.dev`) now holds the real key server-side only; the browser bundle no longer contains it. See `03-CONTEXT.md` D-03 (archived) — exposure closed structurally and confirmed live.
- [v1.0, diagnosed 2026-07-04, resolved+confirmed-live 2026-07-06 in quick task 260705-rl5] ~~Live LLM router calls from the browser fail with a **CORS preflight rejection**~~ — the deployed Worker answers the `OPTIONS` preflight itself and forwards `POST /v1/messages` server-to-server. **Confirmed working end-to-end via live browser test**: a real Answer Checker agent response (`errorType: spelling_ing_form`, a genuine hint for a "workin"→"working" typo) was observed for the first time in this project, not the deterministic fallback. One follow-up fix was needed post-deploy: the `@anthropic-ai/sdk`'s `anthropic-dangerous-direct-browser-access` header (sent automatically when `dangerouslyAllowBrowser: true`) was missing from the Worker's `Access-Control-Allow-Headers` list, which silently blocked the real POST client-side as a CORS violation even though `curl`/manual fetch worked and the OPTIONS preflight returned 204. Fixed via `/gsd-fast` (commit `36ea10e`) and redeployed.
- [v1.0, found+fixed 2026-07-06 in quick task 260706-nxg] ~~A full live 19-exercise lesson smoke-test walkthrough (first ever full run against the deployed Worker) found: (1) raw internal snake_case topic-ids leaking into user/parent-facing Russian text in `SessionEndScreen.ts` and `parentReportGenerator.ts`'s fallback template; (2) `callAgent.ts`'s 8s per-attempt timeout was too tight against real observed Worker/router latency (~6.4s+/call), causing frequent avoidable fallbacks and a 40-60s session-end wait (Reward Advisor fell back 88/19 exercises, Answer Checker 24, Theory Tutor 24, Parent Report Generator 8 — Progress Advisor 0); (3) TheoryScreen's explanation text was one dense paragraph with no per-sentence breaks~~. All 3 fixed: new `src/core/topics/topicLabels.ts` maps all 8 topic-ids to Russian display names (safe raw-id fallback on miss) used at both leak points; `TIMEOUT_MS` raised 8000→12000; `TheoryScreen.ts` now splits rule/explanation text into per-sentence `<p>` elements. 258/258 tests passing, `tsc --noEmit` clean, `Lesson-1A.json` unchanged.
- [v1.0, found+fixed 2026-07-06 in quick task 260706-ogs] ~~A second live re-verification pass (after 260706-nxg's fixes) found a deeper root cause behind the topic-id leak: `progressAdvisorSchema.ts`'s `recommendedFocus: z.string()` has no enum constraint, so the live agent is free to return ANY string — confirmed live, it once returned a hallucinated mixed-language string ("present_simple_question_order with question formation in real contexts...") instead of a clean topic-id, which `topicLabel()`'s safe raw-fallback then correctly-but-uselessly displayed as-is. Unlike `suggestedDifficulty` (already gated by `difficultyGuardrails.ts`), `recommendedFocus` had NO core-side validation before use~~. Fixed: new `applyRecommendedFocusGuardrail()` (`src/core/personalization/recommendedFocusGuardrail.ts`), wired into `handleSessionEnd()` at the same seam as `applyDifficultyGuardrails`, validates against `topicLabels.ts`'s `TOPIC_LABELS` keys and falls back to the caller's existing deterministic `fallbackRecommendedFocus` on any miss. 264/264 tests passing, `tsc --noEmit` clean, `progressAdvisorSchema.ts`/`Lesson-1A.json` unchanged.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260705-rl5 | Build a Cloudflare Workers proxy for the Anthropic API key so agent calls go through a server-to-server proxy instead of direct browser calls to api.llmrouter.ru | 2026-07-05 | b376335 | [260705-rl5-build-a-cloudflare-workers-proxy-for-the](./quick/260705-rl5-build-a-cloudflare-workers-proxy-for-the/) |
| 260706-nxg | Fix 3 issues found during a live smoke-test walkthrough: topic-id leak, callAgent timeout too tight, TheoryScreen dense paragraph | 2026-07-06 | acfa0ac | [260706-nxg-fix-3-issues-found-during-a-live-smoke-t](./quick/260706-nxg-fix-3-issues-found-during-a-live-smoke-t/) |
| 260706-ogs | Add core-side trust gate (applyRecommendedFocusGuardrail) for Progress Advisor's unconstrained recommendedFocus field | 2026-07-06 | 34a4249 | [260706-ogs-fix-missing-core-side-trust-gate-progres](./quick/260706-ogs-fix-missing-core-side-trust-gate-progres/) |
| 260707-hby | Multi-blank exercises: one inline input per blank (fixes false rejection of correct blank-only answers) + gray RU instruction hint | 2026-07-07 | 43c64cb | [260707-hby-multi-blank-text-input-exercises-render-](./quick/260707-hby-multi-blank-text-input-exercises-render-/) |
| 260707-krq | Batch of 4 UX improvements from live testing: synthesized coin-clink sound, unified inline text-input blanks, escalating authored hints, progress bar + streak chip + topic-mastery summary | 2026-07-07 | 265995e | [260707-krq-batch-of-4-ux-improvements-from-live-tes](./quick/260707-krq-batch-of-4-ux-improvements-from-live-tes/) |
| 260707-pu4 | Fix top-bar layout regression from 260707-krq: progress bar had zero visible width, top-bar was cramped — two-row restructure + hide topic-mastery at 0 topics | 2026-07-07 | 60d0bd1 | [260707-pu4-fix-top-bar-layout-regression-found-live](./quick/260707-pu4-fix-top-bar-layout-regression-found-live/) |
| 10 | Clear text input(s) and re-disable submit on incorrect main-pass answer, instead of preserving the wrong text | 2026-07-07 | d0d40f8 | — |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| UI polish | Feedback banner not cleared on exercise-advance (01-UAT.md Gap 1) | Resolved | Phase 1 → fixed in Phase 5 (D-12) |
| UI polish | Progress indicator overshoots at lesson-complete (01-UAT.md Gap 2) | Resolved | Phase 1 → fixed in Phase 5 (D-12) |

## Session Continuity

Last session: 2026-07-07T12:13:51.085Z
Stopped at: Completed quick task 260705-rl5 (Cloudflare Workers LLM key-proxy)
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
