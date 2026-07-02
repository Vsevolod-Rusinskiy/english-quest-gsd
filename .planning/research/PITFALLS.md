# Pitfalls Research

**Domain:** Browser-only localStorage kids' language-learning app with hybrid deterministic-core + LLM-agent architecture (English Quest)
**Researched:** 2026-07-01
**Confidence:** MEDIUM-HIGH (grounded in documented industry patterns for localStorage migration, structured-output LLM engineering, and gamification-misuse research; project-specific pitfalls are derived from SPEC.md architecture via domain reasoning, since no public case study covers this exact core+5-agent design)

## Critical Pitfalls

### Pitfall 1: No schema version on the localStorage blob from day one

**What goes wrong:**
The `english-quest-progress-v1` key is written without an internal `schemaVersion` field baked into the JSON payload itself (relying only on the key name suffix `-v1`). The first time the data model changes — a new field on `topicStats`, a renamed `rewardHistory` entry shape, a new topic status — every existing browser's saved progress silently mismatches the new code's expectations. Reads either throw, or worse, silently return `undefined` for new fields and the app behaves inconsistently (e.g., `confidenceScore` computation breaks, reward ledger totals miscalculate) without ever throwing a visible error.

**Why it happens:**
In greenfield MVPs the temptation is "we control both reader and writer, so it's fine." But this project explicitly is a diploma project that will iterate (theory levels, reward rules, topic status thresholds are all called out as evolving). A key-name-only versioning strategy (`-v1` suffix) requires cutting a *new key* and abandoning old data on every breaking change, which silently orphans the student's real progress — unacceptable for a progress-tracking app.

**How to avoid:**
- Store `{ schemaVersion: 1, data: {...} }` as the actual root JSON shape saved under the key, independent of the key name.
- Write a single `migrate(rawParsed) -> currentShapeObject` pipeline that runs sequential migration steps (`v1→v2`, `v2→v3`, ...) on load, before any other code touches the object.
- Always parse defensively: wrap `JSON.parse` + migration in try/catch; on any failure, do not crash the lesson — fall back to a fresh empty profile and surface a non-blocking "we couldn't restore your last progress" state rather than a white screen.
- Provide default values for every field read from storage (never assume a field exists just because the schema says it should).

**Warning signs:**
- Code exists that reads `progress.topicStats[topicId].correctCount` without a fallback (`?? 0`) anywhere.
- Only one shape of the localStorage object has ever existed during development — no migration path has been exercised even once.
- `JSON.parse(localStorage.getItem(...))` is called in more than one place instead of through a single storage-access module.

**Phase to address:**
Core data-layer / storage phase (early, before any feature writes to `localStorage`). Must exist before the first `exercise_attempt` event handler is built, since every subsequent phase (rewards, reviewQueue, progress advisor) writes to this store.

---

### Pitfall 2: Trusting LLM JSON output structurally without validating semantics/ranges

**What goes wrong:**
The team implements JSON-schema/type validation (is `isCorrect` a boolean, is `errorType` a string) and treats that as "validated," then lets the agent's output flow into state. But structural validity is not semantic validity: an agent can return well-formed JSON with `errorType: "wrong_tense"` for an answer that's actually just a spelling mistake, or a `suggestedDifficulty: "challenge"` recommendation seconds after two consecutive wrong answers, or a `looksLikeSpam: true` flag on a legitimate slow typer. Because the core is designed to "record what the agent proposes" for judgment fields, weak semantic guardrails let bad agent judgment leak into `topicStats`/rewards even though the JSON was technically "valid."

**Why it happens:**
Schema validation (right shape, right enum, right types) is easy to build and gives false confidence that "the agent is handled." The harder problem — bounding what values are *plausible* given the surrounding context — requires the core to re-derive or sanity-check the agent's judgment, which is more work and easy to skip under deadline pressure. Anthropic's own tool-use `strict` mode is best-effort, not a guarantee, reinforcing that schema conformance and correctness are separate concerns.

