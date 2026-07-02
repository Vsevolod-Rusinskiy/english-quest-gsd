<!-- GSD:project-start source:PROJECT.md -->

## Project

**English Quest**

English Quest — интерактивное веб-приложение для практики английского языка ребёнком уровня Intermediate (материал English File Intermediate, юнит 1A). Ребёнок проходит короткий урок (теория + задания), приложение гибко проверяет ответы, ведёт прогресс, повторяет слабые темы и начисляет игровые «рубли»; родитель получает короткий отчёт после урока.

**Core Value:** Проверить механику обучения целиком: детерминированная проверка ответов + LLM-агенты там, где нужна интерпретация, персонализация по прогрессу, повторение слабых тем, начисление бонусов — без единого «сломанного» состояния, даже если агент недоступен.

### Constraints

- **Архитектура**: гибрид детерминированного ядра и LLM-агентов — числа и запись состояния только у ядра, агент предлагает суждение/текст, никогда не пишет числа напрямую
- **Хранение**: только `localStorage`, один ключ `english-quest-progress-v1`, без бэкенда
- **Агенты**: ровно 5 независимых агентов-«функций» (Answer Checker, Progress Advisor, Reward Advisor, Parent Report Generator, Theory Tutor) — один запрос → строгий JSON, без сложной оркестрации между собой
- **Отказоустойчивость**: у каждого агента обязателен детерминированный fallback — урок не должен ломаться при недоступности LLM
- **Стек**: Frontend на HTML/CSS/JavaScript, без указанного фреймворка в спецификации — решение о фреймворке (или его отсутствии) принимается на этапе roadmap/research
- **Данные первого урока**: фиксированы в `Lesson-1A.json`, схема `lesson-json-v1` — реализация должна соответствовать этой схеме, а не изобретать свою

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Framing: this is not a typical "pick a framework" decision

