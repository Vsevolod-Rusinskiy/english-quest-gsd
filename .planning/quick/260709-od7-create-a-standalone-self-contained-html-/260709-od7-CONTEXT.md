# Quick Task 260709-od7: Standalone HTML mechanics/data-flow explainer - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Task Boundary

Create `docs/MECHANICS.html` — a single, self-contained, static HTML file (inline CSS + inline JS, zero external network dependencies, zero build step) that visually documents English Quest's ACTUAL CURRENT architecture, data flow, and user journey. Must open directly via `file://` in any browser. This replaces the user's earlier request for an in-chat visual (already shown once as a temporary widget) with a permanent, openable, iterable project artifact.

The user's own words: "нужно HTML чтобы я мог открыть и мы с тобой механику и поток данных и путешествия юзера нарисовали мне нужно понимать как работают агенты и вообще механика" — needs to cover: (1) mechanics, (2) data flow, (3) user journey, (4) specifically how the 5 agents work.

IMPORTANT: base this on the CURRENT, ACTUAL implementation as it exists in the codebase today — NOT on `.planning/research/ARCHITECTURE.md` (a pre-implementation research doc from 2026-07-01 that is now outdated in several respects: e.g. it assumed text-input near-misses would sometimes skip the agent via `.includes()`, but the real implementation calls Answer Checker on ANY exact-match miss; it doesn't mention the Cloudflare Worker proxy, the topic-label guardrail, or the two-row top-bar). Verify facts against source files listed below, do not copy ARCHITECTURE.md's plan as if it were the implementation.

</domain>

<decisions>
## Implementation Decisions (locked)

### Format
- One HTML file: `docs/MECHANICS.html`. Fully self-contained (no `<link>`/`<script src>` to external CDNs or fonts — this must work fully offline via `file://`). Inline `<style>` and `<script>` only.
- No build step, no framework, no dependency on the Vite dev server or the app's own bundling — this is a standalone document, separate from `src/`.
- Should feel navigable/interactive (collapsible sections, tabs, or a clickable diagram) rather than one giant wall of text — but must degrade gracefully to readable static content if JS is disabled (progressive enhancement, not JS-required).

### Required content sections (all must be present, based on the REAL current system)

1. **Architecture overview** — the core/agent split: deterministic core owns all state writes; exactly 5 independent LLM agent-functions propose text/judgment only, never write state directly ("agent proposes, core validates before use" — this exact CLAUDE.md principle should be stated explicitly, it is the thesis's central architectural claim).

2. **The Agent Gateway (`src/core/agents/callAgent.ts`)** — the single trust boundary every one of the 5 agents goes through: build request → call LLM (`claude-haiku-4-5`, `TIMEOUT_MS = 12000` per attempt) → validate response shape/schema via Zod → on failure, retry exactly once → on second failure, invoke that agent's deterministic fallback. Explain this is ONE shared function (`callAgent<T>()`), not 5 separate integrations — reused unchanged across all 5 agents.

3. **The Cloudflare Worker proxy (`worker/src/index.ts`)** — browser never talks to the LLM router directly. It calls a deployed Cloudflare Worker (`https://english-quest-llm-proxy.leto99999.workers.dev`), which holds the real API key server-side (Cloudflare secret, never in the browser bundle) and forwards to `api.llmrouter.ru`. The Worker also answers the CORS `OPTIONS` preflight itself (this was a real bug found and fixed live — the router rejected preflights with 401, which curl never sends but real browsers do). Explain WHY this exists: (a) security — the real API key must never ship in browser JS, (b) it structurally fixes the CORS problem.

4. **The 5 agents, each described with**: what it proposes, what triggers it, its deterministic fallback, and the core-side validation/guardrail applied to its output (if any):
   - **Answer Checker** (`src/core/agents/answerChecker.ts`) — triggered ONLY when a text-input exercise's deterministic exact-match check (`checkTextInput.ts`) fails. NEVER called for single-choice/matching/order-builder (those are always deterministic-only — no agent call at all). Proposes `isCorrect`/`errorType`/`confidence`/`hintRu`. Trust gate: `confidence >= 0.8` required for the core to accept `isCorrect: true` from the agent — below that threshold, treated as incorrect regardless of what the agent said. On failure: falls back to `isCorrect: false` with a generic errorType.
   - **Theory Tutor** (`src/core/agents/theoryTutor.ts`) — triggered by the child tapping "Не понятно" on the theory screen, but ONLY on round 2 and round 3 of a capped 3-round escalation (`maxSimplifyRounds = 3` in the lesson data). Round 1 uses a pre-written simpler explanation from the lesson JSON with NO agent call. Rounds 2-3 call the agent to reformulate even simpler. On round 3 (or agent failure), a "soft transition" auto-advances the child to the first exercise regardless of another "Не понятно" tap — this prevents an infinite loop, but the transition has no explanatory UI cue yet (a known, still-open UX rough edge, worth a small note). Fallback: re-serves the SAME pre-written simple text verbatim, never fabricates new text.
   - **Reward Advisor** (`src/core/agents/rewardAdvisor.ts`) — triggered once per answer, ONLY when that answer produced at least one reward event (the core's own reward rules already decided rubles were earned — the agent NEVER decides the amount, only proposes a `celebrationRu` praise sentence and `suggestedReasons`). Core-side cross-check gate: the agent's suggested reasons are intersected against the actually-granted reward events; if the agent hallucinates a reason that didn't actually happen, its praise text is silently discarded (praiseRu becomes undefined), identical to an agent failure — this is a real anti-hallucination guardrail, name it explicitly.
   - **Progress Advisor** (`src/core/agents/progressAdvisor.ts`) — called once at session end (lesson complete). Proposes `recommendedFocus` (next topic), `suggestedDifficulty`, `reviewSuggestions`, `motivationalMessageRu`, `sessionAdvice`. TWO core-side guardrails on its output (both found live and fixed as real bugs, worth mentioning as a "trust but verify" case study): (a) `applyDifficultyGuardrails()` — caps difficulty jumps to one step, requires streak/error thresholds before moving; (b) `applyRecommendedFocusGuardrail()` — validates `recommendedFocus` against the actual known topic-id set (`topicLabels.ts`), falling back to the core's own computed weakest-topic if the agent returns anything else (this closed a real live bug where the agent once returned a hallucinated mixed-language string instead of a clean topic id).
   - **Parent Report Generator** (`src/core/agents/parentReportGenerator.ts`) — called immediately after Progress Advisor resolves (sequential, never parallel — explicitly NOT `Promise.all`, so Parent Report can safely use Progress Advisor's already-guardrailed `recommendedFocus`). Proposes `parentReportRu`/`headlineRu`. Fallback: a deterministic Russian template built from the session snapshot (exercises completed, correct count, struggling/review topics via `topicLabel()`, rubles earned, recommendation) — mention that this fallback template was itself the site of a real live-found bug (it used to interpolate raw topic-id strings before `topicLabels.ts` existed) and is now fixed.

5. **Answer-checking data flow** (the highest-frequency flow) — walk through what happens when a child submits an answer: deterministic check first (`checkTextInput`/`checkSingleChoice`/`checkMatching`/`checkOrderBuilder`) → only text-input escalates to Answer Checker on a miss → `evaluateAttempt()` computes ALL derived state in one pass (topic stats, review queue, reward events) → Reward Advisor conditionally called → single state dispatch → `localStorage["english-quest-progress-v1"]` persisted → UI re-renders (feedback banner, top-bar chips, progress bar).

6. **Topic mastery / review-queue state machine** — `not_started -> in_progress -> needs_review (2 wrong in a row) / mastered (3 correct in a row)`; a `needs_review` topic's exercises get appended to the review queue and re-served later in the SAME lesson session. This is pure core logic, zero agent involvement.

7. **Reward mechanics** — fixed reward-amount table lives in core rules (`src/core/rewards/rewardEngine.ts`), never chosen by an agent; a synthesized "coin clink" sound (`src/ui/sound/coin.ts`, Web Audio API, no external asset) plays when the balance increases; a streak chip ("🔥 N") shows only when `currentCorrectStreak >= 2`.

8. **Session-end flow diagram** — lesson complete -> "Показать итоги" tap -> Progress Advisor call -> guardrails applied -> Parent Report Generator call (sequential) -> combined session-end screen shown to both child (motivational message + next focus + rubles) and parent (report) in one screen.

9. **A short "why this architecture" / thesis framing box** — 1-2 sentences tying it back to the diploma's core value: proving the learning mechanic end-to-end (deterministic checking + LLM interpretation where needed + personalization + weak-topic repetition + reward accrual) without ever landing in a broken state, even when an agent is unavailable — every single agent call has a working deterministic fallback, verified live in this project's own testing (timeouts, CORS failures, hallucinated outputs were all observed and handled gracefully without crashing).

### Visual style
- Should look clean and professional (this may be shown to a diploma committee) but the author has flagged small text/hint-style typography as important — reuse ideas from the app's own visual language is NOT required (this is a separate doc, not app UI), but should be readable, well-organized, not a wall of text. Diagrams can be CSS/HTML box-and-arrow layouts (divs positioned in a flow, simple SVG, or similar) — no requirement to match any particular design system.
- Written primarily in Russian (matching the user's own language throughout this project's conversations and the app's own UI language), with English technical identifiers (file names, function names, agent names) kept as-is where they aid precision.

### Claude's Discretion
- Exact visual layout/diagram style (flowchart boxes, timeline, tabs+accordion, etc.) — pick whatever communicates clearest for a technical + non-technical mixed audience (the user is a diploma author, this may be shown to an advisor).
- Whether to include a live "click through" simulation of the answer-checking flow (nice-to-have, not required) vs. pure static explanatory diagrams.
- Exact wording/length of each section — accuracy against the real codebase matters more than exhaustive completeness; keep it comprehensible in one sitting.

</decisions>

<specifics>
## Specific Ideas

Source-of-truth files to verify facts against before writing content (do not invent details not confirmable in these):
- `src/core/agents/callAgent.ts` (Agent Gateway: MODEL, TIMEOUT_MS=12000, retry-once-then-fallback logic)
- `worker/src/index.ts` (Cloudflare Worker proxy: CORS OPTIONS handling, key injection, forwarding to api.llmrouter.ru)
- `src/core/agents/answerChecker.ts` (CORRECT_CONFIDENCE_THRESHOLD = 0.8 gate)
- `src/core/agents/theoryTutor.ts` + `src/core/lessonEngine.ts`'s `handleTheoryStep()` (3-round escalation, soft transition at maxSimplifyRounds)
- `src/core/agents/rewardAdvisor.ts` + the cross-check gate in `src/core/lessonEngine.ts`'s `handleAnswer()` (Set intersection against granted rewardEvents)
- `src/core/agents/progressAdvisor.ts`, `src/core/personalization/difficultyGuardrails.ts`, `src/core/personalization/recommendedFocusGuardrail.ts`, `src/core/topics/topicLabels.ts`
- `src/core/agents/parentReportGenerator.ts` (fallback template, buildTemplateReport())
- `src/core/lessonEngine.ts`'s `handleSessionEnd()` (sequential Progress Advisor -> guardrails -> Parent Report Generator, never Promise.all)
- `src/core/answer-checking/checkTextInput.ts`, `checkSingleChoice.ts`, `checkMatching.ts`, `checkOrderBuilder.ts` (deterministic-first checking, only text-input ever escalates)
- `src/core/progress/evaluateAttempt.ts` (single pure function computing all derived state per attempt)
- `src/core/progress/topicStatusMachine.ts`, `src/core/progress/reviewQueue.ts` (topic FSM + review queue)
- `src/core/rewards/rewardEngine.ts` (fixed reward table)
- `src/ui/sound/coin.ts` (Web Audio synthesized sound)
- `.planning/STATE.md` (Blockers/Concerns and Pending Todos sections — real bugs found live during manual testing: CORS preflight rejection, topic-id leak into user-facing text, missing recommendedFocus guardrail, multi-blank answer-format ambiguity — these are good "trust but verify" case-study material for the explainer, showing the guardrail architecture catching real problems)

Do NOT read `.planning/research/ARCHITECTURE.md` as a source of truth for CURRENT behavior — it's pre-implementation planning, already noted as partially outdated above.

</specifics>

<canonical_refs>
## Canonical References

- `CLAUDE.md` — the "agent proposes, core writes"/"agent response not trusted until core validates" architectural principle (core thesis claim to state explicitly in the explainer's overview section)
- `.planning/STATE.md` — real bugs found and fixed during this project's live testing, useful as concrete "here's the guardrail architecture actually catching a real problem" examples

</canonical_refs>
