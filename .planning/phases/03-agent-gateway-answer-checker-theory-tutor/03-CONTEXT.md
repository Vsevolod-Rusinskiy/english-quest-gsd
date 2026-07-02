# Phase 3: Agent Gateway, Answer Checker & Theory Tutor - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the **first live LLM calls** in the project: a shared Agent Gateway trust boundary (validate → retry-once → fallback), and the first two agents built on top of it — **Answer Checker** (ambiguous `text-input` verdicts) and **Theory Tutor** (progressive theory simplification, capped at `maxSimplifyRounds`). Progress Advisor, Reward Advisor, and Parent Report Generator (Phase 4) reuse this same gateway but are out of scope here.

</domain>

<decisions>
## Implementation Decisions

This discussion was NOT fully `--auto` — the LLM provider/key-handling decision has real financial/security stakes (a live API key, a third-party router) and was explicitly discussed with the user rather than silently auto-selected. Remaining implementation-detail gray areas were auto-resolved.

### LLM Provider & Key Handling

- **D-01 [informational]:** The user does not have a direct Anthropic API key — they have a key for a third-party OpenAI/Anthropic-compatible router at `https://api.llmrouter.ru` (billed against their existing paid LLM access, not a new Anthropic account). Verified live via curl during this discussion:
  - `GET /v1/models` → OpenAI-style `{"object":"list","data":[...]}`, includes `claude-haiku-4-5`.
  - `POST /v1/messages` with `x-api-key` + `anthropic-version: 2023-06-01` → **native Anthropic Messages API response shape**, real model reply confirmed.
  - Forced strict tool use (`tool_choice: {type:"tool", name:...}`) → returned exactly the requested JSON schema shape, confirmed working through this router.
  - **Conclusion:** `@anthropic-ai/sdk` works unmodified against this router — only the `baseURL` changes from Anthropic's default. No new SDK, no OpenAI-compatibility shim needed.
