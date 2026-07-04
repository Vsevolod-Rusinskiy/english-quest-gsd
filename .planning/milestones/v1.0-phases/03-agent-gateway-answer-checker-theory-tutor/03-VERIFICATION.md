---
phase: 03-agent-gateway-answer-checker-theory-tutor
verified: 2026-07-03T08:10:00Z
status: passed
score: 4/4 roadmap success criteria verified (code-level); 1 tracking gap found and resolved post-verification
behavior_unverified: 0
overrides_applied: 0
gaps: []
deferred: []
resolved_gaps:
  - truth: "REQUIREMENTS.md accurately reflects delivered requirements for this phase"
    reason: "CHECK-03 and CHECK-04 were implemented, tested, and reviewed/fixed in the codebase (verified below), but REQUIREMENTS.md still showed both as unchecked `[ ]` items and 'Pending' in the traceability table, while RELY-01/02/03 and THEORY-03 (same phase, same plans) were correctly marked complete. Pure tracking/bookkeeping gap, not a code gap."
    resolution: "REQUIREMENTS.md lines 28-29 (checkboxes) and 123-124 (traceability table) updated to [x]/Complete for CHECK-03 and CHECK-04 after this verification ran. No code changes required — the underlying requirements were already satisfied."
---

# Phase 3: Agent Gateway, Answer Checker & Theory Tutor Verification Report

**Phase Goal:** Ambiguous text-input answers get LLM-assisted checking with a typed error, and a confused child gets a simpler theory explanation — both routed through one shared, validated trust boundary that never breaks the lesson when the agent is unavailable
**Verified:** 2026-07-03T08:10:00Z
**Status:** passed (the tracking gap noted below was resolved immediately after this report was written — see "Gaps Summary")
**Re-verification:** No — initial verification

## Goal Achievement

This verification covers the **post-review-fix** state of the codebase (commit `7cb5b90`, "fix(03): code review fixes - confidence gate (CR-02), reject ambiguous tool_use (CR-01), log gateway failures (CR-03)"), not just the original 03-01/03-02 plan execution. All code reads, test runs, and greps below were performed directly against the working tree, not inferred from SUMMARY.md prose.

### Observable Truths (ROADMAP.md Phase 3 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A text-input answer with no exact match triggers a call to the Answer Checker agent, and the child sees a verdict plus a typed `errorType` (not just right/wrong) | VERIFIED | `src/core/lessonEngine.ts:181-191` — `handleAnswer`'s text-input branch calls `checkTextInput` first; on `isCorrect:false` it `await callAnswerChecker(...)`, setting `agentAttempted = true`. `src/core/agents/answerChecker.ts:69-78` maps a successful agent response into `{isCorrect, source:"agent", errorType, confidence, hintRu}` — the 11-value enum is defined in `answerCheckerSchema.ts:11-23`. Test: `tests/core/lessonEngine.test.ts` "non-exact-match text-input answer calls callAnswerChecker and folds its errorType/source into evaluateAttempt + dispatch" passes. `src/main.ts:150-151` surfaces `result.hintRu` into the feedback banner. |
| 2 | Marking theory "не понятно" gets the child a simpler explanation from the Theory Tutor, capped at `maxSimplifyRounds`, after which the lesson moves on to practice regardless | VERIFIED | `src/core/lessonEngine.ts:89-151` `handleTheoryStep`: round 1 (`simplifyRoundCount===0`) is core-only (no agent call, serves `explanationLevels[1]`); rounds 2-3 (`count` 1 or 2) `await callTheoryTutor(...)`; once `nextCount >= maxSimplifyRounds` (3), `theoryUnderstood` is forced `true` regardless of the tap. Verified via `npx vitest run ... -t theory` (5 passed) and `tests/e2e/lessonWalkingSkeleton.test.ts` DOM-driven round-loop assertions. |
| 3 | Killing/timing out/corrupting either agent's response results in exactly one retry, then a deterministic fallback (strict comparison with `errorType: unknown` for Answer Checker; a pre-written simpler explanation for Theory Tutor) — the lesson never stalls or crashes | VERIFIED | `src/core/agents/callAgent.ts:109-128`: try → catch(retry once, no `instanceof` narrowing, confirmed via `grep -rn "instanceof"` returning only a comment, no code) → catch(return `{data: fallback, source:"core", failed:true}`, plus `console.error` logging both errors — CR-03 fix). `answerChecker.ts:80-82` fallback returns fixed `{isCorrect:false, errorType:"unknown", source:"core"}`. `theoryTutor.ts:78-83` fallback re-serves `fallbackLevel` verbatim (never fabricates), matching D-11. Retry-count assertions (`toHaveBeenCalledTimes(2)` on double-failure, `(1)` on first-try success) pass in `tests/core/agents/callAgent.test.ts`. |
| 4 | No agent JSON response is used to update state unless it first passes one shared schema+semantic validation function (same function for both agents), and every such event records whether the data came from `core` or `agent` plus whether a fallback fired | VERIFIED | Single shared `callAgent<T>()` in `callAgent.ts` is the only call path for both agents (`answerChecker.ts` and `theoryTutor.ts` both import and call it, zero duplicate validation logic). Zod `safeParse` runs even with `strict:true` (`callAgent.ts:102-105`). Post-review fix (CR-01) also rejects ambiguous/multi-`tool_use` responses (`callAgent.ts:96-101`) instead of trusting the first block — closing a real trust-boundary hole the original plan execution had missed. `exercise_attempt` and `theory_step` actions both carry `source`/`agentFailed` (`store.ts:24-25,51-52`), persisted as `lastAttemptSource`/`lastAttemptAgentFailed` on `exerciseStats` (`store.ts:99-100,116-117`) and directly on `currentPosition` for theory. Regression tests for `source`/`agentFailed` pass in `tests/core/state/store.test.ts` and `tests/core/lessonEngine.test.ts`. |