- No backend, no server, no database → no ORM, no auth stack, no server framework.
- Persistence is one `localStorage` key → no IndexedDB, no sync layer, no state-management library with server sync (Redux Toolkit Query, Zustand-persist-to-server, etc. are overkill).
- Exactly 5 narrow single-shot LLM calls with strict JSON contracts and mandatory deterministic fallback → no agent orchestration framework (LangChain, LangGraph, CrewAI, Mastra, Vercel AI SDK agents) is warranted; those solve multi-step planning/tool-loop problems this project explicitly does not have.
- It's a diploma/thesis MVP whose second goal is *demonstrating* a clean deterministic-core/agent-boundary architecture — the stack should make that boundary legible in code, not hide it behind framework magic.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 6.0.x (stable; 6.0.3 latest as of mid-2026) | Static typing over lesson JSON schema, core state, and the 5 agent JSON contracts | The `Lesson-1A.json` schema and each agent's input/output contract (§8 of SPEC.md) are exactly the kind of shape TypeScript is built to pin down. For a thesis that is graded partly on architecture clarity, typed interfaces for `ExerciseAttempt`, `AnswerCheckerResponse`, `RewardAdvisorResponse`, etc. make the core/agent boundary self-documenting. TS 7.0 (Go-ported compiler) is in RC only — stay on the 6.0.x stable line. |
| Vite | 5.x or 6.x (a stable minor; **avoid the 8.x line for this project**, see below) | Dev server + build for a static, framework-free browser app | Vite is the de facto standard bundler/dev-server for browser-only TS apps in 2025/2026 — instant HMR, native ESM dev server, trivial static build (`vite build` → deployable to any static host, e.g. GitHub Pages/Netlify, which matches "no backend"). It needs zero backend-aware configuration, unlike Next.js/Remix/SvelteKit, which assume a server runtime you don't have. |
| Native browser APIs (no UI framework) OR **lightweight**: vanilla TS + small DOM helper, *or* Preact (10.x) if component structure is wanted | — | Rendering the lesson screen, theory step, exercise cards, review queue, parent report | See "Framework or no framework" decision below — the recommendation is vanilla TS with a small hand-rolled render/state layer, not React/Vue/Svelte. |
| `@anthropic-ai/sdk` | 0.106.x (latest; pin a minor, e.g. `^0.106.0`) | Typed client for Claude API calls from the 5 agent functions | Official Anthropic TypeScript SDK, actively maintained (weekly-ish releases), gives typed request/response shapes and built-in retry/timeout handling — useful directly for the "one retry then fallback" rule in SPEC.md §14. |
| Zod | 4.x (4.4.x latest) | Runtime validation of every agent's JSON response before the core trusts it | SPEC.md §14 explicitly requires "agent response is not trusted until the core validates: valid JSON of the expected shape, values from allowed sets." Zod is the standard TS-first runtime validator for exactly this: define one Zod schema per agent contract (`AnswerCheckerResponseSchema`, `RewardAdvisorResponseSchema`, ...), `safeParse()` the LLM output, and reject silently into the deterministic fallback path if it fails. This *is* the enforcement mechanism for "agent proposes, core writes." |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Claude Sonnet 4.5 or 4.6 with **strict tool use** (`strict: true` on a single forced tool) | Sonnet 4.5+ required for the newer `structured-outputs-2025-11-13` beta; strict tool-use alone works on a broader model range | Enforcing exact JSON shape for each of the 5 agents | Two ways to get reliable JSON from Claude: (a) the newer first-party Structured Outputs beta (`output_config.format`, requires `anthropic-beta: structured-outputs-2025-11-13` header, Sonnet 4.5+/Opus 4.1+ only), or (b) classic **strict tool use** — define one tool per agent role with an exact input schema and force `tool_choice: {type: "tool", name: "..."}`. For this project, (b) is the safer default: it's been stable far longer, works with Haiku (see model choice below), and is trivially paired with Zod validation as a second line of defense. Use (a) only if you specifically want to test the newer beta as part of the "practice AI architecture" goal — but always keep Zod validation regardless, since the core must never trust the network blindly. |
| Claude **Haiku 4.5** for all 5 agents (default) | Haiku 4.5, $1/$5 per MTok in/out | Answer Checker, Progress Advisor, Reward Advisor, Parent Report Generator, Theory Tutor | All 5 roles are single-shot, short-context, narrow-schema JSON tasks (classify an error type, pick a difficulty, write 1-2 short Russian sentences). This is squarely Haiku's sweet spot — Anthropic's fastest/cheapest current model, ~3x cheaper than Sonnet 4.6 ($3/$15). For a diploma project with no production budget and a child user waiting on answer-checking latency, Haiku's speed matters more than Sonnet's extra reasoning depth. If a specific agent (e.g., Theory Tutor's simplification quality) proves too shallow on Haiku during testing, swap only that one call to Sonnet — don't default all 5 to Sonnet. |
| Cloudflare Workers (or Vercel Edge Functions / Netlify Functions) as a **thin API-key proxy** | N/A (platform, not a package) | The one piece of "backend" needed to keep the Claude API key out of the browser bundle | The project's constraint says "no backend," but calling Claude directly from client JS with `dangerouslyAllowBrowser: true` embeds the real API key in shipped code — anyone can extract and abuse it. A single serverless function (a few lines) that receives `{agentRole, payload}`, holds the API key as a platform secret, and forwards to Claude is not "a backend" in the app-architecture sense (no database, no sessions, no app logic) — it is the accepted minimal-footprint pattern for "static frontend + LLM." Cloudflare Workers' free tier (100k req/day) is more than sufficient for a diploma demo. Document this clearly in ARCHITECTURE.md/PROJECT.md as a scoped exception to "no backend," not a violation of it. |
| Vitest | 4.x (4.1.x latest) | Unit tests for the deterministic core (answer normalization, reward rules, status thresholds, JSON validation of agent contracts) | The core is explicitly the part of this project that must be "deterministic and testable" (SPEC.md §7). Vitest is the standard Vite-native test runner — zero extra config beyond what Vite already has, Jest-compatible API, fast. Write tests for `checkAnswer()`, reward-rule application, and Zod-schema rejection of malformed agent JSON — these are the highest-value, easiest-to-grade tests for a thesis defense. |
| ESLint + `typescript-eslint`, Prettier | current majors | Code quality / consistent style | Standard baseline for any TS project; not a research risk, just include it. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite dev server | Local development with instant reload | `vite dev` — proxy `/api/agent` calls to a local dev version of the Cloudflare Worker (via `wrangler dev` or a tiny local Express/Vite-plugin stub) so the browser never needs a real key during development either. |
| `wrangler` (Cloudflare CLI) | Deploy and locally run the proxy Worker | Only needed if Cloudflare Workers is the chosen proxy host; trivial `wrangler dev` / `wrangler deploy` workflow. |
| Zod (dev-time) | Also usable to validate `Lesson-1A.json` against a schema at build/load time | Optional but cheap: derive a `LessonSchema` from the `lesson-json-v1` shape and validate the lesson file on load, catching authoring mistakes before runtime. |

## Installation

# Core

# Dev dependencies

# If using Preact instead of vanilla DOM (optional, see decision below)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Vanilla TS + small hand-rolled render layer | React 19 / Preact / Svelte / Vue | Use a component framework if the UI grows beyond ~1 lesson flow with many interactive states (theory step, 4 exercise types, review queue, parent report) *and* you want React-familiar code for a portfolio angle, or if you plan to extend past MVP into multi-lesson/multi-student UI significantly. For a single fixed lesson flow with ~5 screen states, vanilla TS keeps the "core/agent boundary" fully visible in plain functions and avoids framework-specific state-management decisions that are irrelevant to the thesis's actual research question. If you do want a framework, Preact (3kb, React-compatible API) is the better fit than full React for a bundle-size-conscious static app — but it's still optional, not required. |
| Cloudflare Workers as key-proxy | A "bring your own API key" client-side pattern (`dangerouslyAllowBrowser: true`, user pastes their own key) | Legitimate only if the deployed demo is for trusted graders/reviewers who each provide their own key, and you explicitly want zero server-side code at all. Weakens the "just works" demo experience (grader must obtain and paste a key) — acceptable tradeoff only if minimizing infra to literally zero is more important than demo smoothness. |
| Claude Haiku 4.5 for all 5 agents | Claude Sonnet 4.5/4.6 for all 5 agents | Use Sonnet if Haiku's output quality for Theory Tutor's simplified Russian explanations or Answer Checker's error-type classification proves noticeably weaker in manual testing — swap per-agent, not globally, to keep cost/latency low elsewhere. |
| Strict tool-use for JSON contracts | First-party Structured Outputs beta (`structured-outputs-2025-11-13`) | Use the beta if you specifically want to showcase the newest Anthropic feature for the "practice AI architecture" thesis angle, and you've confirmed Sonnet 4.5+/Opus 4.1+ access. Keep Zod validation in both cases — the beta guarantees schema-valid JSON from Claude's side, but the core should never assume that guarantee alone (defense in depth, and it also validates when the deterministic fallback path constructs the same-shaped object). |
| Zod for runtime validation | `ajv` (raw JSON Schema validator), or hand-written type guards | Use `ajv` only if you want to validate directly against JSON Schema definitions shared with a non-TS system (not the case here — everything is TS). Hand-written guards are more code for equivalent safety; Zod is strictly less boilerplate for this project's scale (5 small schemas). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| LangChain / LangGraph / CrewAI / Mastra or any agent-orchestration framework | These solve multi-step planning, tool loops, memory, and multi-agent coordination — none of which this project has. SPEC.md explicitly rejects "complex multi-agent orchestration" (5 independent single-call functions, orchestrated by the deterministic core itself). Pulling in a framework here would hide the exact core/agent boundary that is the thesis's second grading criterion, and add a large dependency surface for zero benefit. | Plain functions: `callAnswerChecker(input): Promise<AnswerCheckerResponse>` etc., each wrapping `@anthropic-ai/sdk` + Zod validation + one retry + fallback, called directly by core logic at the fixed points listed in SPEC.md §17. |
| Calling Claude directly from the browser with a real embedded API key (`dangerouslyAllowBrowser: true` + hardcoded key) | Anthropic's own SDK issue thread and docs flag this as a named "dangerous" footgun for exactly this reason: any visitor can read the key out of the shipped JS bundle and use it on your account. For a publicly deployed diploma demo this is a real financial/abuse risk, not a theoretical one. | Thin serverless proxy (Cloudflare Workers/Vercel/Netlify function) holding the key server-side; browser calls your proxy endpoint, never Anthropic directly. |
| React + Redux/Zustand/any global-state library for a single-lesson MVP | Massively over-engineered for one lesson flow with one `localStorage` key and ~5 screen states; adds bundle size, build complexity, and a state-management layer that competes conceptually with the "deterministic core owns all state" architecture the thesis is trying to demonstrate cleanly. | Vanilla TS module with a single in-memory state object mirroring the `localStorage` shape, read/written only by core functions. |
| IndexedDB / Dexie / any client database library | SPEC.md is explicit: "only `localStorage`, one key." Introducing IndexedDB contradicts the stated architecture and adds async-storage complexity (transactions, migrations) with no benefit at this data scale (one lesson, one student profile). | `localStorage.getItem/setItem` with a single versioned JSON blob (`english-quest-progress-v1`), synchronous and simple. |
| TypeScript 7.0 (RC as of mid-2026, Go-ported compiler) | Not yet stable; using an RC compiler in a graded thesis project risks toolchain instability during the exact weeks you need reliability. | TypeScript 6.0.x stable line. |
| Vite 8.x (Rolldown-powered, released mid-2026) for this project specifically | Very new major version (weeks old as of research date) with a materially different bundler internals (Rust/Rolldown replacing esbuild+Rollup) and ~15MB larger install; higher risk of edge-case plugin/config incompatibilities during a time-boxed thesis build. | Vite 5.x or 6.x — mature, extremely well-documented, no meaningful feature gap for a static TS app with no exotic bundler needs. |
| Raw `fetch()` to Claude with hand-parsed JSON and no schema validation | The single biggest risk to the "agent proposes, core writes, never crashes on bad agent output" architectural promise (SPEC.md §14) is trusting LLM output without validation. Hand-parsing invites silent bugs where malformed-but-valid-JSON slips through. | `@anthropic-ai/sdk` for the call + Zod `safeParse()` on every response before the core acts on it. |

## Stack Patterns by Variant

- Skip the Cloudflare Workers proxy.
- Use `dangerouslyAllowBrowser: true` with a key entered by the user into a settings field (never hardcoded, never committed) and stored only in `sessionStorage`/memory, not the shared `localStorage` progress key.
- Document this clearly as an explicit scoped tradeoff in ARCHITECTURE.md, not a default recommendation.
- Deploy the Cloudflare Workers proxy (or Vercel/Netlify function) with your own key as a platform secret, rate-limited if possible.
- This is the recommended default — it lets the deployed app "just work" for graders without any setup step, while keeping the key safe.
- Add Preact (10.x) purely as a rendering layer; keep all state and business logic in plain TS modules outside any component framework, so the core/agent boundary stays framework-agnostic and easy to unit-test without a component-testing library.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `vite@5.x` / `vite@6.x` | `vitest@4.x`, `typescript@6.0.x` | Vitest 4.x is built on top of Vite's dev-server internals; keep both on current stable minors together, don't mix Vitest 4 with a pre-5 Vite. |
| `@anthropic-ai/sdk@0.106.x` | Node 18+ in the proxy function; browser via bundler for any client-side typed request builders (not for actual key-bearing calls) | The SDK itself works in both Node (serverless function) and browser (CORS-enabled) contexts — but only use it browser-side for the "bring your own key" variant. |
| `zod@4.x` | TypeScript 5.x and 6.x | Zod 4 dropped some legacy TS-version support present in Zod 3; on TS 6.0.x this is a non-issue. |

## Sources

- https://vite.dev/releases — Vite 8.0/8.1 release info (MEDIUM confidence, cross-checked with npm listing and GitHub releases)
- https://www.npmjs.com/package/vite — current published version
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs — official Anthropic docs on Structured Outputs / strict tool use (MEDIUM-HIGH confidence, official source)
- https://github.com/anthropics/anthropic-sdk-typescript/issues/248 and https://news.ycombinator.com/item?id=41326384 — `dangerouslyAllowBrowser` rationale and risk (MEDIUM confidence, corroborated across GitHub issue + community discussion + Anthropic SDK naming itself)
- https://www.npmjs.com/package/zod and https://zod.dev/v4 — Zod version and Zod 4 feature set (MEDIUM confidence)
- https://platform.claude.com/docs/en/about-claude/pricing — Claude model pricing (MEDIUM confidence; cross-checked against 3+ independent 2026 pricing round-up articles reporting consistent numbers)
- https://www.npmjs.com/package/vitest — Vitest current version
- https://www.npmjs.com/package/typescript and https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/ — TypeScript 6.0 stable vs 7.0 RC status
- https://www.npmjs.com/package/@anthropic-ai/sdk — Anthropic TypeScript SDK current version
- https://developers.cloudflare.com/workers/ and https://medium.com/@IamCOD3X/%EF%B8%8Fhide-your-api-keys-on-a-static-site-with-cloudflare-workers-3c87077da309 — serverless key-proxy pattern (MEDIUM confidence, standard documented pattern corroborated across multiple independent write-ups)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