**How to avoid:**
- Validate structure AND range/enum membership (`errorType` must be one of the 11 listed values, `suggestedDifficulty` one of `easy/normal/challenge`, `confidence` a number in `[0,1]`) — reject and fall back on any violation, don't coerce or guess.
- For every "agent proposes, core decides" field described in SPEC §6, implement the actual core-side guard rule before wiring the agent, so the guard exists independently of whether the agent is well-behaved: e.g., `difficultyMode` transitions are only permitted through the state machine in §12 (no direct jump easy→challenge, only between lessons, only after the 3-correct / 2-wrong thresholds) — the core must reject/ignore an agent's suggestion that violates this regardless of what JSON it returns.
- Treat `confidence` from Answer Checker as informational only unless a phase explicitly defines a threshold behavior for it — don't let a stray "high confidence, wrong verdict" flip a correct answer to incorrect without a fallback path.
- Log every case where the agent's proposal was overridden/rejected by the core guard — these logs are your regression signal that prompts need tuning.

**Warning signs:**
- Core code that does `topicStatus = agentResponse.suggestedStatus` (assignment) rather than `topicStatus = applyStatusRules(currentStatus, agentResponse)` (guarded transition).
- No unit tests exist that feed the core an *adversarial but schema-valid* agent response (e.g. `suggestedDifficulty: "challenge"` right after 2 wrong answers) and assert the core clamps it.
- Reward or difficulty state changes happen in the same code path that parses the agent JSON, rather than a separate "apply" function that's agent-agnostic.

**Phase to address:**
Each agent-integration phase (Answer Checker, Progress Advisor, Reward Advisor) individually — the guard rules belong to the *core* and should be built and unit-tested against fixture JSON before the real agent call is wired in, so the guard is proven independent of live LLM behavior.

---

### Pitfall 3: Retry-once + fallback logic that isn't idempotent or doesn't distinguish error types

**What goes wrong:**
"One retry, then fallback" sounds simple but two subtle bugs are extremely common: (1) the retry re-triggers a side effect (e.g., a reward event is logged, or a `topicStats` counter increments) before the retry/fallback decision is finalized, causing double-counted attempts or duplicate reward ledger entries when the first call actually succeeded but was slow/timed-out client-side; (2) all failure types (malformed JSON, HTTP timeout, network offline, rate limit, refusal) are treated identically, when actually a malformed-JSON failure might benefit from a repair retry with a shorter/stricter prompt, while a timeout/offline failure should skip straight to fallback without wasting the retry budget on a call that will time out again.

**Why it happens:**
The SPEC's fallback rule is deliberately simple ("один повтор → детерминированный fallback") for MVP scope discipline — good instinct, but "one retry" is easy to implement naively as "call the same function again" without separating the *decision to retry* from the *side effects of a successful call*. Under real network conditions (mobile browser, flaky wifi — realistic for a kid using this at home), a slow-but-eventually-successful first call can race with the retry logic if not awaited/cancelled properly.

