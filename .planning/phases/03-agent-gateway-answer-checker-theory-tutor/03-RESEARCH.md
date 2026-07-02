# Phase 3: Agent Gateway, Answer Checker & Theory Tutor - Research

**Researched:** 2026-07-02
**Domain:** Live LLM integration (Anthropic Messages API via third-party router) — trust-boundary gateway, structured-output agents, TypeScript SDK usage
**Confidence:** HIGH

## Summary

This phase wires the first live LLM calls into English Quest. The design is already substantially locked by `03-CONTEXT.md` (D-01 through D-11): a single `callAgent()` gateway built on `@anthropic-ai/sdk` pointed at `https://api.llmrouter.ru` (verified Anthropic-Messages-API-compatible, including strict tool use, during discuss-phase), calling `claude-haiku-4-5`, with the API key injected via Vite's `import.meta.env.VITE_*` build-time mechanism. Two agents — Answer Checker and Theory Tutor — are built on top of this shared gateway.

The technical shape of the gateway is now fully confirmed against official Anthropic docs: `tool_choice: {type: "tool", name: "..."}` forces a specific tool call, `strict: true` on the tool definition guarantees the `tool_use.input` block matches the JSON Schema (grammar-constrained sampling — not merely best-effort), and Zod v4's native `z.toJSONSchema()` can generate that `input_schema` directly from the same Zod schema used to validate the response, giving one source of truth per agent contract. The SDK's `RequestOptions` (`timeout`, `maxRetries`, `signal`) and its typed error hierarchy (`APIError`, `APIConnectionTimeoutError`, etc.) map directly onto D-06/D-07's "one retry, 8s timeout" requirement — but D-06/D-07 supersede the SDK's own default retry/timeout behavior (2 retries, 10-minute default) and must explicitly override both (`maxRetries: 0` at the gateway level, application-level retry logic instead, `timeout: 8000`).

Two integration-critical findings that are NOT yet reflected in the codebase and must be addressed by the plan: (1) `handleAnswer` and `handleTheoryStep` on `LessonEngine` are currently **synchronous** and called directly from synchronous DOM event handlers in `main.ts` — introducing a live network call requires making both `async` and reworking `main.ts`'s careful unsubscribe/resubscribe-around-dispatch pattern to `await` the engine call before touching `feedback`/re-rendering. (2) The `.env` file already created by the user uses `LLM_PROXY_BASE_URL` / `LLM_PROXY_API_KEY` — **without** the `VITE_` prefix Vite requires to expose a variable to client code (`import.meta.env.VITE_*` only). Per CONTEXT.md's explicit discretion note, the executor should read the actual `.env` and either rename these two keys to add the `VITE_` prefix (recommended — trivial `.env` edit) or accept that the current names will silently return `undefined` in the browser bundle.

