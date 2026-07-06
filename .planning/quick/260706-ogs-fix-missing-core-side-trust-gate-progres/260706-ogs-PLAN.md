---
phase: quick-260706-ogs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/personalization/recommendedFocusGuardrail.ts
  - src/core/lessonEngine.ts
  - tests/core/personalization/recommendedFocusGuardrail.test.ts
  - tests/core/lessonEngine.test.ts
autonomous: true
requirements: [PERSONAL-03, SMOKE-FIX-02]
user_setup: []

must_haves:
  truths:
    - "A hallucinated/free-form recommendedFocus string from the Progress Advisor never reaches SessionEndScreen's 'Следующий фокус' line or parentReportGenerator's recommendation input — it is replaced by the caller-supplied deterministic fallback before use."
    - "A clean, valid topic-id recommendedFocus (a key of TOPIC_LABELS) passes through the guardrail unchanged."
    - "The guardrail never throws on any string input, matching applyDifficultyGuardrails' pure-function-never-crash contract."
    - "The existing 258-test suite still passes; the guardrail wiring introduces no observable behavior change for valid inputs."
  artifacts:
    - "src/core/personalization/recommendedFocusGuardrail.ts (new pure guardrail function)"
    - "tests/core/personalization/recommendedFocusGuardrail.test.ts (new unit tests)"
  key_links:
    - "handleSessionEnd() calls the guardrail AFTER callProgressAdvisor() resolves and BEFORE recommendedFocus flows into parentReportGenerator input, the session_end dispatch, and the SessionEndResult return — exactly where applyDifficultyGuardrails() is already invoked for suggestedDifficulty."
    - "The fallback argument passed to the guardrail is the SAME fallbackRecommendedFocus value already computed and passed into callProgressAdvisor() — not a second/different fallback."
    - "TOPIC_LABELS (src/core/topics/topicLabels.ts) is the single source-of-truth valid-id set; the guardrail validates against Object.keys(TOPIC_LABELS), never a duplicated list."
---

<objective>
Close the missing core-side trust gate for Progress Advisor's `recommendedFocus`. Its schema (`progressAdvisorSchema.ts`) is `z.string()` with no enum constraint, so a live-tested hallucinated mixed-language string ("present_simple_question_order with question formation in real contexts (building on the strong foundation in present continuous)") flowed unvalidated into `SessionEndScreen`'s "Следующий фокус" line and `parentReportGenerator`'s recommendation field.

Add a pure deterministic guardrail — mirroring the existing `applyDifficultyGuardrails` pattern — that validates a candidate `recommendedFocus` against `Object.keys(TOPIC_LABELS)` and returns the caller-supplied fallback on any miss. Wire it into `handleSessionEnd()` at the same seam where `applyDifficultyGuardrails()` already gates `suggestedDifficulty`, so both consumers (`SessionEndScreen`, `parentReportGenerator`) only ever receive a validated topic-id.

Purpose: Enforce CLAUDE.md's "agent proposes, core validates before use" boundary for the one remaining agent field (`recommendedFocus`) that currently bypasses it — the deterministic core, not the LLM, decides the final displayed focus.
Output: One new pure guardrail module + its unit tests, `handleSessionEnd()` wiring, and extended lessonEngine tests.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./.claude/CLAUDE.md

# Pattern to mirror (pure function, called by caller not wrapper, JSDoc header)
@src/core/personalization/difficultyGuardrails.ts

# Source-of-truth valid-id set (reuse its keys; DO NOT invent a second list)
@src/core/topics/topicLabels.ts

# The caller — handleSessionEnd is where wiring goes (see applyDifficultyGuardrails invocation)
@src/core/lessonEngine.ts

# The wrapper — fallbackRecommendedFocus is the existing deterministic fallback to reuse (DO NOT change)
@src/core/agents/progressAdvisor.ts

# DO NOT MODIFY — recommendedFocus stays z.string()
@src/core/agents/progressAdvisorSchema.ts

# Consumer 1 of recommendedFocus
@src/ui/screens/SessionEndScreen.ts

# Consumer 2 of recommendedFocus (via the recommendation input field)
@src/core/agents/parentReportGenerator.ts

# Test style to mirror for the new guardrail's tests
@tests/core/personalization/difficultyGuardrails.test.ts