**How to avoid:**
- Structure agent calls as pure functions returning a result (never writing to `localStorage` or emitting `exercise_attempt` events directly) — only the caller, after receiving a validated result (agent OR fallback), performs the single write. This makes retries safe to implement naively without double-write risk.
- Classify failures at the call site: JSON-parse failure → retry once with the same request (or a repair nudge); network/timeout/5xx → do not retry, go straight to deterministic fallback (retrying a timeout just burns the lesson's perceived responsiveness for a child who is waiting).
- Set an aggressive client-side timeout (a few seconds) tuned to "kid attention span," not "typical API SLA" — a 10-second hang before falling back will read as "broken" to a child, even though it's within normal LLM latency norms.
- Always record `source: "core" | "agent"` and a `fallbackReason` in the event log (SPEC §14 already requires this) — treat this as a first-class debug signal, not an afterthought field.

**Warning signs:**
- The retry call is literally `await callAgent(input)` wrapped in a loop with no distinction between error types.
- No test exists that simulates "agent times out" vs "agent returns garbage" vs "agent returns valid-but-wrong-enum JSON" as three separate cases with three separate expected behaviors.
- The reward ledger or attempt counter can be observed to increment twice for a single child action during manual testing with a throttled/offline network tab.

**Phase to address:**
The agent-integration architecture phase that establishes the shared "call agent → validate → fallback" wrapper used by all 5 agents (should be built once, reused 5 times, not reimplemented per agent). Verify with a chaos/offline manual test pass before the lesson-flow phase is marked done.

---

### Pitfall 4: Reward rules that look farm-proof individually but compose into a loophole

**What goes wrong:**
SPEC §10 fixed amounts + per-exercise limits are a good instinct, but composability gaps are where farming happens in practice: e.g., if `fixed_mistake` (+4₽) can be triggered by *deliberately* answering wrong first (to bank `honest_attempt` +1₽) and then correcting on a hint (`correct_after_hint` +3₽, since it's "mutually exclusive with first_try_correct" not with fixed_mistake) — a child (or, more likely, a curious child probing the system, which is developmentally normal and should be expected) discovers that "wrong then hint then fix" nets more ₽ than answering correctly on the first try in some accounting of the rules, if the exclusivity list isn't complete. Similarly, if `reviewQueue` re-presents the *same* exercise the child already banked rewards on, and the reward engine doesn't check "already rewarded for this exerciseId this session/ever," review becomes a reward-farming loop rather than genuine reteaching.

**Why it happens:**
Reward rules are usually designed and reviewed one-at-a-time against "does this rule make sense in isolation," not against "what's the maximum ₽ a child can extract from one exercise via any sequence of interactions." This is the same failure mode documented broadly in gamification research: users "check in without reading," "click through without learning," exploiting mechanics rather than engaging with content, and poorly-tuned point systems reward the wrong behaviors.

**How to avoid:**
- Before implementing, write out the *complete* per-exercise reward state machine as a table: every reachable sequence of (attempt outcome, hint used, streak state) mapped to a total ₽ payout, and manually verify the maximum achievable ₽ per exercise across all sequences is bounded and monotonically non-increasing in "number of wrong attempts" (more mistakes should never yield strictly more reward than fewer mistakes, or the incentive is inverted).
- Make the "1 раз/задание" limit enforcement live in a single core function keyed by `(exerciseId, reasonCode)` pairs checked against the ledger — not scattered `if` checks — so it's provably impossible to double-award by construction, not by convention.
- For `reviewQueue` specifically: rewards for a review-repeat of an exercise should be at most the delta rewards for *newly* fixing a previously-wrong topic (`weak_topic_closed`), not a re-run of `first_try_correct`/`honest_attempt` on the same `exerciseId`. Gate this explicitly: check `rewardHistory` for prior `exerciseId` reward events before applying attempt-based rewards again.
- Treat Reward Advisor's `looksLikeSpam`/`honestAttempt` flags as an additional signal, not the only line of defense — the deterministic ledger-lookup guard must hold even if the agent's spam detection fails or is unavailable (fallback path).

**Warning signs:**
- No single test exists that plays "wrong → wrong → hint → correct → repeat exercise in review → correct" through the reward engine and asserts a specific bounded ₽ total.
- The per-exercise reward limit is implemented as a boolean flag on the exercise-attempt object rather than a query against the immutable `rewardHistory` ledger (flags can be reset/duplicated across sessions if state is rebuilt from partial data; the ledger is the source of truth).
- `reviewQueue` completions and first-pass completions share the exact same reward code path with no distinction.

**Phase to address:**
Reward system phase — write the exhaustive reward-sequence table as a design artifact *before* coding, and turn it directly into test cases. Cross-check against the `reviewQueue` phase once both exist, since the loophole is specifically at their intersection.

---

### Pitfall 5: Difficulty-mode thrashing from over-eager or noisy adaptive signals

**What goes wrong:**
Even with SPEC §12's stated guardrails (no direct easy→challenge jump, change only between lessons, up after 3-correct-streak, down after 2 errors or fatigue), thrashing can still occur *across* lessons/sessions if the "3 correct in a row" and "2 errors" triggers are evaluated independently without hysteresis: a child who alternates between a strong topic (grammar) and a weak one (new vocabulary) within the same lesson can trip the up-trigger and the down-trigger within the same session, and if `difficultyMode` is written on every trigger rather than resolved once at lesson-end, the *next* lesson's opening difficulty becomes essentially the outcome of "whichever trigger fired last," not a stable read of overall ability. This produces a visible symptom: the child gets bounced between easy and challenge content lesson-to-lesson in a way that feels random rather than responsive, which is worse for a child's confidence than a slightly-wrong-but-stable difficulty.

**Why it happens:**
Adaptive-difficulty guardrails are usually specified as *transition rules* (what triggers a level change) but not as *aggregation rules* (what happens when multiple trigger conditions are true within one evaluation window). Without an explicit "resolve conflicting signals" step, the last-write-wins default behavior of most state-update code silently produces thrashing even though every individual transition rule was respected.

**How to avoid:**
- Evaluate `difficultyMode` transitions exactly once per lesson (at lesson-end, per SPEC "менять только между уроками"), never mid-lesson, and compute the trigger from the *whole-lesson* aggregate (overall correct-streak and overall error count for the session), not from whichever topic's counters last updated.
- If both an up-signal and a down-signal are present at lesson-end (mixed performance across topics), define an explicit tie-break (e.g., default to "hold current level" rather than either move) — do not let code path order decide.
- Persist the *reason* for a difficulty change (`lastDifficultyChangeReason`, `lastDifficultyChangeAt`) alongside `difficultyMode` so thrashing is observable in the data (rapid alternation becomes visible in `lessonHistory` review, not just anecdotally).
- Consider a minimum "dwell time" (e.g., cannot change difficulty in two consecutive lessons) if early manual testing shows oscillation — cheap to add, prevents visible whiplash.

**Warning signs:**
- `difficultyMode` is written inside the per-exercise/per-answer event handler rather than a single lesson-end finalize step.
- No aggregate "session correct streak" / "session error count" distinct from per-topic counters exists in the data model.
- Manual playtesting with a deliberately mixed-performance script (alternate right/wrong across topics) produces a difficulty flip within a single lesson.

**Phase to address:**
Progress/personalization phase (Progress Advisor + `studentProfile.difficultyMode` logic). Verify with a scripted mixed-performance manual test before considering the phase done — this is exactly the kind of edge case that looks fine with "always improving" or "always struggling" test data but breaks with realistic mixed results.

---

### Pitfall 6: Text-answer normalization that's either too strict (frustrates a real Intermediate learner) or too loose (masks the exact grammar error being taught)

**What goes wrong:**
This lesson is specifically teaching present simple vs. continuous, action/non-action verbs, third-person -s, and article usage (SPEC §5, §8 errorType list). A normalization pass that's too aggressive — e.g., stripping/ignoring articles, collapsing verb-form differences, or accepting anything within a small edit-distance — will silently mark `"she go to work"` or `"I am liking pizza"` as correct because it's "close enough" to the accepted string, defeating the exact pedagogical point of the exercise (these are precisely the target grammar errors, not typos to be tolerant of). Conversely, normalization that's too strict (only lowercase+trim+strip final punctuation, per SPEC §7) but with an incomplete `acceptedAnswers` list will reject legitimately correct answers with harmless variation (contractions: `"doesn't"` vs `"does not"`; extra internal whitespace; smart quotes from mobile keyboards; British vs. American spelling if in vocabulary) as wrong, forcing every one of those into the Answer Checker LLM path — which adds latency and cost for cases that should have been free, and risks inconsistent verdicts (Pitfall 2/3) for what are actually unambiguous cases.

**Why it happens:**
"Normalization" and "fuzzy/tolerant matching" get conflated. The SPEC correctly separates them (§7: normalize losslessly — case/whitespace/final punctuation only — then exact-compare against `acceptedAnswers`; anything else goes to the agent), but the risk is in *lesson-data authoring*, not core logic: if `acceptedAnswers` arrays in `Lesson-1A.json` are incomplete (missing common correct variants), the exact-match core silently routes too many genuinely-correct-but-unlisted answers to the LLM agent, and if the agent's fallback (strict compare, same list) is reached, correct-but-unlisted answers get marked wrong with zero recourse.

**How to avoid:**
- Keep normalization strictly lossless and grammar-preserving (lowercase, trim, collapse whitespace, strip trailing punctuation only, per SPEC §7) — never stem/lemmatize, never fuzzy/edit-distance match at the core layer for grammar-target exercises, since edit-distance cannot distinguish "typo" from "wrong verb form" (e.g., "go"→"goes" and "go"→"gp" are both edit-distance 1, but only one is the taught error).
- Treat `acceptedAnswers` completeness as a content-QA task, not a code task: for each `text-input` exercise, explicitly enumerate contractions, common correct word-order variants, and (if in scope) both spelling variants, before shipping the lesson data — this is cheaper and more reliable than trying to make the matching algorithm smarter.
- Let the Answer Checker agent's `errorType` taxonomy (already well-designed in SPEC §8: typo vs wrong_tense vs missed_article vs non_action_verb_in_continuous, etc.) do the pedagogically-important discrimination — that's precisely why an LLM is used here instead of naive fuzzy string matching, so don't undermine it by pre-filtering with fuzzy logic at the core layer.
- Add a small, explicit "harmless variants" normalization step only for things that are unambiguously not part of what's being taught in this unit (smart-quote/curly-quote to straight-quote conversion, multiple exclamation marks) — keep this list short and reviewed, not a general fuzzy-match fallback.

**Warning signs:**
- Any use of Levenshtein/edit-distance or a fuzzy-matching library at the core comparison layer before the agent is invoked.
- `Lesson-1A.json` exercises where `acceptedAnswers` has only one entry for an exercise that plausibly has multiple correct phrasings (e.g., contractions).
- Manual testing shows a deliberately-wrong grammar answer (wrong tense) being accepted as correct, or a legitimately correct but differently-punctuated/contracted answer routinely falling through to the agent (high agent-call rate on `text-input` exercises is itself a signal that `acceptedAnswers` is incomplete).

**Phase to address:**
Answer-checking core logic phase (normalization + exact match) AND lesson-content authoring/QA (since `Lesson-1A.json` is fixed input, not generated — SPEC §5). Both need sign-off: code review confirms lossless-only normalization; content review confirms `acceptedAnswers` completeness for every `text-input` exercise.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Skip `schemaVersion` field, rely on key-name (`-v1`) only | Saves an hour of migration-scaffolding work | Any future data-model change silently orphans real student progress with no upgrade path | Never — this is a single-key, single-source-of-truth store; the cost of adding version+migration scaffolding now is trivial compared to retrofitting it after users have real progress saved |
| Let agents write numeric fields directly "just this once" to unblock a demo | Faster to wire up a working agent call | Breaks the core architectural guarantee ("agent proposes, core decides") that's explicitly called out as a graded/evaluated aspect of this diploma project | Never in this project — it undermines the stated Core Value |
| Use a generic fuzzy-match library for all `text-input` answer checking instead of exact-match + LLM fallback | Fewer agent calls, feels "smarter" out of the box | Masks exactly the grammar errors (tense, articles, non-action verbs) this unit is designed to teach and assess | Never for grammar-target exercises; could be acceptable much later for pure vocabulary spelling-tolerance if explicitly scoped post-MVP |
| Single retry with no error-type classification (retry everything the same way) | Simple, ships fast | Wastes the retry budget on failures that will never succeed (timeouts, offline), making the child wait longer before fallback than necessary | Acceptable only as an MVP first pass if the timeout is kept short (a few seconds) and error-type classification is a fast-follow before broader testing |
| Evaluate difficulty-mode transitions per-exercise instead of per-lesson | Slightly simpler code, no need to aggregate session state | Produces mid-lesson thrashing and unstable next-lesson difficulty | Never — SPEC already specifies "between lessons only," so this is a spec-conformance issue, not just a nice-to-have |
| Reward-ledger checks implemented as ad hoc booleans on the exercise object instead of ledger queries | Fewer lines of code initially | Reward limits become bypassable if state is ever partially reconstructed or if a new reward reason is added without updating every ad hoc flag | Acceptable only if there is exactly one reward reason total; not acceptable with 6 reward reasons and a `reviewQueue` interacting with the same exercises |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Claude API (Answer Checker / Progress Advisor / Reward Advisor / Parent Report / Theory Tutor) | Assuming `strict`/schema-constrained tool-use output guarantees valid JSON, skipping app-level validation | Always validate the parsed JSON with your own schema/enum checks in-app (Zod/manual) regardless of provider-side "strict" flags — provider schema conformance is best-effort, not a contract |
| Claude API | One shared "call the agent" function reused across all 5 agents without distinguishing which failures are retryable (malformed JSON) vs not (timeout/network) | Centralize the call+validate+fallback wrapper, but parameterize failure-classification so timeouts skip retry and go straight to fallback, while parse failures get one repair retry |
| Claude API | No client-side timeout set (relying on default SDK/browser timeout), so a slow response hangs the lesson UI for many seconds | Set an explicit short timeout tuned to child attention span (low single-digit seconds) and treat timeout as an immediate fallback trigger |
| Claude API | Sending full lesson JSON or full progress history as agent input "to be safe" | Send only the minimal fields each agent's contract requires (SPEC §8 already scopes inputs tightly per agent) — smaller inputs are faster, cheaper, and reduce the chance of the model latching onto irrelevant context |
| localStorage | Writing on every keystroke/state change without any batching, causing frequent synchronous main-thread blocking | Batch writes to significant events (`exercise_attempt` completion, lesson-end) rather than every intermediate UI state change |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Re-serializing and writing the entire `localStorage` blob on every single field update | Noticeable UI jank/frame drops during rapid exercise answering, since localStorage writes are synchronous and block the main thread | Write on discrete event boundaries (post-answer, post-lesson) rather than on every micro-state change; keep the blob reasonably small (this MVP's single-lesson, single-student scope keeps this low-risk, but the pattern should still be correct) | Becomes noticeable once `lessonHistory`/`rewardHistory` accumulate many lessons' worth of entries in one blob with no pruning |
| Unbounded growth of `rewardHistory` / `lessonHistory` arrays with no cap or archiving | Slower JSON parse/stringify on every load/save as history grows across many sessions | Not critical for a single-lesson MVP, but note it as a known limitation; consider capping or summarizing history if multi-lesson usage is added post-MVP | Becomes relevant once the app is used across many lessons/weeks (post-MVP scope, per SPEC "несколько уроков" not in v1, but `lessonHistory` is already structured to grow indefinitely) |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating LLM output as safe to render as raw HTML in the child/parent UI | Even though this app has no external user-generated input reaching the LLM (inputs are the child's own answers + fixed lesson data), a compromised or unusual LLM response containing markup could still cause rendering issues if injected via `innerHTML` | Always render agent-generated text (`explanationRu`, `parentReportRu`, `celebrationRu`, `hintRu`) as text content, never via `innerHTML`, even though the trust boundary is low-risk here |
| Storing an API key for the LLM provider in client-side code because "it's a browser-only MVP with no backend" | Since SPEC explicitly states no backend and calls happen from the browser, any embedded API key is fully exposed to anyone who opens dev tools — for a diploma/demo project this may be an accepted, explicit tradeoff, but it must be a conscious decision, not an oversight | Explicitly document this as a known MVP limitation (e.g., use a heavily-restricted/low-quota key, or a thin serverless proxy if even minimal backend is later deemed acceptable) rather than silently shipping a exposed production-scale key |
| Letting the child's free-text `text-input` answer flow into the Answer Checker LLM prompt without any sanitization of prompt-structure characters | Low risk given the target user (a child doing English exercises) and narrow domain, but a curious child typing something like ignoring-instructions text is not impossible | Keep the agent's system/instruction framing separate from user input in the prompt structure (standard prompt hygiene), and rely on the core's post-validation guard (Pitfall 2) as the real safety net regardless of what the child types |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Fallback responses that are visibly generic/robotic when the agent is unavailable | Child notices the "magic" broke ("почему рубин не хвалит меня") — erodes trust and engagement, and defeats the personalization value proposition | Author fallback copy with the same warm, encouraging tone as the intended agent output (SPEC's Theory Tutor and Parent Report Generator fallbacks are explicitly pre-written for exactly this reason — hold every agent's fallback text to the same bar) |
| Loading/thinking states with no feedback while waiting on an agent call | A multi-second silent pause after "Проверить" reads as broken to a child, who may click repeatedly (triggering duplicate submissions — ties into Pitfall 3) | Show an immediate, kid-friendly "thinking" state the instant the check begins, and disable the submit control until a verdict (agent or fallback) resolves |
| Punishing-feeling wrong-answer states despite SPEC's explicit "error isn't punished" design intent | If the visual/copy treatment of an incorrect answer looks harsh (red X, negative sound) while the reward system simultaneously says "mistakes aren't punished," the UX contradicts the underlying design philosophy and can discourage honest attempts | Keep wrong-answer UI calm and encouraging per SPEC §15 ("спокойная подсказка"), consistent with the reward philosophy that rewards honest attempts regardless of correctness |
| Difficulty or focus changing without the child (or parent) ever being told why | A child bounced to "challenge" content with no signal feels arbitrarily harder; a parent report showing "рекомендация" with no visible link to what changed feels opaque | Surface a short, simple explanation when difficulty changes ("сложность выросла, потому что 3 верных подряд!") sourced from the same `lastDifficultyChangeReason` data recommended in Pitfall 5 |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **localStorage persistence:** Often missing a tested migration path — verify by manually editing a saved blob to an "old shape" and confirming the app still loads without data loss or crash, not just confirming "save then reload in the same session works."
- [ ] **Agent fallback paths:** Often only tested by mocking "agent returns error," not "agent returns valid-looking-but-semantically-wrong JSON" — verify by feeding the core a schema-valid but logically-adversarial agent response (e.g., `suggestedDifficulty: challenge` after 2 wrong answers) and confirming the core guard rejects/clamps it.
- [ ] **Reward limits:** Often verified only for the "happy path" (one correct answer, one reward) — verify by scripting the full wrong→hint→correct→review-repeat sequence per exercise and asserting total ₽ is bounded as designed.
- [ ] **Difficulty adaptation:** Often verified only with monotonic test data (always improving or always struggling) — verify with a mixed-performance script (alternating right/wrong across topics within one lesson) and confirm no mid-lesson difficulty change occurs and next-lesson difficulty is a stable, explainable outcome.
- [ ] **Answer normalization:** Often verified only with the exact strings from `acceptedAnswers` — verify by testing common real variants (contractions, extra whitespace, trailing punctuation, smart quotes) against every `text-input` exercise and confirming acceptance without unnecessary agent calls, while confirming actual grammar mistakes (wrong tense, missing article) are still correctly caught, not fuzzy-matched away.
- [ ] **Retry-once semantics:** Often verified only with "agent down entirely" — verify by simulating slow-but-eventually-successful responses (to catch race conditions between retry and a delayed original response) and by simulating malformed-JSON-then-success-on-retry as a distinct case from timeout-then-fallback.
- [ ] **Parent report:** Often looks complete with placeholder data but not verified end-to-end against a real fallback trigger — verify the parent-facing report renders correctly and reads naturally when Parent Report Generator's fallback template path is the one actually used, not just the LLM-generated path.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Missing schemaVersion discovered after data model already changed once | MEDIUM | Introduce `schemaVersion: 1` retroactively as "implicit v1" for any blob lacking the field, write a v1→v2 migration for the change already made, and add regression tests covering both the implicit-v1 and explicit-v1 input shapes |
| Reward loophole discovered after users have already farmed it | MEDIUM | Cap/clamp future reward events going forward (don't retroactively claw back already-awarded ₽, which would feel punitive to a child); patch the guard; add the missing sequence to the reward-sequence test table so it can't regress |
| Difficulty thrashing observed in testing | LOW | Add the "resolve at lesson-end from session aggregate, not per-exercise" fix (Pitfall 5) and optionally a minimum dwell-time; this is a logic fix, not a data-migration issue, so it's cheap to correct before ship |
| Over-loose normalization found to be masking real grammar errors | LOW–MEDIUM | Tighten the core comparison back to lossless-only normalization, audit which `text-input` exercises had "false accepts," and backfill `acceptedAnswers` completeness for genuinely-correct variants that were incorrectly relying on fuzzy tolerance |
| Agent output found flowing into state unguarded (Pitfall 2 realized) | MEDIUM–HIGH | Requires an architecture-level fix: introduce the missing "apply" guard function between agent-response-parsing and state-write for the affected agent, add adversarial fixture tests, and audit `rewardHistory`/`topicStats` for any values that need manual correction from before the guard existed |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| No schemaVersion / migration path | Storage/data-layer phase (foundational, before any feature writes progress) | Manually mutate a saved blob to simulate an older shape; confirm app loads via migration without data loss or crash |
| Structurally-valid-but-semantically-wrong agent output trusted | Each agent-integration phase (Answer Checker, Progress Advisor, Reward Advisor) | Unit tests feed adversarial-but-schema-valid fixture JSON through the core guard and assert rejection/clamping, independent of live LLM calls |
| Retry/fallback not idempotent or not error-type-aware | Shared agent-call wrapper phase (built once, used by all 5 agents) | Simulate timeout, malformed JSON, and slow-but-eventually-successful responses as three distinct test cases with three distinct expected behaviors; manual offline/throttled-network test pass |
| Reward rules composable into a farming loophole | Reward system phase, cross-checked against reviewQueue phase | Exhaustive reward-sequence table turned into test cases; scripted wrong→hint→correct→review-repeat sequence asserts bounded total ₽ |
| Difficulty-mode thrashing from per-exercise (not per-lesson) evaluation | Progress/personalization phase (Progress Advisor + `difficultyMode`) | Scripted mixed-performance manual test (alternating right/wrong across topics) confirms no mid-lesson flip and stable, explainable next-lesson difficulty |
| Normalization too loose (masks grammar errors) or too strict (rejects valid variants) | Answer-checking core logic phase + lesson-content authoring/QA for `Lesson-1A.json` | Code review confirms lossless-only normalization (no fuzzy/edit-distance at core layer); content review confirms `acceptedAnswers` completeness per exercise; manual test confirms deliberate grammar errors are still caught |

## Sources

- [3 Hidden Dangers of LocalStorage in 2025](https://medium.com/@diyasanjaysatpute147/3-hidden-dangers-of-localstorage-in-2025-that-no-one-warned-you-about-54790f33e86b) — localStorage synchronous main-thread blocking, migration-miss risk
- [Simple frontend data migration — Jan Monschke](https://janmonschke.com/simple-frontend-data-migration/) — schemaVersion + sequential migration function pattern
- [Pro tips using localStorage — Medium](https://medium.com/@mohamedelayadi/pro-tips-using-localstorage-51931f40f0be) — centralized storage wrapper, default-value-on-read practice
- [LLM output validation: 5 patterns that actually work in production](https://dev.to/ayinedjimi-consultants/llm-output-validation-5-patterns-that-actually-work-in-production-1edi) — schema validity vs semantic accuracy distinction, retry-by-error-type strategy
- [Beyond JSON Mode: Getting Reliable Structured Outputs from LLMs in Production](https://tianpan.co/blog/2025-10-29-structured-outputs-llm-production) — Claude tool-use `strict` best-effort caveat, app-level validation necessity
- [LLM Structured Output in 2026 — DEV Community](https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk) — refusals/truncation/enum-confusion edge cases in production
- [When Gamification Spoils Your Learning: A Qualitative Case Study of Gamification Misuse in a Language-Learning App (arXiv 2203.16175)](https://arxiv.org/abs/2203.16175) — users fixating on gamification mechanics over learning, "rewards for playing rather than learning" pattern
- [Gamification mistakes to avoid — xtremepush](https://www.xtremepush.com/blog/gamification-mistakes-point-systems-fail) — rewards not tied to task difficulty create exploitable loopholes; too-frequent rewards lose motivational value
- [Duolingo's Shallow Learning Trap — DEV Community](https://dev.to/yaptech/duolingos-shallow-learning-trap-gamified-streaks-harmful-habits-4134) — poorly-tuned point systems reward wrong behaviors, low-effort recall illusion of mastery
- [The Non-Determinism of Small LLMs (arXiv 2509.09705)](https://arxiv.org/pdf/2509.09705) — LLM answer-consistency limitations relevant to Answer Checker/Progress Advisor reliability assumptions
- [Fuzzy matching algorithms explained — Match Data Studio](https://match-data.studio/blog/fuzzy-matching-algorithms-explained/) — edit-distance cutoff tradeoffs (stricter reduces false positives but misses variants; looser needs stronger validation)
- Domain reasoning grounded directly in `/Users/vsevolodrusinskiy/My-folder/Development/English-Quest-gsd/SPEC.md` §§6, 7, 9, 10, 12, 14 (core/agent boundary, reward rules, difficulty guardrails, fallback contract) — no public case study exists for this exact architecture, so agent-boundary and reward-composition pitfalls are derived via first-principles analysis of the specified design rather than cited external post-mortems

---
*Pitfalls research for: English Quest — browser-only, localStorage-persisted, hybrid deterministic-core + 5-agent kids' English-learning MVP*
*Researched: 2026-07-01*