**Primary recommendation:** Build `callAgent()` as a single small module (`src/core/agents/callAgent.ts`) parameterized by a per-agent Zod schema + tool name + system/user prompt builder; each of Answer Checker and Theory Tutor becomes a thin wrapper (`callAnswerChecker(input)`, `callTheoryTutor(input)`) that calls `callAgent()` with its own schema and maps the validated result (or the caller-supplied fallback) into the exact `CheckResult`/theory-explanation shape the core already expects. Convert `handleAnswer`/`handleTheoryStep` to `async` and thread `await` through `main.ts`'s two call sites; add a `simplifyRoundCount` (and current-explanation-text) field to `ProgressState`/`CurrentPositionSchema` since neither exists today.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Agent HTTP call (Anthropic Messages API via router) | Browser / Client | — | No backend in this project (D-03); `@anthropic-ai/sdk` runs directly in the browser bundle with `dangerouslyAllowBrowser: true` |
| API key storage | Browser / Client (build-time env) | — | `.env` → Vite `import.meta.env.VITE_*` → bundled into `dist/` JS at build time (D-03's explicit, scoped, local-only tradeoff) |
| Response validation (Zod) | Browser / Client (core) | — | RELY-01: single validation point in the core, not delegated to the SDK's `strict` flag alone (Pitfall 2 from PITFALLS.md: schema conformance ≠ semantic correctness, and even structural conformance must be independently checked since strict mode is per-provider, not a universal guarantee) |
| Retry/timeout/fallback orchestration | Browser / Client (core) | — | `callAgent()` gateway; deterministic core owns all control flow, agent is a pure input→output function it calls |
| Answer verdict / errorType / state write | Browser / Client (core) | — | Core writes `CheckResult` into `exercise_attempt` dispatch; agent only proposes `errorType`/`confidence`/`hintRu` |
| Theory explanation text selection/writing | Browser / Client (core) | — | Core decides which round/level to show (pre-written vs. agent vs. fallback-reserve); agent only proposes the text for rounds 2-3 |
| localStorage persistence of round-count / agent-call outcomes | Browser / Client (core) | — | Same `StateStore.dispatch()` single-write path Phases 1-2 established; no new parallel write path |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `@anthropic-ai/sdk` | `^0.109.1` (confirmed via `npm view`, published 2026-07-01, package created 2023-01-31) | Typed client for Anthropic Messages API calls (both agents) | Official Anthropic TypeScript SDK; per D-01, works unmodified against the verified-compatible router via `baseURL` override — no new SDK or shim needed `[VERIFIED: npm registry]` |
| `zod` | `^4.4.3` (already in `package.json` as `^4.4.0`; confirmed current via `npm view`, published 2026-05-04) | Runtime validation of every agent JSON response (RELY-01) AND generation of the `input_schema` sent to the tool definition via `z.toJSONSchema()` | Already the project's established validator (lesson schema, progress schema); Zod v4 ships first-party JSON Schema conversion, letting one schema serve both directions of the agent contract `[VERIFIED: npm registry]` |

**Installation:**
```bash
npm install @anthropic-ai/sdk
```
(`zod` is already a dependency — no reinstall needed.)

**Version verification:** `npm view @anthropic-ai/sdk version` → `0.109.1` (checked 2026-07-02). `npm view zod version` → `4.4.3` (checked 2026-07-02, matches `package.json`'s `^4.4.0` range). Both confirmed current at research time.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None additional | — | — | No mocking/HTTP library needed — `vitest`'s `vi.fn()`/`vi.stubGlobal("fetch", ...)` or a stubbed `Anthropic` client instance (dependency injection into `callAgent()`) is sufficient for unit-testing the gateway offline, consistent with Phase 1/2's zero-extra-test-dependency pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@anthropic-ai/sdk` direct `messages.create` + manual `tool_choice` | `client.beta.messages.toolRunner()` helper (SDK's agentic tool-loop helper) | `toolRunner` is designed for multi-turn agentic tool loops where the model can call tools repeatedly and receive results back — this project's agents are explicitly single-shot forced-tool-call contracts (SPEC §8: "один запрос → строгий JSON"), so the plain `messages.create()` + forced `tool_choice` is the correct, simpler fit; `toolRunner` would add unneeded loop machinery |
| `z.toJSONSchema()` (Zod v4 native) | `zod-to-json-schema` (third-party npm package) | The third-party package predates Zod v4's native JSON Schema support and is not guaranteed compatible with Zod v4's internal schema representation — use the native `z.toJSONSchema()` method instead, no extra dependency needed |
| Application-level 1-retry-then-fallback | SDK's built-in `maxRetries` (default 2, exponential backoff) | SDK retries are transport-level (network/5xx/429) and retry the *same* request with backoff — D-06 requires exactly one *immediate* retry with no backoff, and D-06 also requires a Zod-validation-failure (schema-valid-but-wrong-shape JSON) to trigger retry, which the SDK's `maxRetries` does NOT cover (that's an application-level failure class, not a transport error). Set `maxRetries: 0` on the client/request and implement the single retry explicitly in `callAgent()` |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `@anthropic-ai/sdk` | npm | Package created 2023-01-31 (3+ years); **latest version** published 2026-07-01 | 22,708,674/week | `github.com/anthropics/anthropic-sdk-typescript` | `[SUS]` (automated flag: "too-new" — triggered by the *latest version's* publish date, not package age) | **Approved, flag overridden** — see note below |
| `zod` | npm | Long-established (Zod 3→4 well known); latest published 2026-05-04 | 209,687,743/week | `github.com/colinhacks/zod` | `[OK]` | Approved |

**Note on `@anthropic-ai/sdk`'s `[SUS]` flag:** The automated legitimacy check (`gsd-tools query package-legitimacy check`) flagged this package `SUS` with reason `"too-new"`. This is a false positive specific to this package's release cadence: Anthropic ships the TypeScript SDK on a near-weekly cadence (last published 2026-07-01, one day before this research), but the package itself was created 2023-01-31 (over 3 years old), has ~22.7M weekly downloads, a `deprecated: false` flag, no `postinstall` script, and its repository resolves to the canonical `anthropics/anthropic-sdk-typescript` GitHub org — all strong legitimacy signals that the "too-new" heuristic (which checks latest-version publish recency, not package age) does not capture. Cross-checked directly against the official Anthropic documentation (`platform.claude.com/docs/en/api/sdks/typescript`), which names this exact package as the canonical TypeScript SDK. **Approved for use without a `checkpoint:human-verify` gate** — the override is based on package-age + download-count + canonical-repo + official-docs cross-reference, not merely re-running the same registry lookup.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `@anthropic-ai/sdk` — flag investigated and overridden per the note above (not a `checkpoint:human-verify` case; this is a well-known, single-source, officially-documented package, and the flag is a heuristic false positive on release cadence, not a supply-chain risk signal).

## Architecture Patterns

### System Architecture Diagram

```
[Child taps "Проверить" on text-input exercise]
              │
              ▼
   main.ts onSubmit(answer)  ── unsubscribe render ──▶ await engine.handleAnswer(id, answer)
              │
              ▼
   LessonEngine.handleAnswer()
              │
              ▼
   checkTextInput(exercise, answer)  ── exact match? ──▶ YES ──▶ CheckResult{isCorrect, source:"core"} ──┐
              │ NO (ambiguous)                                                                            │
              ▼                                                                                            │
   callAnswerChecker({prompt, correctAnswers, acceptedAnswers, childAnswer})                               │
              │                                                                                            │
              ▼                                                                                            │
   callAgent(schema=AnswerCheckerResponseSchema, tool="report_answer_check", ...)                          │
       │                                                                                                    │
       ├─▶ Anthropic SDK .messages.create({baseURL: llmrouter, tool_choice: forced, timeout: 8s})           │
       │        │                                                                                           │
       │        ├─ success + Zod valid ──▶ {source:"agent", isCorrect, errorType, confidence, hintRu} ──────┤
       │        ├─ fail (timeout/network/malformed JSON/Zod invalid) ──▶ RETRY ONCE (same request) ─┐        │
       │        │                                                                                    │       │
       │        └─ retry fail too ──▶ fallback: {source:"core", isCorrect:false, errorType:"unknown"}┴───────┤
       │                                                                                                      │
              ▼                                                                                              ▼
   evaluateAttempt(state, exercise, result, ...)  ◀── SAME extended CheckResult, either branch ───────────────┘
              │
              ▼
   store.dispatch({type:"exercise_attempt", ...delta, source, agentFailed})  ── RELY-03 event logging
              │
              ▼
   resubscribe render ── render(store.getState())  ── UI shows verdict + hint (if any)


[Child taps "Не понятно" on theory screen]
              │
              ▼
   main.ts onUnderstoodChoice(false) ──▶ await engine.handleTheoryStep(false)
              │
              ▼
   LessonEngine.handleTheoryStep()
       reads currentPosition.simplifyRoundCount (NEW field)
              │
       round === 0 (first "не понятно") ──▶ core-only: show explanationLevels[1] ("simple"), round=1
              │
       round === 1 or 2 ──▶ callTheoryTutor({rule, currentLevelText, childUnderstood:false, roundNumber})
              │                    │
              │                    ├─▶ callAgent(schema=TheoryTutorResponseSchema, tool="report_explanation", ...)
              │                    │        success ──▶ {source:"agent", explanationRu, exampleRu, level, canSimplifyMore}
              │                    │        fail(retry exhausted) ──▶ fallback: re-serve explanationLevels[1]
              │                    ▼
              │              round += 1
              │
       round >= maxSimplifyRounds (3) ──▶ soft transition: theoryUnderstood=true regardless of last answer
              │
              ▼
   store.dispatch({type:"theory_step", ...}) ── extended to carry round count + current explanation text
```

### Recommended Project Structure

```
src/core/
├── agents/
│   ├── callAgent.ts              # shared gateway: build request, call SDK, validate, retry-once, fallback
│   ├── anthropicClient.ts        # single Anthropic client instance (baseURL, apiKey from import.meta.env)
│   ├── answerChecker.ts          # callAnswerChecker(input) -> AnswerCheckerResponse | fallback
│   ├── answerCheckerSchema.ts    # AnswerCheckerResponseSchema (Zod) + errorType enum + z.toJSONSchema() tool input
│   ├── theoryTutor.ts            # callTheoryTutor(input) -> TheoryTutorResponse | fallback
│   └── theoryTutorSchema.ts      # TheoryTutorResponseSchema (Zod) + level enum + z.toJSONSchema() tool input
├── answer-checking/
│   └── checkTextInput.ts         # CheckResult interface EXTENDED here (errorType/confidence/hintRu added)
├── lessonEngine.ts                # handleAnswer/handleTheoryStep become async, call the new agent modules
└── state/
    ├── progressSchema.ts          # CurrentPositionSchema gains simplifyRoundCount (+ current explanation text)
    └── store.ts                   # Action types gain source/agentFailed fields on exercise_attempt/theory_step
```

### Pattern 1: One Zod schema, two directions (response validation + tool input_schema)

**What:** Define a single Zod object schema per agent response contract. Use it BOTH to `z.toJSONSchema()` for the tool's `input_schema` (what you tell Claude to produce) AND to `.safeParse()` the `tool_use.input` block Claude actually returns (what you trust before writing state).

**When to use:** Every one of the 5 agent contracts (this phase: Answer Checker, Theory Tutor).

**Example:**
```typescript
// Source: https://zod.dev/json-schema (Zod v4 native JSON Schema conversion, confirmed 2026-07-02)
// Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use (strict:true + input_schema shape)
import * as z from "zod";

export const AnswerCheckerErrorTypeSchema = z.enum([
  "typo",
  "wrong_word",
  "wrong_order",
  "missed_article",
  "wrong_tense",
  "non_action_verb_in_continuous",
  "wrong_question_order",
  "missing_auxiliary",
  "spelling_third_person_s",
  "spelling_ing_form",
  "unknown",
]); // SPEC.md §8.1 literal enum — do NOT invent additional values

export const AnswerCheckerResponseSchema = z.object({
  isCorrect: z.boolean(),
  errorType: AnswerCheckerErrorTypeSchema,
  confidence: z.number().min(0).max(1),
  hintRu: z.string(),
});
export type AnswerCheckerResponse = z.infer<typeof AnswerCheckerResponseSchema>;

// Derive the tool's input_schema from the SAME schema (single source of truth):
const inputSchema = z.toJSONSchema(AnswerCheckerResponseSchema);
// inputSchema already has additionalProperties:false by Zod v4 default for z.object() —
// required by strict:true tool definitions.
```

### Pattern 2: Forced strict tool use for a single-shot structured-output call

**What:** Define one tool per agent whose `input_schema` matches the desired output shape; force `tool_choice: {type: "tool", name: "..."}` combined with `strict: true` on the tool definition so Claude's response is grammar-constrained to match the schema.

**When to use:** Every agent call in this project — this IS the mechanism STACK.md and CONTEXT.md (D-01) specify for guaranteed-shape JSON output, verified working live against the router during discuss-phase.

**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
// Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use (tool_choice forcing)
const response = await client.messages.create(
  {
    model: "claude-haiku-4-5",
    max_tokens: 512,
    system: ANSWER_CHECKER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(agentInput) }],
    tools: [
      {
        name: "report_answer_check",
        description: "Report the verdict and error classification for an ambiguous text-input answer.",
        strict: true,
        input_schema: z.toJSONSchema(AnswerCheckerResponseSchema),
      },
    ],
    tool_choice: { type: "tool", name: "report_answer_check" },
  },
  { timeout: 8000, maxRetries: 0 }, // D-07: 8s timeout; D-06: retry handled by callAgent(), not the SDK
);

