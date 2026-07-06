---
phase: quick-260706-nxg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/topics/topicLabels.ts
  - src/ui/screens/SessionEndScreen.ts
  - src/core/agents/parentReportGenerator.ts
  - src/core/agents/callAgent.ts
  - src/ui/screens/TheoryScreen.ts
  - tests/core/topics/topicLabels.test.ts
  - tests/core/agents/parentReportGenerator.test.ts
  - tests/ui/screens/TheoryScreen.test.ts
autonomous: true
requirements: [SMOKE-FIX-01, SMOKE-FIX-02, SMOKE-FIX-03]

must_haves:
  truths:
    - "The session-end 'Следующий фокус' line shows a human-readable Russian topic name, not a raw snake_case id, whenever recommendedFocus is one of the 8 known topic ids"
    - "The parent-report fallback template shows Russian topic names for strugglingTopics/reviewTopics/recommendation, not raw ids"
    - "A topic-id lookup miss returns the raw id string and never throws"
    - "callAgent's per-attempt timeout is 12000ms"
    - "Multi-sentence theory explanation text renders as multiple <p> elements, one per sentence"
    - "Lesson-1A.json schema and data shape are unchanged"
    - "All existing tests in tests/core still pass (193+)"
  artifacts:
    - src/core/topics/topicLabels.ts
    - tests/core/topics/topicLabels.test.ts
  key_links:
    - "SessionEndScreen renders recommendedFocus through topicLabel()"
    - "parentReportGenerator.buildTemplateReport maps topic arrays and recommendation through topicLabel()"
    - "TheoryScreen splits textRu on sentence boundaries before creating <p> nodes"
---

<objective>
Fix 3 issues found during a live smoke-test of the full lesson (all 5 agents exercised end-to-end via the deployed Cloudflare Worker proxy):

1. BUG: raw internal snake_case topic-ids leak into user/parent-facing Russian text (SessionEndScreen "Следующий фокус" line; parentReportGenerator fallback template).
2. PERFORMANCE: callAgent TIMEOUT_MS=8000 is too tight vs. real ~6.4-7s Worker latency, causing avoidable fallbacks and 40-60s session-end waits.
3. UI/UX: TheoryScreen renders explanation text as one dense multi-sentence paragraph, hard for a child to read.

Purpose: Restore polish and reliability to the shipped MVP demo without touching the deterministic-core/agent architecture or the lesson data schema.
Output: New topicLabels module + 4 targeted source edits + 3 test files added/updated. No architecture or Lesson-1A.json schema changes.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260706-nxg-fix-3-issues-found-during-a-live-smoke-t/260706-nxg-CONTEXT.md

# Leak points and the file being edited
@src/ui/screens/SessionEndScreen.ts
@src/core/agents/parentReportGenerator.ts
@src/core/agents/callAgent.ts
@src/ui/screens/TheoryScreen.ts

# Existing test conventions to match
@tests/core/agents/parentReportGenerator.test.ts
@tests/ui/screens/TheoryScreen.test.ts