- **D-02:** Model for both agents: `claude-haiku-4-5` (matches STACK.md's original Haiku-4.5 recommendation; confirmed present on the router).
- **D-03:** Key handling: **direct browser call, key injected via Vite env var at build time** (`.env`, gitignored, loaded via `import.meta.env.VITE_LLM_API_KEY` / `VITE_LLM_BASE_URL`). This is the "bring your own key" scoped tradeoff from STACK.md, explicitly chosen over deploying a Cloudflare Workers proxy because:
  - The project has no backend by design (SPEC.md constraint) and the user has no existing Cloudflare setup.
  - **Explicit scope boundary the user confirmed and must remember:** this is safe for **local `npm run dev` use and in-person diploma defense demos only**. The key ends up in the built JS bundle — if `dist/` is ever deployed to a public URL (Netlify/Vercel/GitHub Pages/etc.), anyone can extract the key from devtools/network tab and spend the user's router balance. Do **not** deploy this build publicly without first switching to a proxy (Cloudflare Workers or equivalent) — that swap only changes where the key lives, not the agent-calling logic itself.
- **D-04 [informational]:** `.env` (with the real key) already exists locally, is gitignored (`.gitignore` updated this session), and was filled in directly by the user — the key itself never appeared in this conversation in usable form.

### Agent Gateway Design

- **D-05:** One shared `callAgent()` function (the Agent Gateway) used by both Answer Checker and Theory Tutor (and reused by Phase 4's 3 remaining agents later) — not five separate bespoke integrations. Responsibilities: build the strict-tool-use request, call the LLM client, **Zod-validate the tool_use response before trusting it** (defense in depth — never trust the network even though strict tool use already constrains the shape), enforce **exactly one retry** on failure, fall through to the caller-supplied deterministic fallback if the retry also fails, and return a uniform `{ source: "core" | "agent", ...verdict }` shape plus a failure flag for event logging (RELY-03).
- **D-06:** Retry semantics: **one immediate retry**, no artificial backoff/delay (a child is waiting for feedback; this is a narrow single-shot call, not a long-running job). Failure classes that trigger retry-then-fallback: malformed/non-parsing JSON, Zod validation failure (schema-valid-but-wrong-shape), network error, and timeout.
- **D-07:** Request timeout: **8 seconds** per attempt (not spec'd numerically anywhere; chosen as a reasonable child-attention-span-appropriate ceiling — long enough for a real Haiku call to complete, short enough that a hung request doesn't stall the lesson for more than ~16s worst case across both attempts).
- **D-08:** Every agent-call event (success, retry, fallback) is recorded with `source: "core" | "agent"` and a boolean failure flag, per RELY-03 — this rides on the same event/dispatch path Phase 1/2 already established (`exercise_attempt`-style events), not a new parallel logging mechanism.

### Answer Checker Integration

- **D-09:** Trigger condition (CHECK-03): `checkTextInput`'s current `CheckResult` contract (`{ isCorrect: boolean; source: "core" }`) is extended — an exact-match failure (`isCorrect: false` from the current deterministic pass) is no longer immediately final. It becomes the trigger to call Answer Checker via the gateway. The extended `CheckResult` gains `errorType` (SPEC.md §8's enum: typo/wrong_word/wrong_order/missed_article/wrong_tense/non_action_verb_in_continuous/wrong_question_order/missing_auxiliary/spelling_third_person_s/spelling_ing_form/unknown), `confidence`, and `hintRu` fields — populated by the agent on success, or a fixed fallback shape (`isCorrect: false, errorType: "unknown"`, no confidence/hint) per SPEC.md §8.1's documented fallback.
- **D-10:** Only `text-input` triggers Answer Checker (SPEC.md §9 step 4 — `single-choice`/`matching`/`order-builder` stay fully deterministic per Phase 2's CHECK-02, no change there).

### Theory Tutor Integration

- **D-11:** `handleTheoryStep(understood: boolean)` currently ignores its parameter and always advances (Phase 1's honest documented stub for out-of-scope THEORY-03). This phase implements the real branch. Round sequencing, grounded in SPEC.md §11's literal wording ("ядро показывает следующий уровень, затем зовёт Theory Tutor") and the real `Lesson-1A.json` data (exactly 2 pre-written `explanationLevels`: `normal`, `simple`):
  - Round 1 ("не понятно" tapped first time): **core-only**, no agent call — show the pre-written `explanationLevels[1]` ("simple") deterministically.
  - Round 2 and Round 3 (still "не понятно" after that): call Theory Tutor via the gateway for a further-simplified explanation. On agent failure (after retry), fallback is to **re-serve `explanationLevels[1]`** (the last available pre-written level) rather than fabricate new text — matches SPEC.md's documented fallback ("заранее написанные уровни из theory.explanationLevels").
  - After `maxSimplifyRounds` (3, from `Lesson-1A.json`) total rounds, **soft transition to practice** regardless of the child's last answer — the theory step ends and the first exercise renders.
  - Tapping "понятно" at any point during this loop exits immediately to practice (existing THEORY-01/02 behavior, unchanged).

### Claude's Discretion

- Exact TypeScript module layout for `callAgent()`, the Zod schemas per agent contract, and the Anthropic SDK client wrapper — left to planner/executor, informed by Phase 1/2's established pure-function + Zod-schema-per-shape pattern.
- Whether `.env` variable names are exactly `VITE_LLM_BASE_URL`/`VITE_LLM_API_KEY` or a different naming — executor should read the actual `.env` the user already created and match its variable names, not invent new ones that require the user to re-edit the file.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specification
- `SPEC.md` §8 (all 5 agent contracts — Phase 3 implements Answer Checker §8.1 and Theory Tutor §8.5 fully; the other 3 stay Phase 4), §9 (checkAnswer() steps 4-5 — Answer Checker trigger + fallback), §11 (theory block simplify-round flow), §14 (agent error handling: not-trusted-until-validated, one retry, source/failure logging — the exact rules this phase's Agent Gateway implements)
- `Lesson-1A.json` — real `theory.explanationLevels` (2 levels: normal/simple) and `maxSimplifyRounds` (3) that ground D-11's round sequencing

### Project-Level Research
- `.planning/research/STACK.md` — original strict-tool-use + Zod recommendation, Haiku model choice, and the "bring your own key" vs. Cloudflare Workers proxy tradeoff table (D-03 directly resolves this tradeoff, chosen: bring-your-own-key, scoped to local/demo use)

### Phase 1/2 Artifacts (dependency)
- `src/core/lessonEngine.ts` — `handleTheoryStep` (currently stubbed, D-11 implements it) and `handleAnswer` (the integration point for Answer Checker, D-09)
- `src/core/answer-checking/checkTextInput.ts` — current `CheckResult` contract this phase extends (D-09)
- `src/core/state/store.ts` — existing dispatch/save-on-dispatch pattern; agent-call outcomes fold into the existing single-dispatch-per-action invariant established in Phase 1 (D-03) and Phase 2 (Pitfall 3), not a new parallel write path

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `checkTextInput`/`checkSingleChoice`/`checkMatching`/`checkOrderBuilder` (Phase 1/2) — pure-function pattern the new `callAgent()` gateway and per-agent modules should follow (input in, typed result out, `source` field).
- `StateStore.dispatch()` (Phase 1) — single synchronous save-on-dispatch; agent-call results must fold into this, not add new dispatch call sites (same Pitfall 3 constraint carried forward from Phase 2).
- `TheorySchema`/`ExplanationLevelSchema` (Phase 1, `src/core/lesson/lessonSchema.ts`) — already typed, `maxSimplifyRounds` and `explanationLevels[]` ready to consume.

### Established Patterns
- Zod schema + `z.infer` type export per shape (every prior phase).
- `createElement`/`textContent` only, zero `innerHTML` (all phases).
- `.env`/`import.meta.env` is a new pattern for this phase — no prior phase needed runtime secrets; Vite's built-in `import.meta.env.VITE_*` mechanism is the standard, idiomatic approach (no extra library needed).

### Integration Points
- `LessonEngine.handleAnswer` (text-input branch) and `LessonEngine.handleTheoryStep` are the two call sites that now route through the new Agent Gateway.

</code_context>

<specifics>
## Specific Ideas

The user does not yet have a "real" Anthropic API key and was initially unsure whether their Claude.ai/Claude Code subscription would work for this (it doesn't — API access is separately billed). They resolved this by using an existing third-party LLM router key they already had, verified compatible with the Anthropic Messages API and strict tool use during this discussion.

</specifics>

<deferred>
## Deferred Ideas

- Cloudflare Workers (or equivalent) proxy for the API key — explicitly deferred until/unless the user wants to deploy publicly (D-03). Not needed for local dev or in-person defense demos.
- Reward Advisor, Progress Advisor, Parent Report Generator — Phase 4, reuse this phase's Agent Gateway.

### Reviewed Todos (not folded)

None — no pending todos existed.

</deferred>

---

*Phase: 3-Agent Gateway, Answer Checker & Theory Tutor*
*Context gathered: 2026-07-02*