// Response content will contain exactly one tool_use block (forced tool_choice):
// { type: "tool_use", id: "toolu_...", name: "report_answer_check", input: {...} }
const toolUseBlock = response.content.find((b) => b.type === "tool_use");
const parsed = AnswerCheckerResponseSchema.safeParse(toolUseBlock?.input);
// NEVER trust toolUseBlock.input directly even though strict:true was set —
// RELY-01 requires the core to validate regardless (PITFALLS.md Pitfall 2/
// Integration Gotchas: provider-side "strict" is best-effort defense in depth,
// not a substitute for app-level validation).
```

### Pattern 3: Client instantiation against the custom router

**What:** Instantiate a single `Anthropic` client with `baseURL` overridden to the router and `dangerouslyAllowBrowser: true` (required — this SDK disables browser usage by default specifically to prevent the accidental-key-exposure footgun STACK.md warns about; D-03 is the explicit, documented, scoped decision to accept this tradeoff for local/demo use only).

**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/api/sdks/typescript (baseURL, dangerouslyAllowBrowser)
import Anthropic from "@anthropic-ai/sdk";

export const anthropicClient = new Anthropic({
  apiKey: import.meta.env.VITE_LLM_API_KEY, // exact var name TBD — see .env Gotcha below
  baseURL: import.meta.env.VITE_LLM_BASE_URL,
  dangerouslyAllowBrowser: true, // D-03's explicit scoped tradeoff — MUST stay commented/documented, not silent
  maxRetries: 0, // D-06: application-level retry-once logic in callAgent(), not SDK auto-retry
});
```

### Pattern 4: 1-retry-then-fallback wrapper with distinct failure classification

