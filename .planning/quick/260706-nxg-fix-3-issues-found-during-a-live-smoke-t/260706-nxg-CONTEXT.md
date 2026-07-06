# Quick Task 260706-nxg: Fix 3 issues found during a live smoke-test walkthrough - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Task Boundary

Fix 3 issues found during a live smoke-test walkthrough of the full lesson (all 5 agents exercised end-to-end via the deployed Cloudflare Worker proxy):

1. BUG - raw internal topic-id leaks into user/parent-facing Russian text. `src/ui/screens/SessionEndScreen.ts:32` always renders `Следующий фокус: ${recommendedFocus}` using the raw snake_case topic id (e.g. "present_simple_question_order") with zero human-readable translation - happens regardless of whether Progress Advisor succeeded or fell back. Separately, `src/core/agents/parentReportGenerator.ts`'s `buildTemplateReport()` fallback template (lines 46-56) interpolates `strugglingTopics`, `reviewTopics`, and `recommendation` directly as raw topic-id strings/arrays into the Russian parent report sentence whenever Parent Report Generator's agent call fails (confirmed live: 8 timeouts logged for this agent during one lesson). The 8 topic ids in `Lesson-1A.json`'s `topicImpact` fields: `food_vocabulary`, `non_action_verb`, `present_continuous_future_arrangement`, `present_continuous_now`, `present_simple_negative`, `present_simple_question_order`, `present_simple_third_person_negative`, `restaurant_vocabulary`. No topic-id-to-display-name mapping exists anywhere in the codebase (confirmed via grep).

2. PERFORMANCE - `callAgent`'s `TIMEOUT_MS` (`src/core/agents/callAgent.ts`, currently 8000ms per attempt, up to 2 attempts = 16s worst case) is uncomfortably tight against real observed latency through the deployed Cloudflare Worker -> LLM router path. Live-tested over one full 19-exercise lesson: Reward Advisor hit retry-then-fallback 88 times, Answer Checker 24, Theory Tutor 24, Parent Report Generator 8 (Progress Advisor 0 - consistently fast). A raw curl to the deployed Worker for a Theory Tutor-shaped request took ~6.4s end-to-end even in the best case. The session-end screen (2 sequential agent calls) took ~40-60s wall-clock to appear in testing.

3. UI/UX - the theory screen's explanation text (`src/ui/screens/TheoryScreen.ts`, rendered from `Lesson-1A.json`'s `theory.rule` / `theory.explanationLevels[].textRu`) is one dense flowing paragraph mixing multiple grammar sentences with no line breaks between sentences, making it harder to read for a child.

This is a diploma-project MVP (English Quest) using a deterministic-core/LLM-agent hybrid architecture (see CLAUDE.md). Do not restructure the agent architecture - these are targeted fixes within the existing design.

</domain>

<decisions>
## Implementation Decisions

### Topic-name mapping location
- New shared TS module `src/core/topics/topicLabels.ts` exporting a topic-id -> Russian display-name map covering all 8 ids currently in `Lesson-1A.json`.
- Used consistently at both leak points: `SessionEndScreen.ts`'s "Следующий фокус" line, and `parentReportGenerator.ts`'s `buildTemplateReport()` fallback (recommendation, strugglingTopics, reviewTopics).
- Do NOT modify `Lesson-1A.json`'s schema (`lesson-json-v1`) for this - keep it a pure code-side lookup, not a data-schema change.
- If a topic id is ever missing from the map (future lesson content), fall back to the raw id string rather than throwing - never crash on a lookup miss.

### TIMEOUT_MS value
- Increase `callAgent.ts`'s `TIMEOUT_MS` from 8000 to 12000 (12 seconds) per attempt.
- Rationale: observed real single-call latency through the deployed Worker is ~6.4-7s; 12s gives comfortable headroom for the first attempt to succeed without needing the retry in the common case, cutting typical total wait roughly in half versus the observed 40-60s session-end delay.
- Worst case (both attempts still time out) becomes 24s instead of 16s - acceptable since the deterministic fallback still guarantees no broken state, just a longer worst-case wait before falling back.

### Theory text sentence splitting
- Presentational-only fix in `TheoryScreen.ts` (and any other place theory-style paragraph text is rendered the same way): split the rendered text on sentence-boundary punctuation (`.`, `!`, `?` followed by whitespace) and render each sentence as its own `<p>` (or line), rather than one dense paragraph.
- Do NOT change `Lesson-1A.json`'s `theory.rule` / `explanationLevels[].textRu` data shape - this stays a plain string field per `lesson-json-v1`; the split happens purely at render time.
- Apply consistently to all 3 places TheoryScreen renders explanation text (rule, explanation, example) if they have the same multi-sentence density issue - use judgment on whether `rule` (usually short) needs splitting too, versus just the longer `explanationLevels[].textRu` paragraphs.

### Claude's Discretion
- Exact CSS/spacing for the newly-split sentence paragraphs (keep consistent with existing `.theory-screen p` styling, no new visual redesign).
- Whether the regex split should also apply to Theory Tutor's live-agent-returned explanation text (rounds 2-3) - recommend yes, same rendering path, for consistency between round 0 (pre-written) and rounds 2-3 (agent-returned) text.

</decisions>

<specifics>
## Specific Ideas

No further specific requirements - the 3 issues above, their locations, and the decisions captured are the complete scope.

</specifics>

<canonical_refs>
## Canonical References

- `CLAUDE.md` - project constraints (exactly 5 agents, mandatory deterministic fallback per agent, core owns all state, agent proposes only, `lesson-json-v1` schema)
- `.planning/STATE.md` - existing blocker/tech-debt notes this smoke test builds on (CORS/proxy resolution already shipped in quick-260705-rl5)

</canonical_refs>