# Key facts confirmed during planning:
# - No src/core/topics/ dir exists yet; no topic-id->name map anywhere (grep-confirmed).
# - The 8 topicImpact ids in public/Lesson-1A.json: food_vocabulary,
#   non_action_verb, present_continuous_future_arrangement,
#   present_continuous_now, present_simple_negative,
#   present_simple_question_order, present_simple_third_person_negative,
#   restaurant_vocabulary.
# - recommendedFocus (from ProgressAdvisor) is a topic-id in the deterministic
#   fallback path but may be free Russian text on agent success; topicLabel()
#   falling back to the raw string handles BOTH: an unknown Russian sentence
#   passes through unchanged, a known id gets translated.
# - parentReportGenerator.test.ts currently asserts raw ids appear in the
#   fallback report (lines 70-71) — those assertions MUST be updated to expect
#   the Russian display names after this fix.
# - Existing repo convention: createElement/textContent only, never innerHTML.
# - TheoryScreen.test.ts asserts el.textContent contains lesson.theory.rule and
#   explanationLevels[0].exampleRu verbatim — splitting into multiple <p> keeps
#   textContent equal to the concatenation, but verbatim substring checks may
#   break if a space between sentences is dropped; preserve original characters.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create topicLabels map and use it at both leak points</name>
  <files>src/core/topics/topicLabels.ts, tests/core/topics/topicLabels.test.ts, src/ui/screens/SessionEndScreen.ts, src/core/agents/parentReportGenerator.ts, tests/core/agents/parentReportGenerator.test.ts</files>
  <behavior>
    topicLabel() unit tests:
    - topicLabel("present_simple_question_order") returns a non-empty Russian string that is NOT the raw id (e.g. contains Cyrillic characters).
    - Each of the 8 known ids returns a distinct human-readable Russian label.
    - topicLabel("some_unknown_future_id") returns "some_unknown_future_id" verbatim (fallback, no throw).
    - topicLabel("") returns "" (no throw).
    parentReportGenerator fallback test updates:
    - The source:"core" template report contains the RUSSIAN label for strugglingTopics[0] and reviewTopics[0], NOT the raw ids "present_continuous_now"/"food_vocabulary".
    - When strugglingTopics/reviewTopics are empty the template still shows "нет" (unchanged behavior).
  </behavior>
  <action>Create src/core/topics/topicLabels.ts (per CONTEXT locked decision). Export a `TOPIC_LABELS` const record mapping ALL 8 topic ids to short Russian display names, and a `topicLabel(id: string): string` function that returns `TOPIC_LABELS[id] ?? id` — a missing key falls back to the raw id string and NEVER throws. Choose concise, child/parent-appropriate Russian names (Claude's discretion), e.g. food_vocabulary -> "лексика: еда", present_simple_question_order -> "Present Simple: порядок слов в вопросе", present_continuous_now -> "Present Continuous: действие сейчас", non_action_verb -> "глаголы-состояния", restaurant_vocabulary -> "лексика: ресторан", present_simple_negative -> "Present Simple: отрицание", present_simple_third_person_negative -> "Present Simple: отрицание в 3-м лице", present_continuous_future_arrangement -> "Present Continuous: планы на будущее". Keep them short and consistent in style. Do NOT modify Lesson-1A.json — this is a pure code-side lookup, not a schema change.

In SessionEndScreen.ts: import topicLabel and change line 32 from interpolating props.recommendedFocus raw to `Следующий фокус: ${topicLabel(props.recommendedFocus)}`. Do not change the SessionEndScreenProps interface — recommendedFocus stays a string; the label lookup passes free Russian text through unchanged.

In parentReportGenerator.ts buildTemplateReport(): import topicLabel and map each array element through it before joining — `input.strugglingTopics.map(topicLabel).join(", ")` and `input.reviewTopics.map(topicLabel).join(", ")` — and wrap the recommendation with `topicLabel(input.recommendation)` in the interpolation (recommendation is often a topic-id in the deterministic path; free Russian text passes through unchanged). Keep the "нет" empty-array behavior. Do NOT touch the agent-success path (only the fallback template).

Update tests/core/agents/parentReportGenerator.test.ts: the "agent failure -> TEMPLATE report" test currently asserts the raw ids appear (baseInput.strugglingTopics[0]/reviewTopics[0]). Change those two assertions to expect the topicLabel() output for those ids instead (import topicLabel and assert `result.parentReportRu` contains `topicLabel(baseInput.strugglingTopics[0])` and `topicLabel(baseInput.reviewTopics[0])`). Leave the numeric-field and recommendation assertions intact (recommendation "Повторить present continuous" is free text and passes through unchanged).</action>
  <verify>
    <automated>npx vitest run tests/core/topics/topicLabels.test.ts tests/core/agents/parentReportGenerator.test.ts</automated>
  </verify>
  <done>topicLabels.ts exports topicLabel() with all 8 ids and raw-id fallback; SessionEndScreen and parentReportGenerator fallback both route topic strings through topicLabel(); topicLabels tests pass and updated parentReportGenerator tests pass. Lesson-1A.json unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Raise callAgent per-attempt timeout 8000 -> 12000</name>
  <files>src/core/agents/callAgent.ts</files>
  <action>Change the `TIMEOUT_MS` constant in callAgent.ts from `8000` to `12000` (per CONTEXT locked decision). Update the trailing comment to note the new value and rationale (observed ~6.4-7s real Worker latency; 12s headroom lets the first attempt usually succeed; worst-case two-attempt total becomes 24s, still safely bounded by the deterministic fallback). No other logic changes — the retry-once-then-fallback structure and maxRetries:0 stay identical.</action>
  <verify>
    <automated>grep -v '^\s*//' src/core/agents/callAgent.ts | grep -c 'TIMEOUT_MS = 12000' && npx vitest run tests/core/agents/callAgent.test.ts</automated>
  </verify>
  <done>TIMEOUT_MS is 12000; callAgent test suite still passes (retry-then-fallback behavior unchanged).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Split TheoryScreen explanation text into per-sentence paragraphs</name>
  <files>src/ui/screens/TheoryScreen.ts, tests/ui/screens/TheoryScreen.test.ts</files>
  <behavior>
    - Rendering a multi-sentence textRu (sentences separated by ". " / "! " / "? ") produces MORE THAN ONE <p> under the explanation, one per sentence.
    - The full original explanation text is still recoverable from el.textContent (no sentence content dropped).
    - A single-sentence string (e.g. a short exampleRu with no internal boundary) produces exactly one <p>.
    - Existing assertions still hold: el.textContent contains theory.rule and explanationLevels[0].exampleRu; both toggle buttons render with .theory-toggle.
  </behavior>
  <action>In TheoryScreen.ts, add a small local helper `splitSentences(text: string): string[]` that splits on sentence-boundary punctuation followed by whitespace (regex on `.`, `!`, `?` followed by whitespace), keeps the terminating punctuation on each piece, trims, and drops empties; if no boundary is found it returns the single trimmed string as a one-element array. Do NOT place the regex literal inside any comment that a negative grep might scan.

Replace the single explanation `<p>` (currently created from activeExplanation.textRu) with a loop that creates one `<p>` per sentence returned by splitSentences(activeExplanation.textRu), appending each to the container in order (createElement/textContent only, never innerHTML — repo convention). This same code path renders round-0 pre-written text AND Theory Tutor's live agent-returned text (rounds 2-3) since both arrive via currentExplanation/activeExplanation.textRu — satisfying CONTEXT's recommend-yes discretion note for consistency.

For theory.rule (line 27-30): the rule is usually short; per CONTEXT discretion, apply the SAME splitSentences treatment so a multi-clause rule also breaks into readable lines, but keep the existing `.display` class on the FIRST rule paragraph (or apply it to each rule paragraph — keep styling consistent with existing `.theory-screen .display` / `.theory-screen p`, no new visual redesign). For exampleRu keep it as a single <p> (examples are single-line) OR split it too if it contains multiple sentences — use splitSentences uniformly is fine as long as single-sentence input yields exactly one <p>.

Do NOT change Lesson-1A.json's theory.rule / explanationLevels[].textRu data shape — this is presentational-only, split happens at render time. Do not add new CSS classes beyond what already exists; reuse `.display` and default `.theory-screen p` styling.

Update tests/ui/screens/TheoryScreen.test.ts: add a test that a multi-sentence explanation renders multiple <p> elements (count > 1) and that el.textContent still contains the full original textRu content (join the split pieces / assert each sentence substring is present). Keep the existing verbatim `toContain(lesson.theory.rule)` assertion working — if splitting the rule would break an exact-substring match (because inter-sentence whitespace changes), assert each split sentence of the rule is contained instead, rather than the whole rule verbatim. Ensure single-sentence exampleRu still yields exactly one <p>.</action>
  <verify>
    <automated>npx vitest run tests/ui/screens/TheoryScreen.test.ts</automated>
  </verify>
  <done>Multi-sentence explanation/rule text renders as multiple <p> nodes (one per sentence); single-sentence text yields one <p>; full text recoverable from textContent; existing button/class assertions still pass; Lesson-1A.json unchanged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| LLM agent -> deterministic core | Agent-proposed text is untrusted until Zod-validated; unchanged by this task |
| topic-id string -> rendered UI text | A malformed/unknown id must degrade gracefully (raw string), never crash |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-nxg-01 | Denial of Service | topicLabel() lookup miss | low | mitigate | `TOPIC_LABELS[id] ?? id` returns raw string, never throws (Task 1 behavior + explicit unit test for unknown/empty id) |
| T-nxg-02 | Tampering | TheoryScreen render of agent-returned text | low | mitigate | createElement/textContent only (never innerHTML); splitSentences operates on already-Zod-validated strings, so no new injection surface (Task 3) |
| T-nxg-03 | Denial of Service | callAgent longer worst-case wait (24s) | low | accept | Deterministic fallback still guarantees no broken state; longer worst-case wait is the accepted tradeoff per CONTEXT decision |

No npm/pip/cargo installs in this task — package legitimacy gate not applicable.
</threat_model>

<verification>
Run the full suite to confirm no regressions across the 193+ tests, plus typecheck/lint per repo config:

```
npx vitest run
npx tsc --noEmit
```

Confirm Lesson-1A.json is byte-unchanged:

```
git diff --exit-code public/Lesson-1A.json
```
</verification>

<success_criteria>
- src/core/topics/topicLabels.ts exists with all 8 topic-id -> Russian label entries and a raw-id fallback that never throws.
- SessionEndScreen "Следующий фокус" line and parentReportGenerator fallback template both route topic strings through topicLabel().
- callAgent TIMEOUT_MS is 12000.
- TheoryScreen renders multi-sentence explanation/rule text as multiple <p> elements; single-sentence text as one <p>.
- Lesson-1A.json schema/data unchanged (git diff clean).
- Full test suite (193+ tests) passes; tsc --noEmit clean.
</success_criteria>

<output>
Create `.planning/quick/260706-nxg-fix-3-issues-found-during-a-live-smoke-t/260706-nxg-SUMMARY.md` when done.
</output>