**What:** `callAgent()` classifies failures into: (a) SDK/transport errors (`APIError` subclasses, `APIConnectionTimeoutError`) and (b) Zod validation failures (schema-valid-but-wrong-shape JSON) — D-06 treats BOTH as retry-eligible (unlike PITFALLS.md Pitfall 3's general guidance to skip retry on timeout; D-06 explicitly overrides this for this narrow single-shot child-facing case: "Failure classes that trigger retry-then-fallback: malformed/non-parsing JSON, Zod validation failure, network error, and timeout" — all four retry once, no exceptions).

**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/api/sdks/typescript (error hierarchy, timeout, AbortError)
// Pattern grounded in D-06/D-07 (03-CONTEXT.md) — one immediate retry, no backoff, 8s/attempt.
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

export interface AgentCallResult<T> {
  data: T;
  source: "agent";
  failed: false;
}
export interface AgentFallbackResult<T> {
  data: T;
  source: "core";
  failed: true;
}

export async function callAgent<T>(opts: {
  schema: z.ZodType<T>;
  toolName: string;
  toolDescription: string;
  systemPrompt: string;
  userContent: string;
  fallback: T;
}): Promise<AgentCallResult<T> | AgentFallbackResult<T>> {
  const attempt = async (): Promise<T> => {
    const response = await anthropicClient.messages.create(
      {
        model: "claude-haiku-4-5",
        max_tokens: 512,
        system: opts.systemPrompt,
        messages: [{ role: "user", content: opts.userContent }],
        tools: [
          {
            name: opts.toolName,
            description: opts.toolDescription,
            strict: true,
            input_schema: z.toJSONSchema(opts.schema as z.ZodObject<any>),
          },
        ],
        tool_choice: { type: "tool", name: opts.toolName },
      },
      { timeout: 8000, maxRetries: 0 }, // D-07
    );
    const block = response.content.find((b) => b.type === "tool_use");
    const parsed = opts.schema.safeParse(block?.input);
    if (!parsed.success) {
      throw new Error(`Agent response failed schema validation: ${parsed.error.message}`);
    }
    return parsed.data;
  };

  try {
    const data = await attempt();
    return { data, source: "agent", failed: false };
  } catch (firstError) {
    // D-06: exactly one immediate retry, no backoff — covers SDK errors
    // (APIError/APIConnectionTimeoutError/network) AND Zod validation failures,
    // since attempt() throws for both cases uniformly.
    try {
      const data = await attempt();
      return { data, source: "agent", failed: false };
    } catch (secondError) {
      return { data: opts.fallback, source: "core", failed: true };
    }
  }
}
```

### Anti-Patterns to Avoid

- **Trusting `strict: true` alone:** Even though strict tool use uses grammar-constrained sampling and is documented as guaranteeing schema conformance, RELY-01 and PITFALLS.md Pitfall 2 both require the app to Zod-validate regardless — defense in depth against provider bugs, router-layer response transformation (this project goes through a third-party router, an extra hop where responses could theoretically be mangled), or future model/strict-mode edge cases.
- **Letting the SDK's built-in retry logic interact with the application's retry logic:** The default `maxRetries: 2` with exponential backoff would silently multiply the number of attempts beyond D-06's "exactly one retry" if not explicitly set to `maxRetries: 0` at the client or per-request level.
- **Fabricating new theory text on Theory Tutor fallback:** D-11 explicitly requires re-serving `explanationLevels[1]` (the last pre-written level) on agent failure at rounds 2-3, NOT synthesizing new "simpler" text deterministically — the fallback must match SPEC.md's documented behavior exactly ("заранее написанные уровни из theory.explanationLevels").
- **Writing agent-proposed numbers directly to state:** `confidence` and any other agent-proposed value must never gate a state write on its own (SPEC §14, PITFALLS.md Pitfall 2) — `isCorrect`/`errorType` from Answer Checker becomes the `CheckResult` the core already trusts structurally, but the core's existing `evaluateAttempt()` guard rules (topic FSM thresholds, reward limits) still apply unchanged regardless of source.
- **Calling `handleAnswer`/`handleTheoryStep` without awaiting:** Once these become `async`, any call site that doesn't `await` will fire-and-forget the state update, causing the UI to render stale state or race with the next user action — must audit every call site (`main.ts`, all `tests/e2e/*.test.ts` and `tests/core/lessonEngine.test.ts` files calling these methods).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Converting a Zod schema to a JSON Schema for `input_schema` | A hand-written JSON Schema object duplicating the Zod schema's shape | `z.toJSONSchema(schema)` (Zod v4 native) | Two hand-maintained representations of the same contract will drift; the native converter keeps validation and tool-definition schema in permanent lockstep |
| Retrying a failed HTTP/SDK call | A custom fetch-with-retry loop reimplementing backoff/timeout | `@anthropic-ai/sdk`'s `RequestOptions.timeout` for the per-attempt timeout ceiling, with `maxRetries: 0` and one explicit application-level retry per D-06 | The SDK already implements robust timeout semantics (`APIConnectionTimeoutError`) and abort handling; only the retry COUNT/backoff policy needs overriding, not the whole HTTP layer |
| Detecting whether the router response is a valid tool_use block | Manual regex/string-parsing of the raw response body | `response.content.find(b => b.type === "tool_use")` on the SDK's typed `Message` object | The SDK already parses the Anthropic Messages API response shape into typed content blocks; D-01 confirmed the router returns this exact native shape |
| Environment variable access in browser code | `process.env.X` (Node-style) or a custom `.env` parser | Vite's built-in `import.meta.env.VITE_*` (build-time static replacement) | Vite performs this natively via `import.meta.env`; `process.env` is undefined in browser bundles unless separately polyfilled, and any variable without the `VITE_` prefix is intentionally excluded from the client bundle for security (documented Vite behavior — prevents accidentally leaking server-only secrets) |

**Key insight:** Every piece of "custom infrastructure" this phase might be tempted to hand-roll (JSON Schema generation, retry/timeout, response parsing, env injection) already has a first-party, actively-maintained solution in the exact stack STACK.md already locked in. The only genuinely new code this phase writes is the *policy* layer — which failures retry, what the fallback shape is, how the core's existing state-write guards apply to agent output — not any of the plumbing.

## Common Pitfalls

### Pitfall 1: `.env` variable names lack the `VITE_` prefix Vite requires

**What goes wrong:** The user's existing `.env` file (confirmed present, gitignored) defines `LLM_PROXY_BASE_URL` and `LLM_PROXY_API_KEY` — neither has the `VITE_` prefix. Vite only exposes environment variables prefixed `VITE_` to client code via `import.meta.env`; any other variable is silently `undefined` in the browser bundle, with no error at build time. If `anthropicClient.ts` is written referencing `import.meta.env.VITE_LLM_API_KEY` (as CONTEXT.md's D-03 example names suggest) without confirming this against the real `.env`, the client will construct with `apiKey: undefined` and fail at the first agent call with an unhelpful auth error, not a clear "env var missing" error.

**Why it happens:** CONTEXT.md's Claude's Discretion section already flags this ambiguity explicitly ("Whether `.env` variable names are exactly `VITE_LLM_BASE_URL`/`VITE_LLM_API_KEY` or a different naming — executor should read the actual `.env`"), but the *current* names (`LLM_PROXY_BASE_URL`/`LLM_PROXY_API_KEY`) don't have the prefix at all, so simply "reading and matching" isn't sufficient — the names must be changed to add the prefix, since Vite's exposure rule is non-negotiable (not a naming-convention issue but a hard client/server variable boundary).

**How to avoid:** The plan must include an explicit task to rename the two `.env` keys to `VITE_LLM_BASE_URL` / `VITE_LLM_API_KEY` (or `VITE_LLM_PROXY_BASE_URL`/`VITE_LLM_PROXY_API_KEY` if preserving more of the original naming is preferred) BEFORE writing `anthropicClient.ts`, and use the renamed keys consistently in code. Also add a `src/vite-env.d.ts` declaring the `ImportMetaEnv` interface for TypeScript autocomplete/type-safety (none exists in the codebase yet).

**Warning signs:** `anthropicClient` constructed with `apiKey: undefined`; the first live agent call fails with a 401/403 rather than an obvious "env var not found" error; `import.meta.env.VITE_LLM_API_KEY` typed as `any` or `string | undefined` with no compile-time enforcement.

### Pitfall 2: `handleAnswer`/`handleTheoryStep` becoming `async` breaks the existing synchronous render-timing invariant

**What goes wrong:** `main.ts`'s `onSubmit` handler currently does: unsubscribe render → call `engine.handleAnswer()` synchronously (which internally calls `store.dispatch()`, itself synchronous, triggering `save()`) → capture `feedback` from the *already-returned* result → resubscribe → conditionally call `render()`. This entire sequence relies on `handleAnswer` completing synchronously before the next line runs. Making it `async` (required once it awaits `callAgent()`) means `onSubmit` itself must become `async`, and the unsubscribe/resubscribe window now spans an actual network round-trip (up to 16s worst case per D-07's two 8s attempts) — during which no other dispatch can trigger a render, potentially leaving the UI showing stale state or an unresponsive submit button for a noticeably long time with no interim signal.

**Why it happens:** Phases 1-2 built this pattern under the reasonable assumption that all engine work is synchronous (Pitfall 3, "Retry-once + fallback logic" in PITFALLS.md warned about this exact class of problem generally, but the specific sync→async boundary crossing an existing carefully-tuned render-timing mechanism is a fresh integration risk unique to this phase).

**How to avoid:** Convert `handleAnswer`/`handleTheoryStep` to `async`, `await` them at both call sites in `main.ts`, and — per PITFALLS.md's UX Pitfalls table — add an immediate "thinking" state (disable the submit button, show a lightweight loading indicator) the instant the async call begins, so the up-to-16s worst case never reads as a frozen/broken UI to the child. Audit every test file calling these methods (`tests/core/lessonEngine.test.ts`, `tests/e2e/reviewQueuePass.test.ts`, `tests/e2e/fullLessonTraversal.test.ts`, `tests/e2e/lessonWalkingSkeleton.test.ts`, `tests/e2e/reviewPassFeedback.test.ts`) — all currently call these synchronously and will need `await` added, which itself requires their enclosing `it()` callbacks to become `async`.

**Warning signs:** TypeScript compile errors on `Promise<CheckResult>` used where `CheckResult` is expected; tests that pass locally but only because Vitest doesn't await an unawaited promise before assertions run (false-positive green tests); the submit button remaining clickable during an in-flight agent call, allowing duplicate submissions.

### Pitfall 3: No round-counter or in-progress-explanation-text field exists in state yet

**What goes wrong:** D-11's round sequencing (round 1 = pre-written level 2, rounds 2-3 = agent call, round 3+ = soft transition) requires tracking how many "не понятно" taps have occurred in the CURRENT theory step, and requires storing whatever explanation text (pre-written OR agent-returned OR fallback-re-served) is currently being shown so `TheoryScreen.ts` can render it. Neither `CurrentPositionSchema` (`theoryUnderstood`, `currentExerciseIndex`, `reviewPassIndex`) nor any other part of `ProgressState` has a field for this today. Without adding one, the round logic has nowhere durable to read/write its counter, and `TheoryScreen.ts` (which currently only ever renders `theory.explanationLevels[0]`, hardcoded) has no way to display a different level/agent text.

**How to avoid:** Add `simplifyRoundCount: number` (default `0`) to `CurrentPositionSchema`, and either (a) a `currentExplanation: { textRu: string; exampleRu: string } | null` field alongside it, or (b) derive the displayed text purely from `simplifyRoundCount` + a small in-memory (non-persisted) "last agent explanation" variable in `main.ts` similar to the existing `feedback` pattern — the plan should pick one explicitly since CONTEXT.md's Claude's Discretion section leaves "exact TypeScript module layout" open but does not address this specific schema gap.

**Warning signs:** `TheoryScreen.ts` still renders only `theory.explanationLevels[0]` after this phase ships; no test exercises the "не понятно" tapped 3 times in a row scenario end-to-end; `handleTheoryStep` has no way to know it's on round 2 vs round 1.

### Pitfall 4: Router-layer response shape drift not covered by the SDK's own error types

**What goes wrong:** D-01 verified the router returns the *native* Anthropic Messages API response shape for both `/v1/messages` and forced-tool-use requests — but this was verified via `curl`, not through the SDK itself, and it's a third-party proxy, not Anthropic's own infrastructure. If the router ever returns a response that's valid JSON but doesn't quite match the SDK's expected `Message` type (e.g., a proxy-added wrapper field, a slightly different error envelope on 4xx/5xx), the SDK's typed parsing could throw an unexpected error class not explicitly handled by `callAgent()`'s classification.

**How to avoid:** In `callAgent()`, catch broadly (any thrown error, not just `instanceof Anthropic.APIError`) and treat any exception from the `attempt()` function as retry-eligible per D-06 — do not narrow the catch to only SDK-specific error classes, since a router-shape mismatch could throw a generic parsing error instead. This is already reflected in Pattern 4's example above (`catch (firstError)` with no `instanceof` narrowing before deciding to retry).

**Warning signs:** An uncaught exception propagating out of `callAgent()` instead of resolving to the fallback path; a lesson crashing (not falling back) specifically when the router is slow or returns an edge-case error format that differs from Anthropic's own.

## Code Examples

Verified patterns from official sources:

### Forcing tool use with strict schema validation
```typescript
// Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
tools: [{
  name: "get_weather",
  description: "Get the current weather in a given location",
  strict: true,
  input_schema: {
    type: "object",
    properties: { location: { type: "string" } },
    required: ["location"],
    additionalProperties: false,
  },
}],
tool_choice: { type: "tool", name: "get_weather" },
```

### Per-request timeout override (distinct from client default)
```typescript
// Source: https://platform.claude.com/docs/en/api/sdks/typescript#timeouts
const client = new Anthropic({ timeout: 20 * 1000 }); // client default
await client.messages.create({ /* ... */ }, { timeout: 5 * 1000 }); // per-request override
// On timeout: throws Anthropic.APIConnectionTimeoutError
```

### Error hierarchy for classification
```typescript
// Source: https://platform.claude.com/docs/en/api/sdks/typescript#handling-errors
try {
  await client.messages.create({ /* ... */ });
} catch (err) {
  if (err instanceof Anthropic.APIError) {
    console.log(err.status); // e.g. 429, 500
    console.log(err.name);   // e.g. "RateLimitError", "InternalServerError"
  }
  // else: APIConnectionError (network) or APIConnectionTimeoutError (timeout)
}
```

### Disabling SDK auto-retry so application logic owns retry count
```typescript
// Source: https://platform.claude.com/docs/en/api/sdks/typescript#retries
const client = new Anthropic({ maxRetries: 0 }); // default is 2 — MUST override for D-06
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| Best-effort JSON-mode prompting ("please respond in JSON") | Forced `tool_choice` + `strict: true` grammar-constrained sampling | Strict tool use is current-generation Anthropic tooling (documented as of this research date, works with Sonnet/Haiku per the docs' model guidance) | Guarantees schema conformance at the token-sampling level rather than relying on prompt compliance — directly enables RELY-01/RELY-02's "not trusted until validated, but structurally reliable" design |
| Hand-written JSON Schema definitions duplicated from a TS type | `z.toJSONSchema()` (Zod v4 native) | Zod v4 (current major, `4.4.3` at research time) | One schema drives both the tool's `input_schema` and the response validator — eliminates a class of drift bugs |

**Deprecated/outdated:**
- `zod-to-json-schema` (third-party npm package): superseded by Zod v4's native `z.toJSONSchema()` for any project already on Zod 4, which this project is.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | The exact `.env` variable rename target (`VITE_LLM_BASE_URL`/`VITE_LLM_API_KEY` vs. preserving `PROXY` in the name) is a naming choice, not yet confirmed with the user — CONTEXT.md leaves this to executor discretion, but the *fact* that a rename is required (missing `VITE_` prefix) is verified, not assumed | Common Pitfalls #1, Pattern 3 | Low — either naming choice works functionally as long as code and `.env` agree; only a problem if the executor picks a name inconsistent with how it documents the change |
| A2 | `max_tokens: 512` in the Answer Checker/Theory Tutor code examples is a reasonable placeholder for these narrow, short-JSON-output agents — not verified against actual token counts for the real prompts | Pattern 2, Pattern 4 code examples | Low — if too low, response could be truncated mid-tool-call; the plan should size this based on the actual system prompt + expected output length once written, not copy the placeholder verbatim |
| A3 | `router` (api.llmrouter.ru) charges/rate-limits are not characterized in this research — D-01 verified functional compatibility (shape of responses) but not any latency/rate-limit SLA | Pattern 4 (8s timeout choice), Environment Availability | Medium — if the router has aggressive rate limiting or notably higher latency than Anthropic's own API, the 8s timeout (D-07) could trigger fallback more often than expected during testing; not blocking, but worth an early manual smoke-test during execution |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Exact `.env` key names the executor should land on**
   - What we know: current keys are `LLM_PROXY_BASE_URL`/`LLM_PROXY_API_KEY`, neither Vite-exposed; CONTEXT.md explicitly defers the final naming to executor discretion.
   - What's unclear: whether to preserve "PROXY" in the renamed key or drop it (`VITE_LLM_BASE_URL` vs `VITE_LLM_PROXY_BASE_URL`).
   - Recommendation: pick `VITE_LLM_BASE_URL` / `VITE_LLM_API_KEY` (shorter, matches CONTEXT.md's own example names in D-03) and document the rename explicitly in the plan's first task.

2. **Where `simplifyRoundCount` and in-progress theory explanation text live in state**
   - What we know: no such field exists in `CurrentPositionSchema` or elsewhere in `ProgressState` today; D-11's round logic needs both a counter and a way to hand the currently-active explanation text to `TheoryScreen.ts`.
   - What's unclear: whether this belongs in persisted `ProgressState` (survives reload mid-theory-step) or transient in-memory state in `main.ts` (like the existing `feedback` variable, which is explicitly NOT persisted).
   - Recommendation: persist `simplifyRoundCount` in `CurrentPositionSchema` (so a page reload mid-simplify-loop doesn't lose the round count and silently reset to round 1, which the schema-versioning discipline established in Phase 1 would otherwise guarantee); keep the actual explanation TEXT transient/in-memory (regenerating agent text on every reload is acceptable and avoids storing agent-authored copy across sessions).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| `api.llmrouter.ru` (third-party LLM router) | Both agents (live calls) | ✓ (confirmed reachable, HTTP 200 on `/v1/models` during this research session) | — | Deterministic fallback per-agent if unreachable at runtime (D-06/D-07/D-09/D-11) — this IS the designed fallback path, not a gap |
| `.env` with `LLM_PROXY_BASE_URL`/`LLM_PROXY_API_KEY` | Client instantiation | ✓ (file exists, gitignored, keys confirmed present — values not read per security protocol) | — | N/A — must rename keys to add `VITE_` prefix, see Pitfall 1 |
| Node.js / npm | Build tooling | ✓ | — | — |
| `@anthropic-ai/sdk` | Both agents | Not yet installed (absent from current `package.json`) | Install `^0.109.1` | — |

**Missing dependencies with no fallback:**
- None — `@anthropic-ai/sdk` install is a normal task-list item, not a blocker; the LLM router itself has a designed fallback (deterministic core paths) if unreachable at runtime.

**Missing dependencies with fallback:**
- LLM router unreachable at runtime → deterministic fallback (already the designed behavior per D-06/D-09/D-11, not a gap to fill).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x (already configured, `vitest.config.ts` present, `jsdom` environment) |
| Config file | `vitest.config.ts` (existing, no changes needed) |
| Quick run command | `npm run test:core` (scoped to `tests/core`) |
| Full suite command | `npm test` (`vitest run`, includes `tests/e2e`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| CHECK-03 | Ambiguous text-input answer routes to Answer Checker, returns verdict + errorType | unit | `vitest run tests/core/agents/answerChecker.test.ts` | ❌ Wave 0 |
| CHECK-04 | Answer Checker failure (mocked timeout/malformed JSON) → one retry → deterministic fallback | unit | `vitest run tests/core/agents/answerChecker.test.ts -t fallback` | ❌ Wave 0 |
| THEORY-03 | "Не понятно" tapped 1x → pre-written level 2 (no agent call); 2x-3x → agent call; 3x+ → soft transition | unit + integration | `vitest run tests/core/lessonEngine.test.ts -t theory` | ❌ Wave 0 (extends existing `lessonEngine.test.ts`) |
| RELY-01 | Agent response validated by Zod before trusted; malformed/wrong-enum JSON rejected | unit | `vitest run tests/core/agents/callAgent.test.ts` | ❌ Wave 0 |
| RELY-02 | Agent failure (any of: malformed JSON, timeout, network error, Zod-invalid) → exactly one retry → fallback, lesson does not crash | unit | `vitest run tests/core/agents/callAgent.test.ts -t retry` | ❌ Wave 0 |
| RELY-03 | Every agent-call event records `source: "core"\|"agent"` and a failure flag in the dispatched event | unit | `vitest run tests/core/state/store.test.ts -t source` | ❌ Wave 0 (extends existing `store.test.ts`) |

### Sampling Rate

- **Per task commit:** `npm run test:core`
- **Per wave merge:** `npm test` (full suite including `tests/e2e`)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/core/agents/callAgent.test.ts` — covers RELY-01, RELY-02; needs a stubbed/mocked `Anthropic` client (constructor-injected, not the real SDK) so tests run offline and deterministically simulate: success-first-try, malformed-JSON-then-success-on-retry, timeout-then-fallback, Zod-invalid-then-fallback (four distinct cases per PITFALLS.md's "Looks Done But Isn't" checklist item on retry-once semantics)
- [ ] `tests/core/agents/answerChecker.test.ts` — covers CHECK-03, CHECK-04; needs a fixture ambiguous text-input answer plus mocked agent responses for both success and fallback paths
- [ ] `tests/core/lessonEngine.test.ts` — EXTEND existing file (not new) to cover THEORY-03's full round sequencing (round 1 core-only, rounds 2-3 agent-backed, round 3+ soft transition) — existing theory tests in this file assert Phase-1 stub behavior and will need updating/replacing since `handleTheoryStep`'s behavior fundamentally changes this phase
- [ ] Existing async-conversion fallout: `tests/core/lessonEngine.test.ts`, `tests/e2e/reviewQueuePass.test.ts`, `tests/e2e/fullLessonTraversal.test.ts`, `tests/e2e/lessonWalkingSkeleton.test.ts`, `tests/e2e/reviewPassFeedback.test.ts` all call `handleAnswer`/`handleTheoryStep` synchronously today and need `await` + `async` test callbacks added once these methods become `async` (see Common Pitfalls #2) — this is refactor work on existing tests, not new coverage, but must be scoped into the plan's task list since it blocks the full suite from passing green

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|-----------------|---------|---------------------|
| V2 Authentication | No | No user-facing auth in this app (single fixed `studentId: "primary"`, no login) |
| V3 Session Management | No | No sessions — `localStorage` only |
| V4 Access Control | No | No multi-user access control surface |
| V5 Input Validation | Yes | Zod `safeParse()` on every agent response before it's trusted (RELY-01); the child's free-text answer is passed into the agent prompt as data, not instruction — standard prompt-hygiene separation (system prompt vs. user-content) already noted in PITFALLS.md Security Mistakes table |
| V6 Cryptography | No | No cryptographic operations in this phase; API key transport is HTTPS (router endpoint), not a project-implemented crypto concern |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| API key exposure in shipped browser bundle | Information Disclosure | Explicitly accepted, scoped tradeoff (D-03) — local dev / in-person demo only; documented in `STATE.md` Blockers/Concerns already; do not deploy `dist/` publicly without a proxy (already flagged project-wide, not new to this phase) |
| Prompt injection via child's free-text answer reaching the Answer Checker's prompt | Tampering (of agent behavior, not of system state) | Low risk given the narrow, non-privileged nature of the agent (it only proposes `errorType`/`hintRu`/`confidence`, never writes state directly) — standard system/user content separation in the Messages API request is sufficient; the core's structural+semantic validation (Zod schema + enum membership) is the actual security boundary, not prompt-level defenses, since even a successfully "injected" agent response still can't write anything the Zod schema doesn't allow |
| Trusting agent output as authoritative without independent validation | Tampering / Elevation of Privilege (of agent judgment over core state) | RELY-01/RELY-02 (Zod validation, single validation point) — already the architecture's core security invariant, this phase implements rather than introduces it |
| Router (third-party proxy) response tampering or MITM | Tampering | HTTPS to `api.llmrouter.ru` (confirmed reachable over HTTPS during this research); no additional mitigation needed beyond what the SDK already provides (TLS is handled by `fetch`) |

## Sources

### Primary (HIGH confidence)
- `https://platform.claude.com/docs/en/api/sdks/typescript` — official TypeScript SDK docs: `baseURL`, `timeout`, `maxRetries`, error hierarchy, `dangerouslyAllowBrowser`, retry defaults, request/response types — confirmed 2026-07-02
- `https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/strict-tool-use` — official strict tool use docs: `strict: true` semantics, guarantees, `additionalProperties: false` requirement — confirmed 2026-07-02
- `https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/implement-tool-use` — official tool_choice forcing docs (`{type: "tool", name: "..."}`, `tool_use` response block shape) — confirmed 2026-07-02
- `https://github.com/anthropics/anthropic-sdk-typescript` — canonical repository, cross-referenced against `npm view` package metadata
- `npm view @anthropic-ai/sdk` / `npm view zod` — registry-verified current versions (0.109.1 / 4.4.3), publish dates, package creation date, postinstall script absence, weekly download counts
- `gsd-tools query package-legitimacy check` — automated legitimacy signals for both packages (cross-checked and one false-positive flag investigated and documented)

### Secondary (MEDIUM confidence)
- `https://zod.dev/json-schema` — Zod v4 native `z.toJSONSchema()` behavior (additionalProperties default, enum representation, unrepresentable-type handling) — WebFetch-summarized from official Zod docs

### Tertiary (LOW confidence)
- None — all agent/SDK claims in this document were verified against official Anthropic or Zod documentation, not general web search alone.

## Project Constraints (from CLAUDE.md)

- Stack decisions (TypeScript, Vite, `@anthropic-ai/sdk`, Zod, Claude Haiku 4.5, browser-direct key via `.env`) are pre-locked in `./.claude/CLAUDE.md`'s Technology Stack section and match this phase's CONTEXT.md decisions exactly — no conflict found.
- CLAUDE.md explicitly names `dangerouslyAllowBrowser: true` + `.env`-sourced key as the accepted "bring your own key" variant tradeoff, with the same local-dev/demo-only scope boundary CONTEXT.md's D-03 states — consistent.
- CLAUDE.md's "What NOT to Use" table forbids: agent-orchestration frameworks (LangChain/LangGraph/CrewAI/Mastra) — not used, `callAgent()` is a plain function; raw `fetch()` with hand-parsed JSON and no schema validation — not used, SDK + Zod are used; React/Redux/Zustand — not used, no framework introduced this phase; IndexedDB — not used, `localStorage` only, unchanged.
- CLAUDE.md's GSD Workflow Enforcement section requires all file-changing work to go through a GSD command (`/gsd-execute-phase` etc.) — applies to the execution phase following this research, not to research itself.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|---------------------|
| CHECK-03 | При неоднозначном `text-input` ответе (нет точного совпадения) вызывается агент Answer Checker и возвращает вердикт и типизированную ошибку (`errorType`) | Pattern 1 (Zod schema with SPEC §8.1's exact `errorType` enum), Pattern 2 (forced strict tool use call), Pattern 4 (`callAgent()` wrapper); D-09's extended `CheckResult` contract documented in Recommended Project Structure |
| CHECK-04 | При недоступности/сбое Answer Checker — один повтор, затем детерминированный fallback (строгое сравнение, `errorType: unknown`) | Pattern 4 (1-retry-then-fallback wrapper); Common Pitfall 4 (broad catch, not narrowed to SDK error classes); D-06/D-07 timeout/retry semantics confirmed against SDK's `RequestOptions` |
| THEORY-03 | При «не понятно» ребёнок получает более простое объяснение (Theory Tutor или заранее написанный fallback-уровень), максимум `maxSimplifyRounds` раз, затем мягкий переход к практике | System Architecture Diagram (theory branch), Common Pitfall 3 (missing `simplifyRoundCount` schema field — must be added), D-11's exact round sequencing carried through from CONTEXT.md |
| RELY-01 | Ответ любого из 5 агентов не считается доверенным, пока ядро не проверит валидность JSON и допустимость значений (единая точка валидации) | Pattern 1 (single Zod schema per contract), Pattern 4 (`callAgent()` as the single validation point, D-05's shared-gateway requirement), Anti-Patterns ("Trusting `strict: true` alone") |
| RELY-02 | При сбое агента (битый JSON, таймаут, недоступность) — один повтор, затем детерминированный fallback; урок не прерывается | Pattern 4, Common Pitfall 4, D-06/D-07; Validation Architecture Wave 0 gap explicitly lists the four distinct failure-simulation test cases needed |
| RELY-03 | В событиях фиксируется источник данных (`core`/`agent`) и факт сбоя — для отладки | System Architecture Diagram (`source`, `agentFailed` in dispatch), `AgentCallResult`/`AgentFallbackResult` typed union in Pattern 4's code example, existing `store.ts` `Action` type extension noted in Recommended Project Structure |
</phase_requirements>

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both packages verified via `npm view` (registry ground truth) and cross-referenced against official docs; version numbers and publish dates are facts, not estimates
- Architecture: HIGH — `tool_choice`/`strict`/error-hierarchy/timeout/retry patterns are all directly quoted from official Anthropic documentation fetched during this research session, not reconstructed from training data
- Pitfalls: HIGH for the two integration-critical findings (async conversion, `.env` prefix gap, missing schema field) — these were discovered by directly reading the current codebase (`main.ts`, `progressSchema.ts`, `.env` keys), not inferred

**Research date:** 2026-07-02
**Valid until:** 30 days (SDK/Zod versions move on a fast cadence — re-verify `npm view` versions if planning is delayed beyond early August 2026; the Anthropic Messages API contract itself, `strict` tool use semantics, and Vite's `import.meta.env` mechanism are stable and unlikely to change within this window)