**Score:** 4/4 roadmap success criteria verified at the code level (0 present-but-behavior-unverified).

### Additional Must-Haves (PLAN frontmatter, beyond roadmap SCs)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | The full existing test suite (all e2e + core) stays green after handleAnswer/handleTheoryStep become async | VERIFIED | `npx vitest run` → **26 test files, 170 tests, all passed** (run directly in this verification, not taken from SUMMARY.md's claimed 152/166 counts — the higher count reflects the CR fix's added regression tests). |
| 6 | Agent proposes, core writes (isCorrect is never trusted unconditionally from the agent) | VERIFIED (post-fix) | `answerChecker.ts:18,70-71` — `CORRECT_CONFIDENCE_THRESHOLD = 0.8` gate added in commit `7cb5b90`; `result.data.isCorrect && result.data.confidence >= 0.8` before trusting an agent "correct" verdict. This directly closes CR-02 from `03-REVIEW.md`, which found the original 03-01/03-02 execution let the agent override a deterministically-wrong answer with zero core-side bound — a real violation of the CLAUDE.md "agent proposes, core writes" architecture constraint. Regression test: "agent says isCorrect:true with confidence below 0.8 -> core does NOT trust it" passes. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/agents/callAgent.ts` | Shared gateway (validate→retry-once→fallback) | VERIFIED | Exists, substantive (129 lines, real Zod/retry/fallback logic, no stub), wired (imported by both `answerChecker.ts` and `theoryTutor.ts`), data flows (real Anthropic client construction + real fallback data path). |
| `src/core/agents/anthropicClient.ts` | Single Anthropic client instance | VERIFIED (not re-read in full this pass, but imported and used correctly by callAgent.ts; D-03 tradeoff documented per SUMMARY) | Imported in `callAgent.ts:8`. |
| `src/core/agents/answerCheckerSchema.ts` | 11-value errorType enum + response schema | VERIFIED | Exact 11 literals present, matches SPEC.md §8.1 per plan; `z.infer` types exported. |
| `src/core/agents/answerChecker.ts` | `callAnswerChecker()` thin wrapper | VERIFIED | Maps gateway result to `CheckResult`; confidence gate present post-fix. |
| `src/core/agents/theoryTutorSchema.ts` / `theoryTutor.ts` | Theory Tutor schema + wrapper | VERIFIED | `callTheoryTutor()` re-serves `fallbackLevel` verbatim on failure — never fabricates, matching D-11. |
| `src/core/state/store.ts` | `exercise_attempt`/`theory_step` extended with `source`/`agentFailed` | VERIFIED | Both actions carry the fields; reducer honors engine-computed values (not hardcoded). |
| `src/core/lessonEngine.ts` | Async `handleAnswer`/`handleTheoryStep` | VERIFIED | Both are `async`, await agent calls in the correct branch only (D-10 — non-text-input never calls the agent, confirmed by passing test "non-text-input types (single-choice, order-builder) never call the agent (D-10)"). |
| `src/main.ts` | Async submit/theory handlers with thinking cue | VERIFIED | Both handlers disable buttons before `await`, re-enable in `finally`, unsubscribe/resubscribe around the await window. |
| `src/core/state/progressSchema.ts` | `simplifyRoundCount` required field | VERIFIED | `grep` confirms `simplifyRoundCount: z.number()` in schema and `simplifyRoundCount: 0` seeded in `initialState.ts`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `checkTextInput` isCorrect:false | `lessonEngine` text-input branch | direct call + branch on `deterministicResult.isCorrect` | WIRED | `lessonEngine.ts:175-191` |
| `lessonEngine` | `callAnswerChecker` | `await callAnswerChecker({...})` | WIRED | `lessonEngine.ts:185-190` |
| `callAnswerChecker` | `callAgent` | `await callAgent({schema: AnswerCheckerResponseSchema, ...})` | WIRED | `answerChecker.ts:58-67` |
| `callAgent` result | single `exercise_attempt` dispatch | `agentFailed = agentAttempted && result.source === "core"`, folded into one dispatch | WIRED | `lessonEngine.ts:240-253` — confirmed single-dispatch invariant preserved (no second dispatch call site added) |
| TheoryScreen "Не понятно" | `handleTheoryStep` → `callTheoryTutor` (rounds 2-3) | `await engine.handleTheoryStep(understood)` inside unsubscribe window | WIRED | `main.ts:77-100`, `lessonEngine.ts:119-136` |
| Agent output → DOM | `TheoryScreen` render | `createElement`/`textContent` only | WIRED, SAFE | `grep -n "innerHTML" src/ui/screens/TheoryScreen.ts` returns nothing (exit 1) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green | `npx vitest run` | 26 files / 170 tests passed | PASS |
| No `instanceof` narrowing in gateway catch (RELY-02 broad-catch requirement) | `grep -rn "instanceof" src/core/agents/callAgent.ts` | Only a comment reference, zero code narrowing | PASS |
| Theory round-sequencing tests | `npx vitest run ... -t theory` | 5 passed | PASS |
| CR-01/02/03 regression tests exist and pass | `grep` for `toHaveBeenCalledTimes`, `CR-02 confidence gate`, ambiguous-tool_use test names in test files | All present and passing (part of 170/170) | PASS |
| No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) in phase-modified files | grep across 10 key files | None found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CHECK-03 | 03-01 | Ambiguous text-input triggers Answer Checker, returns typed errorType | ✓ SATISFIED (code) / **TRACKING GAP** (REQUIREMENTS.md) | Code fully implements and tests this (see Truth #1). REQUIREMENTS.md line 28 still shows `[ ]` and traceability line 123 still shows "Pending" — contradicts the delivered/verified code. |
| CHECK-04 | 03-01 | Agent failure → one retry → deterministic fallback | ✓ SATISFIED (code) / **TRACKING GAP** (REQUIREMENTS.md) | Code fully implements and tests this (see Truth #3). REQUIREMENTS.md line 29 still shows `[ ]` and traceability line 124 still shows "Pending". |
| THEORY-03 | 03-02 | "Не понятно" → simpler explanation, capped, soft transition | ✓ SATISFIED | REQUIREMENTS.md correctly shows `[x]` and "Complete" — consistent with code. |
| RELY-01 | 03-01/02 | Shared Zod validation before trusting any agent response | ✓ SATISFIED | REQUIREMENTS.md correctly shows `[x]` and "Complete". |
| RELY-02 | 03-01/02 | One retry then deterministic fallback, never crashes | ✓ SATISFIED | REQUIREMENTS.md correctly shows `[x]` and "Complete". |
| RELY-03 | 03-01/02 | source/agentFailed recorded on every relevant event | ✓ SATISFIED | REQUIREMENTS.md correctly shows `[x]` and "Complete". |

**No orphaned requirements** — all 6 IDs declared across 03-01-PLAN.md and 03-02-PLAN.md frontmatter are accounted for above.

### Anti-Patterns Found

None found in phase-modified files. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers. No `innerHTML` usage. No stub `return null`/`return {}` patterns detected in the agent/lessonEngine/store/TheoryScreen/main.ts files reviewed.

**Carried forward from 03-REVIEW.md (deliberately deferred, not blockers):**

| File | Issue | Severity | Impact |
|------|-------|----------|--------|
| `src/ui/screens/TheoryScreen.ts:14` | `onUnderstoodChoice` typed `(understood: boolean) => void` but `main.ts` passes an async function; unhandled promise rejections from `handleTheoryStep` would be silent | WARNING | Documented, user-accepted deferral (WR-01 in 03-REVIEW-FIX.md); not required for Phase 3 completion per the human decision already recorded |
| `src/core/agents/callAgent.ts:61` | 8s×2 timeout budget asserted only in comments, not in a test | WARNING | Deferred (WR-02); low risk, cosmetic-doc-drift class of issue |
| `src/core/answer-checking/checkTextInput.ts:13-19` | `CheckResult` is a flat interface, not a discriminated union on `source` | WARNING | Deferred (WR-04); type-safety improvement, not a functional gap |
| `src/core/agents/theoryTutorSchema.ts:13` | `level`/`canSimplifyMore` fields validated but never consumed downstream | WARNING | Deferred (WR-06); dead schema surface, not a functional gap |

These four warnings were explicitly triaged and deferred by the user in `03-REVIEW-FIX.md` ("Skipped ... not urgent for Phase 3 completion... None block Phase 3 completion"). I am not re-litigating that human decision — they are noted here for completeness per the anti-pattern scan requirement, not re-opened as blockers.

### Human Verification Required

None required to determine phase-goal achievement — all four roadmap Success Criteria are verified via code + passing automated tests. The two manual smoke tests flagged in the SUMMARYs (`human_judgment: true` — live `npm run dev` + live LLM router call for both Answer Checker and Theory Tutor) are **UAT-style live-network checks**, not gating verification items: the deterministic fallback path (which IS gating, per CHECK-04/RELY-02) is fully covered by automated tests that simulate agent failure. These live-network checks are appropriately deferred to human UAT and do not block a `gaps_found`→resolved transition here.

### Gaps Summary

**One gap, purely in planning-artifact bookkeeping, not in code:**

`.planning/REQUIREMENTS.md` has not been updated to reflect that CHECK-03 and CHECK-04 are complete. Both requirements are fully and correctly implemented in the codebase — verified directly against `callAgent.ts`, `answerChecker.ts`, `lessonEngine.ts`, and their passing tests (see Truths #1 and #3 above) — and the code quality is arguably higher than the original plan intended, since the post-review fix (commit `7cb5b90`) closed a real trust-boundary gap (CR-01: ambiguous multi-`tool_use` responses) and a real architecture-constraint violation (CR-02: unbounded agent-trusted `isCorrect:true`) that the initial 03-01 execution had missed.

However, `REQUIREMENTS.md` lines 28-29 (checkboxes) and lines 123-124 (traceability table) still show CHECK-03/CHECK-04 as `[ ]`/"Pending" — inconsistent with RELY-01, RELY-02, RELY-03, and THEORY-03 from the exact same phase and plans, which are correctly marked `[x]`/"Complete". This is exactly the kind of tracking drift the task description asked me to flag explicitly. It is a one-line documentation fix (update 4 lines in REQUIREMENTS.md), not a re-open of any code work, and does not require a new implementation plan — but per the goal-backward gate, requirement tracking that misrepresents delivered work should not be silently waved through as `passed`.

**Recommendation:** Update REQUIREMENTS.md's CHECK-03/CHECK-04 checkboxes and traceability rows to reflect completion, then re-run verification (expected to resolve to `passed` with no further code changes needed).

**Resolved:** REQUIREMENTS.md lines 28-29 and 123-124 were updated to `[x]`/"Complete" immediately after this report was generated. No further code changes were needed — this phase is `passed`.

---

_Verified: 2026-07-03T08:10:00Z_
_Verifier: Claude (gsd-verifier)_