# Existing handleSessionEnd tests to extend
@tests/core/lessonEngine.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create the recommendedFocus guardrail pure function + unit tests</name>
  <files>src/core/personalization/recommendedFocusGuardrail.ts, tests/core/personalization/recommendedFocusGuardrail.test.ts</files>
  <behavior>
    - Valid id passthrough: a candidate that IS a key of TOPIC_LABELS (e.g. "present_continuous_now") returns unchanged, ignoring the fallback.
    - Invalid id -> fallback: a candidate that is NOT a key (e.g. the live-observed hallucinated string "present_simple_question_order with question formation in real contexts (building on the strong foundation in present continuous)") returns the caller-supplied fallback verbatim.
    - Empty string -> fallback: candidate "" returns the fallback.
    - Never throws: any string input (including whitespace, very long strings, strings containing valid-id substrings) returns a string, never an exception.
    - Fallback identity: the value returned on a miss is exactly the fallback argument, not a recomputed/substituted value.
  </behavior>
  <action>Create `src/core/personalization/recommendedFocusGuardrail.ts` exporting a single pure function `applyRecommendedFocusGuardrail(candidate: string, fallback: string): string` (PERSONAL-03, SMOKE-FIX-02). Mirror `difficultyGuardrails.ts` exactly: NO network, NO agent, NO state read/write beyond its two explicit string parameters; a JSDoc-style header comment explaining the CLAUDE.md "agent proposes, core validates before use" rationale — this is the trust gate for Progress Advisor's `recommendedFocus`, which `progressAdvisorSchema.ts` deliberately leaves as `z.string()` (unconstrained) so validation happens here in the core, not in the schema. Import `TOPIC_LABELS` from `../topics/topicLabels` and validate with `Object.prototype.hasOwnProperty.call(TOPIC_LABELS, candidate)` (or `candidate in TOPIC_LABELS`) against `Object.keys(TOPIC_LABELS)` as the single source-of-truth valid-id set — DO NOT duplicate or hardcode a second topic-id list. On a valid candidate, return it unchanged; on any miss (invalid id, empty string, free-form agent prose), return `fallback`. The function must never throw on any string input. DO NOT import `topicLabel` (the display-label mapper) — this guardrail validates ids, it does not render labels. Then create `tests/core/personalization/recommendedFocusGuardrail.test.ts` mirroring `difficultyGuardrails.test.ts`'s table-driven vitest style, covering: valid-id passthrough, the exact live-observed hallucinated string -> fallback, empty-string -> fallback, and a "never throws / always returns a string" assertion. Reference a real TOPIC_LABELS key (e.g. "present_continuous_now") for the passthrough case so the test stays coupled to the actual source-of-truth set.</action>
  <verify>
    <automated>npx vitest run tests/core/personalization/recommendedFocusGuardrail.test.ts</automated>
  </verify>
  <done>New guardrail file exists as a pure function importing TOPIC_LABELS; its unit tests pass (valid id passthrough, invalid/hallucinated id -> fallback, empty string -> fallback, never-throws). `progressAdvisorSchema.ts` is untouched (recommendedFocus still `z.string()`).</done>
</task>

