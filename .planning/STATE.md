---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 0
status: Awaiting next milestone
stopped_at: "Completed quick task 260706-nxg (fixed 3 live smoke-test findings)"
last_updated: "2026-07-06T17:25:00.000Z"
last_activity: 2026-07-06
last_activity_desc: "Quick task 260706-nxg: fixed topic-id leak into user/parent-facing text, raised callAgent timeout 8s->12s, split TheoryScreen text into per-sentence paragraphs"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 14
  completed_plans: 14
  percent: 100
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

### Pending Todos

None yet.

### Blockers/Concerns

- [v1.0] `single-choice`/`order-builder` have no real content in `Lesson-1A.json` (only `text-input`×18 + `matching`×1) — schema/checkers/renderers verified via hand-authored fixtures and live-browser testing, but real lesson content for these 2 types doesn't exist yet; needs content authoring before full end-to-end confidence (tracked as `CONTENT-01`, v2 scope)
- [v1.0, resolved+deployed 2026-07-06 in quick task 260705-rl5] ~~App calls a third-party LLM router (`api.llmrouter.ru`), not Anthropic directly — API key lives in `.env` → bundled into the built JS at compile time (browser-direct, no proxy)~~. A Cloudflare Worker key-proxy (`worker/`, deployed at `https://english-quest-llm-proxy.leto99999.workers.dev`) now holds the real key server-side only; the browser bundle no longer contains it. See `03-CONTEXT.md` D-03 (archived) — exposure closed structurally and confirmed live.
- [v1.0, diagnosed 2026-07-04, resolved+confirmed-live 2026-07-06 in quick task 260705-rl5] ~~Live LLM router calls from the browser fail with a **CORS preflight rejection**~~ — the deployed Worker answers the `OPTIONS` preflight itself and forwards `POST /v1/messages` server-to-server. **Confirmed working end-to-end via live browser test**: a real Answer Checker agent response (`errorType: spelling_ing_form`, a genuine hint for a "workin"→"working" typo) was observed for the first time in this project, not the deterministic fallback. One follow-up fix was needed post-deploy: the `@anthropic-ai/sdk`'s `anthropic-dangerous-direct-browser-access` header (sent automatically when `dangerouslyAllowBrowser: true`) was missing from the Worker's `Access-Control-Allow-Headers` list, which silently blocked the real POST client-side as a CORS violation even though `curl`/manual fetch worked and the OPTIONS preflight returned 204. Fixed via `/gsd-fast` (commit `36ea10e`) and redeployed.
- [v1.0, found+fixed 2026-07-06 in quick task 260706-nxg] ~~A full live 19-exercise lesson smoke-test walkthrough (first ever full run against the deployed Worker) found: (1) raw internal snake_case topic-ids leaking into user/parent-facing Russian text in `SessionEndScreen.ts` and `parentReportGenerator.ts`'s fallback template; (2) `callAgent.ts`'s 8s per-attempt timeout was too tight against real observed Worker/router latency (~6.4s+/call), causing frequent avoidable fallbacks and a 40-60s session-end wait (Reward Advisor fell back 88/19 exercises, Answer Checker 24, Theory Tutor 24, Parent Report Generator 8 — Progress Advisor 0); (3) TheoryScreen's explanation text was one dense paragraph with no per-sentence breaks~~. All 3 fixed: new `src/core/topics/topicLabels.ts` maps all 8 topic-ids to Russian display names (safe raw-id fallback on miss) used at both leak points; `TIMEOUT_MS` raised 8000→12000; `TheoryScreen.ts` now splits rule/explanation text into per-sentence `<p>` elements. 258/258 tests passing, `tsc --noEmit` clean, `Lesson-1A.json` unchanged.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260705-rl5 | Build a Cloudflare Workers proxy for the Anthropic API key so agent calls go through a server-to-server proxy instead of direct browser calls to api.llmrouter.ru | 2026-07-05 | b376335 | [260705-rl5-build-a-cloudflare-workers-proxy-for-the](./quick/260705-rl5-build-a-cloudflare-workers-proxy-for-the/) |
| 260706-nxg | Fix 3 issues found during a live smoke-test walkthrough: topic-id leak, callAgent timeout too tight, TheoryScreen dense paragraph | 2026-07-06 | acfa0ac | [260706-nxg-fix-3-issues-found-during-a-live-smoke-t](./quick/260706-nxg-fix-3-issues-found-during-a-live-smoke-t/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| UI polish | Feedback banner not cleared on exercise-advance (01-UAT.md Gap 1) | Resolved | Phase 1 → fixed in Phase 5 (D-12) |
| UI polish | Progress indicator overshoots at lesson-complete (01-UAT.md Gap 2) | Resolved | Phase 1 → fixed in Phase 5 (D-12) |

## Session Continuity

Last session: 2026-07-05T17:01:30.000Z
Stopped at: Completed quick task 260705-rl5 (Cloudflare Workers LLM key-proxy)
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