<task type="auto">
  <name>Task 2: Wire the guardrail into handleSessionEnd() and extend lessonEngine tests</name>
  <files>src/core/lessonEngine.ts, tests/core/lessonEngine.test.ts</files>
  <action>In `src/core/lessonEngine.ts`, import `applyRecommendedFocusGuardrail` from `./personalization/recommendedFocusGuardrail` alongside the existing `applyDifficultyGuardrails` import. In `handleSessionEnd()`, immediately AFTER `callProgressAdvisor()` resolves (the `advisorResult` assignment) and alongside the existing `applyDifficultyGuardrails` call (Step 4), compute `const finalRecommendedFocus = applyRecommendedFocusGuardrail(advisorResult.recommendedFocus, fallbackRecommendedFocus);`. The fallback argument MUST be the SAME `fallbackRecommendedFocus` local already computed at Step 1 and passed into `callProgressAdvisor()` — do NOT compute a second/different fallback. Then replace EVERY downstream use of `advisorResult.recommendedFocus` with `finalRecommendedFocus`: (1) the `recommendation:` field of the `callParentReportGenerator({...})` input (Step 7), (2) the `recommendedFocus:` field of the `session_end` dispatch (Step 8), and (3) the `recommendedFocus:` field of the returned `SessionEndResult` (Step 9). This mirrors exactly how `finalDifficulty` (from `applyDifficultyGuardrails`) already replaces `advisorResult.suggestedDifficulty` downstream. Do NOT touch the `progressAdvisorSource`/`progressAdvisorFailed` dispatch fields (those still derive from `advisorResult.source`). Add a short comment on the new line citing PERSONAL-03 / the "agent proposes, core validates" boundary. Then in `tests/core/lessonEngine.test.ts`, inside the `"Plan 04-03: handleSessionEnd() session-end orchestration"` describe block, add a test that mocks `callProgressAdvisor` to return a hallucinated non-topic-id `recommendedFocus` (the exact live-observed mixed-language string) and asserts: (a) the `session_end` dispatch / persisted `studentProfile.lastRecommendedFocus` is the deterministic fallback (a valid topic-id or the generic "Продолжай практиковаться" string), NOT the hallucinated string; (b) the value passed as `recommendation` to `callParentReportGenerator` (via `parentReportGeneratorSpy.mock.calls[0][0].recommendation`) is that same fallback, NOT the hallucinated string; (c) the returned `SessionEndResult.recommendedFocus` is the fallback, NOT the hallucinated string. Verify existing handleSessionEnd tests still pass unchanged — they use `recommendedFocus: "present_continuous_now"` / "food_vocabulary" which ARE valid TOPIC_LABELS keys and therefore pass through the guardrail untouched, so no existing assertion should change.</action>
  <verify>
    <automated>npx vitest run tests/core/lessonEngine.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>`handleSessionEnd()` calls `applyRecommendedFocusGuardrail(advisorResult.recommendedFocus, fallbackRecommendedFocus)` and uses the result in all three downstream sites (parentReportGenerator input, session_end dispatch, return value). New test proves a hallucinated recommendedFocus is replaced by the fallback at all three sites. All existing lessonEngine tests pass unchanged. `tsc --noEmit` clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Progress Advisor agent → core | LLM-returned `recommendedFocus` (untrusted, `z.string()`-only) crosses into core state and user/parent-facing text. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-ogs-01 | Tampering | Progress Advisor `recommendedFocus` (progressAdvisorSchema.ts `z.string()`) | high | mitigate | Add `applyRecommendedFocusGuardrail` validating candidate against `Object.keys(TOPIC_LABELS)` in `handleSessionEnd()` before the value reaches SessionEndScreen or parentReportGenerator; invalid input falls back to the core's deterministic value. |
| T-ogs-02 | Information Disclosure | Hallucinated agent prose leaking into user/parent Russian text | medium | mitigate | Same guardrail: free-form/mixed-language agent strings are rejected to the fallback, so only clean validated topic-ids (rendered via `topicLabel`) surface. |
| T-ogs-SC | Tampering | npm/pip/cargo installs | high | accept | No new package installs in this task (uses existing `TOPIC_LABELS`, `zod`, `vitest`); package-legitimacy checkpoint not triggered. |
</threat_model>

<verification>
- Full suite green: `npx vitest run` (existing 258 tests + new guardrail tests + new handleSessionEnd test all pass).
- Type check clean: `npx tsc --noEmit`.
- `src/core/agents/progressAdvisorSchema.ts` unchanged (recommendedFocus still `z.string()`).
- `Lesson-1A.json` unchanged.
- No second topic-id list introduced anywhere (guardrail imports `TOPIC_LABELS`).
</verification>

<success_criteria>
- A hallucinated/free-form `recommendedFocus` from Progress Advisor is replaced by the deterministic fallback before it reaches SessionEndScreen's "Следующий фокус" line, parentReportGenerator's recommendation input, the `session_end` dispatch, and the `SessionEndResult` return.
- A valid topic-id `recommendedFocus` passes through unchanged (no behavior change for valid inputs; existing tests stay green).
- The guardrail is a pure function that never throws, mirroring `applyDifficultyGuardrails`, validating against `Object.keys(TOPIC_LABELS)`.
- The fallback used is the same `fallbackRecommendedFocus` already computed by the caller.
- Full test suite and `tsc --noEmit` pass.
</success_criteria>

<output>
Create `.planning/quick/260706-ogs-fix-missing-core-side-trust-gate-progres/260706-ogs-SUMMARY.md` when done.
</output>
