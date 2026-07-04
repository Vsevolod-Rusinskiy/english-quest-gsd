# Phase 1: Deterministic Core, Lesson Rendering & Persistence - Research

**Researched:** 2026-07-02
**Domain:** Browser-only vanilla TypeScript app — lesson data validation (Zod), deterministic answer-checking, DOM rendering without a framework, localStorage persistence with schema versioning
**Confidence:** HIGH (core stack versions verified against npm registry live; architecture/pitfalls patterns carried forward from already-completed project-level research and cross-checked; exercise-type schema gap discovered via direct inspection of `Lesson-1A.json`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use TypeScript (not plain JS) with Vite as the build tool and Vitest for tests, per `research/STACK.md`. This stays within SPEC.md's "no backend, browser-only" constraint (TS compiles to the same static JS bundle) while making the deterministic core — the part of the MVP graded most heavily — type-checked and unit-testable from day one.
- **D-02:** Use Zod to define and validate the `Lesson-1A.json` shape (`lesson-json-v1`) at load time. This directly addresses the PITFALLS.md-flagged risk that `acceptedAnswers` completeness and lesson-schema drift are silent failure modes; a validation failure at load time surfaces loudly instead of producing confusing runtime bugs later. The same Zod pattern will be reused for agent-response validation in Phase 3, so introducing it now is consistent, not premature.
- **D-03:** Every state-changing action (exercise answered, theory step marked understood, lesson position advanced) triggers an immediate synchronous `localStorage` write under the single key `english-quest-progress-v1`. No debouncing. Rationale: PERSIST-02 and Phase 1 Success Criterion #4 require that a reload restores "exactly where the child left off" — debounced/delayed writes risk losing the last action on an untimely reload, which is unacceptable for a young child who may close the tab mid-exercise.
- **D-04:** Persisted state includes not just `studentProfile`/`lessonHistory`/stats (per SPEC.md §7) but also **current lesson session position** — which step/exercise the child is on and whether the theory block was already marked "понятно" — so a reload mid-theory or mid-exercise resumes at the same point rather than restarting the lesson from the top. This is required to satisfy Phase 1's own success criterion #4 literally ("restores exactly where the child left off"), which is broader than the persistence fields SPEC.md enumerates for cross-session history.
- **D-05:** `order-builder` exercises use a tap-based interaction: available words shown as tappable chips in a word bank; tapping a chip appends it to the answer sequence; tapping a chip already in the sequence removes it (or moves it back to the bank). No drag-and-drop in Phase 1. Rationale: drag-and-drop is materially more failure-prone for a young Intermediate-level child on unknown devices (touch vs. mouse, accidental drags) and is a UI/interaction-mechanics choice, not a visual-polish choice — Phase 5 can restyle the chips/animations without changing this underlying interaction model.
- **D-06:** On app start, `Lesson-1A.json` is parsed and validated against the Zod schema before any rendering happens. A validation failure shows a clear, non-cryptic error state rather than allowing the app to render with malformed/missing exercise data. This is a Phase 1 concern (lesson rendering foundation), not deferred to later phases, because every downstream phase depends on lesson data being structurally trustworthy.

### Claude's Discretion

- Exact module/file layout within the Phase 1 codebase (e.g., how `StateStore`, `LessonLoader`, and per-exercise-type renderers are split into files) is left to the planner/executor, informed by `research/ARCHITECTURE.md`'s suggested component boundaries (StateStore core, LessonLoader, exercise renderers per type).
- Specific normalization regex/implementation details for `text-input` exact-match (case, whitespace, punctuation stripping) follow SPEC.md §7 literally; no additional decision needed here.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 1 scope. Agent integration, reward/review-queue logic, and visual design were correctly identified as belonging to Phases 2, 2, 3/4, and 5 respectively and were not discussed here.
</user_constraints>

## Project Constraints (from CLAUDE.md)

`.claude/CLAUDE.md` (project instructions, loaded per `plan_review.source_grounding` config) restates the following as hard architectural constraints applicable to every phase, including Phase 1:

- **Architecture:** hybrid deterministic-core + LLM-agent split — numbers and state writes belong only to the core; agents (Phase 3+) only propose judgment/text, never write numbers directly. Phase 1 has zero agents, so this constraint manifests simply as: all Phase 1 logic is deterministic core code, no exceptions.
- **Storage:** `localStorage` only, single key `english-quest-progress-v1`, no backend. Confirmed consistent with D-03/D-04/PERSIST-01/PERSIST-02.
- **Agents:** exactly 5 independent single-shot "function" agents — not applicable to Phase 1's scope (zero agents wired in this phase), but confirms Phase 1 must not pre-build any agent-shaped abstraction prematurely.
- **Fault tolerance:** every agent requires a deterministic fallback — not applicable to Phase 1 directly (no agents yet), but the *pattern* (core never assumes success, defensive reads/parses) is directly reflected in Pattern 2's `load()` defensive-parse implementation and D-06's fail-loudly validation.
- **Stack:** no framework mandated in the original spec; framework decision belongs to research/roadmap — already resolved as "no framework" per D-01/STACK.md/ARCHITECTURE.md Anti-Pattern 1, reconfirmed in this phase's research (no new reason to deviate).
- **Lesson data:** fixed in `Lesson-1A.json`, schema `lesson-json-v1` — implementation must conform to this schema, not invent its own. Directly enforced by D-02/D-06 and this research's Pattern 1 Zod schema, which is built from the actual file's field names rather than an idealized/generic schema.

No conflicts found between CLAUDE.md's constraints and this phase's locked decisions (D-01 through D-06) or the recommended stack/architecture below.

## Summary

Phase 1 is a pure client-side, framework-free TypeScript build: load `Lesson-1A.json`, validate it against a Zod schema, render the theory block and 19 exercises across 2 exercise types actually present in the data (`text-input` ×18, `matching` ×1) plus 2 exercise types the code must support per SPEC.md/REQUIREMENTS.md but that have **zero example data in `Lesson-1A.json`** (`single-choice`, `order-builder`), check answers deterministically (normalize + exact/id/pair compare, no LLM), and persist progress synchronously to `localStorage` under `english-quest-progress-v1` with an internal `schemaVersion` field so a reload resumes exactly where the child left off — including mid-theory and mid-exercise position, not just cross-session stats.

The stack decision is already locked by `01-CONTEXT.md` (D-01/D-02): TypeScript + Vite + Vitest + Zod, no UI framework. This research verifies the exact current versions of each (Vite has moved to 8.x since project-level STACK.md was written — **stay on Vite 6.x, not 8.x**, per that research's explicit guidance, confirmed still valid), confirms Vitest 4 works fine against Vite 6 as a peer range, and works out concrete Zod v4 schema patterns for the `Lesson-1A.json` shape, including the specific place where the schema for `single-choice`/`order-builder` must be **designed** rather than reverse-engineered, since no real exercise of either type exists to validate against.

**Primary recommendation:** Scaffold with `npm create vite@latest -- --template vanilla-ts`, pin Vite to the 6.4.x line (not the installed-by-default 8.x), add Vitest 4 + jsdom for DOM-touching tests, model `Lesson-1A.json` as a Zod `z.discriminatedUnion("type", [...])` over exercise type with a nested `z.discriminatedUnion("mode", [...])` for `answerCheck`, and design `single-choice`/`order-builder` schemas defensively (they have no real fixture data — treat this as a documented content-authoring gap, not a code gap) with unit tests exercising both extra types via hand-authored fixture JSON, not real lesson content.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lesson data validation (Zod parse of `Lesson-1A.json`) | Browser / Client (boot-time module) | — | No backend exists; `fetch()`/import happens entirely client-side, validation must run before any render call |
| Theory block render + понятно/не понятно buttons | Browser / Client (DOM render layer) | — | Pure UI state machine reading `theory.explanationLevels`; no persistence beyond round counter (ephemeral this phase; Theory Tutor escalation is Phase 3) |
| 4 exercise-type renderers (`text-input`, `single-choice`, `matching`, `order-builder`) | Browser / Client (DOM render layer) | — | Stateless render functions keyed by `exercise.type`, emit events upward, never mutate state directly (per ARCHITECTURE.md Component Responsibilities) |
| Answer normalization + exact/id/pair comparison (`checkAnswer` deterministic path) | Browser / Client (core module, zero DOM/LLM awareness) | — | Pure functions per ARCHITECTURE.md `core/answer-checking/*`; fully unit-testable in isolation, no I/O |
| Progress counters (attempts, per-exercise correctness) — **not** full topic-status FSM | Browser / Client (core module) | — | PROGRESS-02/03/04 (topic status machine, reviewQueue) are explicitly Phase 2 scope; Phase 1 only needs enough state to drive EXERCISE-05's "task N of 19" indicator and CHECK-01/02 correctness tracking |
| Progress persistence (localStorage read/write, schema versioning) | Browser / Client (persistence adapter) | — | `localStorage` is the only storage tier this project has; adapter pattern isolates the browser API per ARCHITECTURE.md `PersistenceAdapter` |
| Lesson content loading (fetch/import `Lesson-1A.json`) | Browser / Client (build-time or fetch-time) | CDN / Static (as a bundled/copied asset) | Vite serves it as a static asset either via `resolveJsonModule` import (bundled into JS) or `fetch()` from `public/`; no server round-trip |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| THEORY-01 | Ребёнок видит блок теории (правило + пример) перед началом упражнений урока | `Lesson-1A.json`'s `theory` block (`rule`, `explanationLevels[0].textRu`/`exampleRu`) is validated by the lesson Zod schema (Pattern 1) and rendered by `ui/screens/TheoryScreen.ts` per the Recommended Project Structure; System Architecture Diagram traces the full boot→render flow |
| THEORY-02 | Ребёнок может отметить теорию как «понятно» или «не понятно» | `TheoryUnderstoodToggled` event flows through `LessonEngine.handleTheoryStep` → `StateStore.dispatch` → synchronous `save()` per D-03; see Pitfall 3 for the exact save-boundary distinction (submit-level events only) |
| EXERCISE-01 | Ребёнок проходит упражнения типа `text-input` с вводом текстового ответа | `TextInputExerciseSchema` (Pattern 1) validates the 18 real `text-input` exercises in `Lesson-1A.json`; `core/answer-checking/checkTextInput.ts` + `normalize()` (Code Examples) implement CHECK-01's normalization+exact-match |
| EXERCISE-02 | Ребёнок проходит упражнения типа `single-choice` | **Gap flagged:** no real fixture exists in `Lesson-1A.json` (Pitfall 1, Assumption A1, Open Question 1) — `SingleChoiceExerciseSchema` (Pattern 1) is a designed-not-verified shape; planner must treat the exact `answerCheck.mode` field name as an executor-discretion decision, tested against hand-authored fixtures |
| EXERCISE-03 | Ребёнок проходит упражнения типа `matching` (картинка → слово) | `MatchingExerciseSchema` (Pattern 1) validates the 1 real `matching` exercise (8 pairs) in `Lesson-1A.json`; `core/answer-checking/checkMatching.ts` implements pair-id comparison per CHECK-02 |
| EXERCISE-04 | Ребёнок проходит упражнения типа `order-builder` | **Gap flagged:** no real fixture exists (same as EXERCISE-02) — `OrderBuilderExerciseSchema` (Pattern 1) + tap-based interaction model (Pattern 3, per locked decision D-05) are designed-not-verified; hand-authored fixtures required for testing |
| EXERCISE-05 | Ребёнок видит индикатор прогресса по уроку («задание N из 19») | `ui/components/ProgressIndicator.ts`; Open Question 2 clarifies the denominator should read from `sections[].exercises.length` (currently 19) rather than a hardcoded literal, so Phase 2's reviewQueue extension doesn't require touching this component |
| CHECK-01 | Ядро нормализует текстовый ответ (нижний регистр, trim, схлопывание пробелов, удаление финальной пунктуации) и точно сравнивает с `acceptedAnswers` | `normalize()` function (Code Examples) implements SPEC §7 literally; Anti-Patterns section explicitly warns against fuzzy/edit-distance matching, which would violate this requirement's "точно сравнивает" (exact compare) mandate |
| CHECK-02 | Для `single-choice`/`matching`/`order-builder` ядро детерминированно сравнивает выбор/сборку с ожидаемым результатом без вызова агента | All 3 checker functions (`checkSingleChoice.ts`, `checkMatching.ts`, `checkOrderBuilder.ts`) are pure functions with zero LLM/network awareness, per the Architectural Responsibility Map and Pattern 3's `checkOrderBuilder` example — no agent call exists anywhere in Phase 1's code paths |
| PERSIST-01 | Прогресс (`studentProfile`, `lessonHistory`, статистика, `currentRewards`, `rewardHistory`, `reviewQueue`) сохраняется в `localStorage` под ключом `english-quest-progress-v1` | Pattern 2 (versioned localStorage blob) implements the exact key name and root-shape wrapper (`{schemaVersion, data}`); note full `rewardHistory`/`reviewQueue` population is Phase 2 scope (PROGRESS-01..04, REWARD-01/02) — Phase 1 only needs the storage mechanism + whatever minimal fields D-04 requires for position-resume, not the full stat engine |
| PERSIST-02 | Прогресс переживает перезагрузку страницы браузера | System Architecture Diagram's "on page reload" flow + Validation Architecture's PERSIST-02 test row (`persistence.test.ts -t "reload"`) cover this end-to-end; D-04's mid-lesson-position requirement is the literal, stricter interpretation Phase 1 must satisfy |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | `6.0.3` [VERIFIED: npm registry] | Static typing over lesson JSON schema and core state | Confirmed current stable via `npm view typescript version` (registry, 2026-07-02). TS 7.0 (Go-ported compiler) remains RC-only — do not use. |
| Vite | `6.4.3` (pin to `^6.4.0`, NOT the registry-default-latest `8.1.3`) [VERIFIED: npm registry] | Dev server + static build | `npm view vite version` returns `8.1.3` as the npm dist-tag `latest` — this is a **newer major** than what project-level STACK.md validated and explicitly recommended avoiding ("avoid the 8.x line for this project... higher risk of edge-case plugin/config incompatibilities during a time-boxed build"). Vitest 4's own `peerDependencies` list (`vite: '^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0'`) confirms 6.x is still fully supported, so pin explicitly: `npm install -D vite@^6.4.0`, do not let `npm install -D vite` silently grab 8.x. |
| Vitest | `4.1.9` [VERIFIED: npm registry] | Unit tests for deterministic core + DOM-touching render tests | Confirmed current stable via `npm view vitest version`. Requires Node `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` — local environment is Node `v22.23.1`, compatible. |
| Zod | `4.4.3` [VERIFIED: npm registry] | Runtime validation of `Lesson-1A.json` at load time + progress-blob validation on read | Confirmed current stable (`dist-tags.latest`) via `npm view zod dist-tags`. `4.4.x` post-dates the `4.4.x` figure cited in project-level STACK.md — patch-level drift only, no breaking API changes since. |
| jsdom | `29.1.1` [VERIFIED: npm registry] | DOM environment for Vitest when testing DOM-touching render code | Listed in Vitest's own `peerDependencies` as an optional environment provider (`jsdom: '*'`); needed because Phase 1 renders real DOM elements for 4 exercise types and the theory block, and those render functions should be unit/integration tested, not just eyeballed manually. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vitest/coverage-v8` | matches Vitest `4.1.9` [VERIFIED: npm registry] | Code coverage for the deterministic core (answer-checking, normalization, persistence) | Optional but recommended given this phase's core is explicitly the most heavily-graded/tested part of the project per PROJECT.md; run `vitest --coverage` on `core/` only, not `ui/`. |
| ESLint + `typescript-eslint`, Prettier | current majors | Code quality baseline | Already listed as non-research-risk in project-level STACK.md; include for consistency, no version-pin research needed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite 6.4.x | Vite 8.1.3 (npm default `latest`) | Vite 8's Rolldown-powered internals are materially different (Rust/Rolldown replacing esbuild+Rollup) and only weeks old as of this research — higher risk of plugin/config edge cases during a time-boxed build with zero payback for this project's simple static-TS-bundle needs. Explicitly avoid per project-level STACK.md, still valid. |
| `resolveJsonModule` TS import of `Lesson-1A.json` | `fetch('/Lesson-1A.json')` from `public/` at runtime | Direct `import` gives compile-time type inference and is bundled (zero-latency, no network request, works offline); `fetch()` allows swapping the lesson file without a rebuild (relevant for a future multi-lesson catalog, out of scope for v1) but adds an async boundary and a failure mode (404/parse error) that a bundled import doesn't have. **Recommendation: use `fetch()`** — it exercises the exact "fail loudly on load" boundary D-06 requires (a bundled import that fails would be a build-time TypeScript error, not the runtime validation failure state D-06 specifies) and matches ARCHITECTURE.md's `LessonLoader` component description ("`fetch()` + `JSON.parse` + shape assertion at load time"). |
| Zod v4 `z.discriminatedUnion` | Zod v3 `z.union` (untagged) or hand-written type guards | Untagged unions give worse error messages and O(n) validation attempts per candidate schema; discriminated unions are Zod's purpose-built solution for exactly this "type field determines shape" case and give better TypeScript narrowing via `switch` on the discriminator. |

**Installation:**
```bash
npm create vite@latest . -- --template vanilla-ts
npm install zod@^4.4.0
npm install -D vite@^6.4.0 vitest@^4.1.0 jsdom@^29.1.0 @vitest/coverage-v8@^4.1.0
```

**Version verification:** All four core packages (`typescript`, `vite`, `vitest`, `zod`) were checked live against the npm registry on 2026-07-02 via `npm view <pkg> version` / `dist-tags`. Vite's registry-default `latest` (`8.1.3`) is explicitly NOT the recommended install target for this project — pin `vite@^6.4.0` in `package.json` deliberately, don't accept whatever `npm create vite@latest` scaffolds without checking the generated `package.json`.

## Package Legitimacy Audit

| Package | Registry | Age (published-at, note: reflects latest patch, not first release) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| typescript | npm | latest patch 2026-04-16 | 217M/wk | github.com/microsoft/TypeScript | OK | Approved |
| vite | npm | latest patch 2026-07-02 | 141M/wk | github.com/vitejs/vite | SUS (seam flag: "too-new") — see note | Approved, pin to 6.4.x |
| vitest | npm | latest patch 2026-06-15 | 69M/wk | github.com/vitest-dev/vitest | SUS (seam flag: "too-new") — see note | Approved |
| zod | npm | latest patch 2026-05-04 | 210M/wk | github.com/colinhacks/zod | OK | Approved |
| jsdom | npm | latest patch 2026-04-30 | 77M/wk | github.com/jsdom/jsdom | OK | Approved |

**Note on the `vite`/`vitest` `[SUS]` flags:** the automated legitimacy check flags "too-new" based on the *most recent patch release's* publish date, not the package's overall age or trustworthiness. Both packages are long-established (multi-year), extremely high-download (69M-141M/week), officially maintained (`vitejs`/`vitest-dev` GitHub orgs), zero deprecation, no suspicious postinstall scripts. This is a false-positive pattern inherent to fast-shipping projects with frequent patch releases — **not** a slopsquatting or supply-chain signal. Both are approved for use without a `checkpoint:human-verify` gate.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `vite`, `vitest` — flagged only due to recent-patch-publish-date heuristic, not actual suspicion; see note above. No additional planner gate needed given the corroborating signals (download count, repo ownership, no postinstall scripts).

## Architecture Patterns

### System Architecture Diagram

```
[Browser loads index.html + bundled/served JS]
    │
    ▼
[main.ts boot sequence]
    │
    ├──▶ [LessonLoader: fetch('/Lesson-1A.json')]
    │        │
    │        ▼
    │    [Zod: LessonSchema.safeParse(rawJson)]
    │        │
    │        ├── success ──▶ [typed Lesson object, treated as immutable reference data]
    │        │
    │        └── failure ──▶ [render non-cryptic error state; STOP — do not proceed to lesson UI] (D-06)
    │
    ├──▶ [PersistenceAdapter: localStorage.getItem('english-quest-progress-v1')]
    │        │
    │        ├── found + schemaVersion matches ──▶ [parsed + Zod-validated ProgressState]
    │        ├── found + schemaVersion mismatch ──▶ [run migration pipeline OR reset to fresh state]
    │        ├── found + fails Zod validation (corrupt) ──▶ [reset to fresh state, log warning]
    │        └── not found ──▶ [fresh initial ProgressState]
    │
    ▼
[StateStore: in-memory object, single source of truth, holds Lesson + ProgressState + current position]
    │
    ├──▶ subscribe ──▶ [UI renderers: TopBar, TheoryScreen, ExerciseCard×4-types, ProgressIndicator]
    │
    ▼
[Child interacts: taps "понятно"/"не понятно", types text-input answer, taps single-choice option,
 taps matching pairs, taps order-builder word-bank chips]
    │
    ▼
[Event: AnswerSubmitted(exerciseId, rawAnswer) OR TheoryUnderstoodToggled]
    │
    ▼
[LessonEngine.handleAnswer / handleTheoryStep]
    │
    ▼
[core/answer-checking/*: normalize(rawAnswer) → exact/id/pair compare — NO agent call this phase]
    │
    ▼
[verdict: {isCorrect, source: 'core'}]
    │
    ▼
[StateStore.dispatch('exercise_attempt' | 'theory_step', event)]
    │           │                    │
    │           ▼                    ▼
    │    [update position:      [update per-exercise
    │     current step/         attempt counters]
    │     exercise index]
    │
    ▼
[PersistenceAdapter.save(state) — SYNCHRONOUS, immediate, no debounce] (D-03)
    │
    ▼
[localStorage.setItem('english-quest-progress-v1', JSON.stringify({schemaVersion, ...state}))]
    │
    ▼
[StateStore notifies subscribers] ──▶ [UI re-renders: FeedbackBanner, progress "N of 19", next exercise]

--- separately, on page reload ---

[Browser reload] ──▶ [main.ts boot sequence re-runs] ──▶ [PersistenceAdapter.load() restores exact
                                                            position: current step index + theory
                                                            understood flag] ──▶ [UI resumes at
                                                            same point, not lesson start] (D-04)
```

### Recommended Project Structure
```
src/
├── core/                          # zero DOM/LLM awareness, 100% unit-testable
│   ├── lesson/
│   │   ├── lessonSchema.ts        # Zod schema for lesson-json-v1 (D-02)
│   │   └── lessonLoader.ts        # fetch + validate Lesson-1A.json (D-06)
│   ├── answer-checking/
│   │   ├── normalize.ts           # lowercase/trim/collapseSpaces/stripFinalPunctuation (SPEC §7)
│   │   ├── checkTextInput.ts
│   │   ├── checkSingleChoice.ts
│   │   ├── checkMatching.ts
│   │   └── checkOrderBuilder.ts
│   ├── state/
│   │   ├── progressSchema.ts      # Zod schema for the localStorage blob incl. schemaVersion
│   │   ├── store.ts               # StateStore: get/set/subscribe
│   │   ├── persistence.ts         # load()/save(), sync write (D-03), migration guard
│   │   └── initialState.ts        # default shape for a fresh session
│   └── lessonEngine.ts            # orchestrator: theory → exercises → done (Phase 1 slice of SPEC §17)
├── ui/                             # reads state, emits events, never writes state directly
│   ├── screens/
│   │   ├── TheoryScreen.ts
│   │   └── ExerciseScreen.ts
│   ├── exercise-renderers/
│   │   ├── textInput.ts
│   │   ├── singleChoice.ts
│   │   ├── matching.ts
│   │   └── orderBuilder.ts        # tap-based word bank + sequence (D-05)
│   └── components/
│       ├── ProgressIndicator.ts   # "задание N из 19" (EXERCISE-05)
│       └── FeedbackBanner.ts      # correct/incorrect states
└── main.ts                         # boot: load lesson → load/init state → mount UI → subscribe

public/
└── Lesson-1A.json                  # served as static asset for fetch()

tests/
├── core/
│   ├── lesson/lessonSchema.test.ts
│   ├── answer-checking/*.test.ts
│   └── state/persistence.test.ts
└── ui/
    └── exercise-renderers/*.test.ts   # jsdom-based render assertions
```

### Pattern 1: Zod discriminated union over `exercise.type`, nested discriminated union over `answerCheck.mode`

**What:** Model each exercise as a tagged union keyed by `type`, and within each variant, model `answerCheck` as a second tagged union keyed by `mode`. This mirrors the actual `Lesson-1A.json` shape exactly: `text-input` exercises always pair with `answerCheck.mode: "normalizedText"` (`correctAnswers`/`acceptedAnswers` arrays), and `matching` exercises always pair with `answerCheck.mode: "pairIds"` (`pairs` array of `{leftId, rightId}`), plus `matching`-only top-level fields `leftItems`/`rightOptions`.

**When to use:** Any time a JSON field's presence/shape depends on a sibling discriminator field — this is exactly `Lesson-1A.json`'s design (`type` at the exercise level, `mode` at the `answerCheck` level).

**Example:**
```typescript
// Source: Zod v4 official docs (zod.dev/api) — verified pattern, cross-checked against actual Lesson-1A.json shape
import * as z from "zod";

const SourceRefSchema = z.object({
  sourceBook: z.string(),
  unit: z.string(),
  page: z.string(),
  exerciseNumber: z.string(),
});

const HintSchema = z.object({
  firstError: z.string(),
  secondError: z.string().optional(),   // NOT present on every exercise — verified: 9/19 exercises omit it
  parentExplanation: z.string(),
});

const NormalizedTextCheckSchema = z.object({
  mode: z.literal("normalizedText"),
  correctAnswers: z.array(z.string()),
  acceptedAnswers: z.array(z.string()),
});

const PairIdsCheckSchema = z.object({
  mode: z.literal("pairIds"),
  pairs: z.array(z.object({ leftId: z.string(), rightId: z.string() })),
});

const BaseExerciseFields = {
  exerciseId: z.string(),
  catalogRef: z.string(),
  catalogItemRef: z.string(),
  sourceRef: SourceRefSchema,
  skill: z.string(),
  prompt: z.string(),
  targetWords: z.array(z.string()),
  targetGrammar: z.array(z.string()),
  hint: HintSchema,
  topicImpact: z.array(z.string()),
};

const TextInputExerciseSchema = z.object({
  ...BaseExerciseFields,
  type: z.literal("text-input"),
  answerCheck: NormalizedTextCheckSchema,
});

const MatchingExerciseSchema = z.object({
  ...BaseExerciseFields,
  type: z.literal("matching"),
  answerCheck: PairIdsCheckSchema,
  leftItems: z.array(z.object({ id: z.string(), imagePrompt: z.string() })),
  rightOptions: z.array(z.object({ id: z.string(), labelEn: z.string() })),
});

// NOTE: single-choice and order-builder have NO real fixture in Lesson-1A.json —
// see "Runtime State Inventory" / "Open Questions" for the designed-not-verified shape.
const SingleChoiceExerciseSchema = z.object({
  ...BaseExerciseFields,
  type: z.literal("single-choice"),
  answerCheck: z.object({
    mode: z.literal("choiceId"),          // [ASSUMED] — no real data confirms this mode name
    correctOptionId: z.string(),
  }),
  options: z.array(z.object({ id: z.string(), labelEn: z.string() })),
});

const OrderBuilderExerciseSchema = z.object({
  ...BaseExerciseFields,
  type: z.literal("order-builder"),
  answerCheck: z.object({
    mode: z.literal("orderedTokens"),     // [ASSUMED] — no real data confirms this mode name
    correctOrder: z.array(z.string()),
  }),
  wordBank: z.array(z.string()),
});

const ExerciseSchema = z.discriminatedUnion("type", [
  TextInputExerciseSchema,
  MatchingExerciseSchema,
  SingleChoiceExerciseSchema,
  OrderBuilderExerciseSchema,
]);
```

### Pattern 2: Root-shape versioned localStorage blob, defensive read

**What:** Persist `{ schemaVersion: 1, data: {...} }` as the actual saved JSON shape, independent of the key name (`english-quest-progress-v1`). On read, if `schemaVersion` is missing or doesn't match, either run a migration or reset to a fresh profile — never crash, never assume fields exist. This is the direct fix for PITFALLS.md Pitfall 1 (relying on key-name-only versioning).

**When to use:** Every read/write to the single localStorage key.

**Example:**
```typescript
// Source: pattern synthesized from janmonschke.com/simple-frontend-data-migration/ (MEDIUM confidence, WebSearch-verified)
// and PITFALLS.md Pitfall 1 (project-level research, already-verified)
const PROGRESS_KEY = "english-quest-progress-v1";
const CURRENT_SCHEMA_VERSION = 1;

const StoredBlobSchema = z.object({
  schemaVersion: z.number(),
  data: ProgressStateSchema,   // includes currentPosition per D-04
});

function load(): ProgressState {
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (!raw) return initialState();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("Corrupt progress JSON, resetting to fresh state");
    return initialState();
  }

  const result = StoredBlobSchema.safeParse(parsed);
  if (!result.success) {
    console.warn("Progress blob failed validation, resetting to fresh state", z.prettifyError(result.error));
    return initialState();
  }
  if (result.data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    // Phase 1 ships schemaVersion: 1 as the only version — no migration pipeline needed yet,
    // but the CHECK for mismatch must exist from day one (Pitfall 1).
    return initialState();
  }
  return result.data.data;
}

function save(state: ProgressState): void {
  const blob = { schemaVersion: CURRENT_SCHEMA_VERSION, data: state };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(blob));  // SYNCHRONOUS, no debounce (D-03)
}
```

### Pattern 3: Tap-based order-builder (word bank + sequence), no drag-and-drop

**What:** Per D-05, render two zones: a word bank of tappable chips (unused words) and a sequence area (chosen words in order). Tapping a bank chip appends it to the sequence and removes it from the bank; tapping a sequence chip removes it and returns it to the bank. State is just two arrays (`bank: string[]`, `sequence: string[]`) derived from `exercise.wordBank`, no drag events, no reordering-within-sequence needed for MVP (child must remove and re-add to reorder).

**When to use:** Rendering any `order-builder` exercise.

**Example:**
```typescript
// D-05 implementation sketch — no external library needed, plain event delegation
interface OrderBuilderState {
  bank: string[];
  sequence: string[];
}

function tapBankChip(state: OrderBuilderState, word: string): OrderBuilderState {
  return {
    bank: state.bank.filter((w, i) => i !== state.bank.indexOf(word)),
    sequence: [...state.sequence, word],
  };
}

function tapSequenceChip(state: OrderBuilderState, index: number): OrderBuilderState {
  const word = state.sequence[index];
  return {
    bank: [...state.bank, word],
    sequence: state.sequence.filter((_, i) => i !== index),
  };
}

function checkOrderBuilder(exercise: OrderBuilderExercise, sequence: string[]): { isCorrect: boolean } {
  const joined = sequence.join(" ");
  return { isCorrect: exercise.answerCheck.correctOrder.join(" ") === joined };
}
```

### Anti-Patterns to Avoid
- **Fuzzy/edit-distance matching at the core comparison layer:** Never use Levenshtein or similar for `text-input` grammar exercises — this masks the exact grammar errors the unit teaches (`"go"→"goes"` and `"go"→"gp"` are both edit-distance 1, but only one is the taught error). Normalization must stay lossless (case/whitespace/final-punctuation only, per SPEC §7 and D-06). [Carried forward from project-level PITFALLS.md Pitfall 6, HIGH confidence — grounded in SPEC.md itself.]
- **`innerHTML` for any rendered text derived from lesson JSON or (in later phases) agent output:** Always use `textContent`/`createElement`, never `innerHTML`, even for prompt/hint text that "should" be safe. [PITFALLS.md, MEDIUM confidence.]
- **Debounced or batched localStorage writes in this phase:** D-03 explicitly requires synchronous, immediate writes after every state-changing action — no `setTimeout`/`requestIdleCallback` batching. This overrides the general "batch writes" performance advice in project-level PITFALLS.md/ARCHITECTURE.md, which was written before the Phase 1 discussion locked in D-03's stricter "never lose the last action" requirement. **This phase's D-03 decision takes precedence over the earlier general debounce recommendation.**
- **Treating `Lesson-1A.json`'s `single-choice`/`order-builder` absence as "not needed yet":** REQUIREMENTS.md EXERCISE-02/EXERCISE-04 and SPEC.md §5 require both types to be implemented in Phase 1 regardless of whether the current lesson exercises them — the renderer and checker code must exist and be tested against hand-authored fixtures, not skipped because "the real lesson doesn't use them."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON structural + type validation | Custom type-guard functions checking each field manually | Zod `z.discriminatedUnion` + `.safeParse()` | Already locked by D-02; hand-written guards duplicate what Zod does with better error messages and less code for 4 exercise-type variants |
| Readable validation error messages | Manual error-message string building from Zod's raw issue array | `z.prettifyError(result.error)` (Zod v4 built-in) | Zod v4 ships a purpose-built pretty-printer; hand-rolling this is pure wasted effort for a one-line built-in |
| DOM diffing / re-render efficiency | A custom virtual-DOM or diffing layer | Direct `textContent`/`createElement` manipulation, re-render whole screen sections on state change | At this scale (1 lesson, ~5 screen states, no framework decision to revisit — see ARCHITECTURE.md Anti-Pattern 1), a virtual DOM is solving a problem this app doesn't have; plain DOM APIs are simpler and match the project's "no framework" architectural decision |
| localStorage read/write boilerplate | Scattered `localStorage.getItem`/`setItem` calls across files | Single `persistence.ts` module (`load()`/`save()`) | PITFALLS.md Pitfall 1 warning sign explicitly calls out `JSON.parse(localStorage.getItem(...))` in more than one place as a red flag |

**Key insight:** Everything in Phase 1's scope has an off-the-shelf, well-tested solution (Zod for validation, plain DOM APIs for rendering, a single persistence module for storage) — there is no genuinely novel technical problem here, only careful application of already-locked architectural decisions (D-01 through D-06).

## Runtime State Inventory

> This is a greenfield phase (no existing runtime state, no rename/refactor). This section is included per protocol trigger check but confirms: **not applicable**.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — first write to `localStorage["english-quest-progress-v1"]` happens in this phase; no pre-existing data to migrate | None |
| Live service config | None — no external services in this phase (agents are Phase 3+) | None |
| OS-registered state | None — pure browser app, no OS-level registration | None |
| Secrets/env vars | None — Phase 1 has zero LLM calls, no API keys needed yet | None |
| Build artifacts | None — greenfield `npm create vite` scaffold, no prior build output exists | None |

**Nothing found in any category** — verified by confirming this is the first phase of a greenfield project (`.planning/STATE.md`: "this is a greenfield project. Only `SPEC.md` and `Lesson-1A.json` exist in the repo prior to this phase").

## Common Pitfalls

### Pitfall 1: `Lesson-1A.json` has no `single-choice` or `order-builder` exercises to validate against
**What goes wrong:** The planner/executor writes Zod schemas and renderers for `single-choice`/`order-builder` based on guessing the JSON shape from the `text-input`/`matching` patterns, ships it untested against real data, and the shape silently diverges from whatever future lesson content authors actually produce for those types — since there's no current example to catch a mismatch.
**Why it happens:** SPEC.md §5 lists `single-choice`/`order-builder` as MVP exercise types, and REQUIREMENTS.md EXERCISE-02/EXERCISE-04 requires them, but `Lesson-1A.json` (the only lesson content that exists) happens to only use `text-input` and `matching`. Direct inspection confirms: 18 `text-input` + 1 `matching` (8 pairs) = 19 exercises, zero of the other two types.
**How to avoid:** Design the `single-choice`/`order-builder` JSON shape explicitly as a documented decision (see Pattern 1's `answerCheck.mode` naming above — `choiceId`/`orderedTokens` are proposed names, not verified against any authoritative source), write hand-authored fixture JSON for both types in the test suite, and unit-test the checker/renderer against those fixtures. Flag this shape as `[ASSUMED]` for the discuss-phase/planner to confirm or adjust — it is a genuine open design decision, not a research gap that can be closed by more searching, since the authoritative source (`Lesson-1A.json`) simply doesn't contain this data.
**Warning signs:** Any PR/commit that implements `single-choice`/`order-builder` support with zero associated test fixtures; any assumption that "we'll get to it when a lesson needs it" (REQUIREMENTS.md requires it now, in Phase 1).
**Phase to address:** This phase (Phase 1) — EXERCISE-02 and EXERCISE-04 are explicitly Phase 1 requirements per `.planning/REQUIREMENTS.md` traceability table.

### Pitfall 2: Vite install defaults to the wrong major version
**What goes wrong:** Running `npm create vite@latest` or `npm install -D vite` without an explicit version pin installs Vite `8.1.3` (current npm `latest` tag as of this research), which project-level STACK.md explicitly flagged as higher-risk for this project ("avoid the 8.x line... higher risk of edge-case plugin/config incompatibilities").
**Why it happens:** `npm create vite@latest` scaffolds against whatever the current `latest` dist-tag is at install time; STACK.md's Vite guidance was written before Vite 8 shipped, but remains the deliberate recommendation.
**How to avoid:** After scaffolding, explicitly edit `package.json` to pin `"vite": "^6.4.0"` and re-run `npm install`, or install with `npm create vite@latest . -- --template vanilla-ts` then immediately `npm install -D vite@^6.4.0` to override.
**Warning signs:** `package.json` showing `"vite": "^8.x.x"` after scaffold; `npm ls vite` showing an 8.x resolved version.
**Phase to address:** This phase's initial project scaffold task — verify the pinned version before writing any application code.

### Pitfall 3: Confusing "synchronous write" (D-03) with "no batching needed at all"
**What goes wrong:** D-03 requires a synchronous `localStorage` write after every state-changing event — this is correct and non-negotiable per the phase's own locked decision. But naively wiring `save()` into every micro-event (every keystroke in a text-input field, not just on submit) reintroduces the exact main-thread-blocking risk PITFALLS.md's Performance Traps section warns about, because `localStorage.setItem` is synchronous and blocks the main thread on every call.
**Why it happens:** "Synchronous" (no debounce delay) gets conflated with "on every DOM event" rather than "on every *state-changing* event" — typing into a text-input field updates local component state, not `StateStore`, until the child taps "Проверить."
**How to avoid:** Only call `save()` from `StateStore.dispatch()` handlers (i.e., after `exercise_attempt`, `theory_step`, or lesson-position-advance events) — never from raw DOM input-change listeners. The distinction is "state-changing action" (submit, toggle understood, advance step) vs. "in-progress UI interaction" (typing, tapping an unsubmitted order-builder chip) — only the former triggers a save.
**Warning signs:** A `save()` or `persistence.save()` call inside an `input`/`keyup` event handler rather than a `submit`/`click`-on-"Проверить" handler.
**Phase to address:** This phase — the `lessonEngine.ts` orchestrator is the only place `save()` should be called from.

## Code Examples

Verified patterns from official/current sources:

### Zod safeParse with prettified error output (validation failure state, D-06)
```typescript
// Source: zod.dev/error-formatting (WebSearch-verified against official Zod docs, MEDIUM confidence)
import * as z from "zod";

const result = LessonSchema.safeParse(rawJson);
if (!result.success) {
  const readable = z.prettifyError(result.error);
  // D-06: "clear, non-cryptic error state" — render this, do NOT proceed to lesson UI
  renderFatalError(`Не удалось загрузить урок:\n${readable}`);
  throw new Error("Lesson validation failed at boot"); // fail loudly, per D-06
}
const lesson = result.data; // fully typed, safe to render from
```

### Vitest 4 config with jsdom environment
```typescript
// Source: vitest.dev/config/environment (WebSearch-verified against official Vitest docs, MEDIUM confidence)
// vite.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```
```json
// tsconfig.json compilerOptions addition for globals typing
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

### Text normalization (SPEC §7 literal implementation, D-06 defaultNormalization from Lesson-1A.json)
```typescript
// Source: SPEC.md §7 + Lesson-1A.json defaultNormalization field (project-authored, HIGH confidence)
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")           // collapseSpaces
    .replace(/[.!?,;:]+$/, "");     // stripFinalPunctuation (trailing only)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `z.union([...])` untagged unions for tagged-shape JSON | `z.discriminatedUnion("field", [...])` | Established since Zod v3.19+, standard in v4 | Better error messages, TypeScript narrowing via `switch`, avoids O(n) fallback-matching |
| `z.formErrors`/`ZodError.format()` (v3 patterns) | `z.prettifyError()`, `z.treeifyError()`, `z.flattenError()` (v4 top-level functions) | Zod v4 (already the locked version) | Cleaner API surface; `prettifyError` is purpose-built for human-readable output, exactly D-06's "clear, non-cryptic error state" need |
| Vite 5.x (what most 2025-era tutorials still show) | Vite 6.x is now the "conservative modern" choice; 8.x is bleeding-edge | Vite 8 shipped mid-2026 | This project deliberately targets 6.x, not the newest major — documented explicitly in project-level STACK.md and reaffirmed here |

**Deprecated/outdated:**
- Zod v3's `ZodError.format()`: superseded by `z.treeifyError()` in v4 — don't reach for v3-era Stack Overflow snippets.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `single-choice` exercise `answerCheck.mode` is named `"choiceId"` and the schema shape shown in Pattern 1 (`correctOptionId`, `options[]`) | Architecture Patterns / Pattern 1, Standard Stack | LOW — this is an internal schema decision Phase 1 code fully controls (no external lesson-content author has produced conflicting data yet); if a future lesson uses a different shape, only this phase's own schema/renderer needs updating, no cross-phase blast radius |
| A2 | `order-builder` exercise `answerCheck.mode` is named `"orderedTokens"` and the schema shape shown in Pattern 1 (`correctOrder[]`, `wordBank[]`) | Architecture Patterns / Pattern 1, Standard Stack | LOW — same reasoning as A1; internally controlled, no existing content to contradict it |
| A3 | Vite 6.4.3 is the correct "stay conservative" pin vs. letting scaffolding default to 8.1.3 | Standard Stack | MEDIUM — if the planner/executor doesn't explicitly override the scaffold's default version, the project silently ends up on Vite 8.x despite this research's recommendation; mitigated by Pitfall 2's explicit warning and verification step |
| A4 | localStorage schema-versioning wrapper shape (`{schemaVersion, data}`) is the right root shape rather than flat fields with a top-level `schemaVersion` sibling | Architecture Patterns / Pattern 2 | LOW — this is a reasonable, commonly-cited pattern (WebSearch MEDIUM confidence via janmonschke.com) but is Phase 1's own internal storage-format decision; no external consumer depends on a specific shape |

**Recommendation:** A1/A2 (the `single-choice`/`order-builder` JSON shape) are the highest-value items for the planner to explicitly confirm with the user or treat as an executor-discretion design decision during Phase 1 planning — everything else in this table is low-risk, internally-controlled implementation detail.

## Open Questions

1. **What exact JSON shape should `single-choice` and `order-builder` exercises use?**
   - What we know: SPEC.md §5 names them as MVP types; REQUIREMENTS.md EXERCISE-02/EXERCISE-04 requires them in Phase 1; the existing `text-input` (`mode: "normalizedText"`) and `matching` (`mode: "pairIds"`) patterns establish a clear naming convention (`answerCheck.mode` as a second discriminator).
   - What's unclear: No real `Lesson-1A.json` exercise of either type exists to confirm field names against. `SPEC.md` §5's generic exercise field list (`answerCheck` = `correctAnswers`+`acceptedAnswers` OR `pairs`) doesn't explicitly enumerate a third/fourth shape.
   - Recommendation: Treat this as a Claude's-discretion design decision per `01-CONTEXT.md`'s pattern (the planner should pick a concrete shape — Pattern 1 above proposes one — and the plan-checker/verification loop should confirm it satisfies EXERCISE-02/EXERCISE-04 literally: "child completes `single-choice` exercises" / "child completes `order-builder` exercises," which only requires the mechanism work correctly, not that it match a specific undocumented external schema).

2. **Does `EXERCISE-05`'s "task N of 19" indicator count only the 19 exercises in `sections[]`, or does it need to account for `reviewQueue`/`reviewExercises[]` additions mid-session?**
   - What we know: `Lesson-1A.json`'s `reviewExercises: []` is empty at load time and PROGRESS-03/PROGRESS-04 (reviewQueue population and same-session traversal) are explicitly Phase 2 scope per REQUIREMENTS.md traceability.
   - What's unclear: Whether Phase 1's progress indicator should be hardcoded to "N of 19" (static denominator) or built with a denominator that could later grow if review exercises are appended — since Phase 2 will need to extend this exact indicator.
   - Recommendation: Phase 1 should implement "N of 19" against `sections[].exercises.length` only (static count, matches the actual Phase 1 scope where reviewQueue doesn't exist yet), but the counter's underlying implementation should read the count from the lesson's total exercise array length rather than hardcode the literal number `19`, so Phase 2 can extend the denominator without touching Phase 1's counter logic.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite dev server, npm scripts, Vitest | ✓ | v22.23.1 | — |
| npm | Package installation | ✓ | 10.9.8 | — |

**Missing dependencies with no fallback:** none — this phase has no external service dependencies (no LLM calls, no backend, no database).

**Missing dependencies with fallback:** none applicable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (to be installed this phase — no test framework exists yet, greenfield) |
| Config file | `vite.config.ts` (`test` block) — does not exist yet, created in Wave 0 |
| Quick run command | `npx vitest run tests/core` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| THEORY-01 | Child sees theory block (rule + example) before exercises | unit + jsdom render | `npx vitest run tests/ui/screens/TheoryScreen.test.ts` | ❌ Wave 0 |
| THEORY-02 | Child can mark theory as понятно/не понятно | unit | `npx vitest run tests/core/lessonEngine.test.ts -t "theory"` | ❌ Wave 0 |
| EXERCISE-01 | Child completes `text-input` exercises | unit | `npx vitest run tests/core/answer-checking/checkTextInput.test.ts` | ❌ Wave 0 |
| EXERCISE-02 | Child completes `single-choice` exercises | unit (hand-authored fixture, no real lesson data — see Pitfall 1) | `npx vitest run tests/core/answer-checking/checkSingleChoice.test.ts` | ❌ Wave 0 |
| EXERCISE-03 | Child completes `matching` (picture→word) exercises | unit | `npx vitest run tests/core/answer-checking/checkMatching.test.ts` | ❌ Wave 0 |
| EXERCISE-04 | Child completes `order-builder` exercises | unit (hand-authored fixture) | `npx vitest run tests/core/answer-checking/checkOrderBuilder.test.ts` | ❌ Wave 0 |
| EXERCISE-05 | Child sees progress indicator ("task N of 19") | unit + jsdom render | `npx vitest run tests/ui/components/ProgressIndicator.test.ts` | ❌ Wave 0 |
| CHECK-01 | Core normalizes + exact-compares `text-input` against `acceptedAnswers` | unit | `npx vitest run tests/core/answer-checking/normalize.test.ts` | ❌ Wave 0 |
| CHECK-02 | Core deterministically compares `single-choice`/`matching`/`order-builder` without an agent | unit | `npx vitest run tests/core/answer-checking/` (all 3) | ❌ Wave 0 |
| PERSIST-01 | Progress saved to `localStorage["english-quest-progress-v1"]` | unit (mocked `localStorage`, jsdom provides it) | `npx vitest run tests/core/state/persistence.test.ts` | ❌ Wave 0 |
| PERSIST-02 | Progress survives page reload (exact position, per D-04) | integration (jsdom, simulate save→fresh-load cycle) | `npx vitest run tests/core/state/persistence.test.ts -t "reload"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core` (fast — core has zero DOM/network I/O)
- **Per wave merge:** `npx vitest run` (full suite including jsdom-based UI render tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the manual UAT checklist in PITFALLS.md's "Looks Done But Isn't" section item "localStorage persistence" (manually mutate a saved blob to an old shape and confirm graceful reset, not just same-session reload).

### Wave 0 Gaps
- [ ] `vite.config.ts` — Vitest `test` block with `environment: "jsdom"`, `globals: true` (does not exist — greenfield)
- [ ] `tsconfig.json` — base TypeScript config with `"types": ["vitest/globals"]` added
- [ ] `tests/core/` and `tests/ui/` directory scaffolding
- [ ] `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"dev": "vite"`, `"build": "vite build"`
- [ ] Fixture JSON for `single-choice`/`order-builder` exercises (hand-authored, since `Lesson-1A.json` has none — see Pitfall 1) — needed before EXERCISE-02/EXERCISE-04 tests can be written
- [ ] Framework install: `npm install -D vitest@^4.1.0 jsdom@^29.1.0` — none currently installed (greenfield repo, only `SPEC.md`/`Lesson-1A.json` exist)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth exists in this project — single fixed `studentId: "primary"`, no login, per PROJECT.md constraints |
| V3 Session Management | No | No server sessions; `localStorage` is the only persistence, not a session token |
| V4 Access Control | No | Single-user, single-device, browser-only — no access-control boundary exists in this phase |
| V5 Input Validation | Yes | Zod `safeParse()` on both `Lesson-1A.json` (load-time, D-06) and the `localStorage` progress blob (read-time, Pattern 2) — treat both as untrusted input per ASVS V5's "positive validation" principle, even though both are technically first-party data, because `localStorage` content is user-editable via devtools and a corrupt/tampered blob must not crash the app |
| V6 Cryptography | No | No secrets, no encryption need in this phase (API keys arrive in Phase 3) |

### Known Threat Patterns for TypeScript + Vite + Zod + localStorage (browser-only, no backend)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Tampered/corrupted `localStorage` blob (child or curious user edits devtools) causing a crash or invalid app state | Tampering | Zod `safeParse()` on every read (Pattern 2), reset to fresh state on any validation failure rather than crashing — [CITED: OWASP guidance that localStorage content "should not be considered trusted" even for first-party apps, https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html] |
| Rendering lesson-JSON-derived or (future-phase) agent-derived text via `innerHTML` | Tampering (stored XSS via a compromised/malformed content source) | Always use `textContent`/`createElement`, never `innerHTML`, for any dynamically-rendered string — carried forward from project-level PITFALLS.md Security Mistakes table, still applicable in Phase 1 for lesson prompt/hint text even though no agent output exists yet |
| Malformed `Lesson-1A.json` (or a future lesson file) causing the app to render a partially-valid, confusing state instead of failing cleanly | Denial of Service (soft — app becomes unusable/confusing, not literally down) | D-06: fail loudly at load time with a clear non-cryptic error state; never allow partial rendering from a schema validation failure |

## Sources

### Primary (HIGH confidence)
- `npm view typescript version` / `npm view vite version` / `npm view vitest version` / `npm view zod dist-tags` / `npm view jsdom version` — live npm registry queries, 2026-07-02 [VERIFIED: npm registry]
- `Lesson-1A.json` (project file, direct Python inspection of exercise types, hint-key optionality, section/exercise counts) [VERIFIED: direct file inspection]
- `SPEC.md`, `REQUIREMENTS.md`, `01-CONTEXT.md`, `.planning/STATE.md` (project-authored ground truth for scope/decisions)
- `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md` (already-completed project-level research, carried forward and cross-checked against current registry state)

### Secondary (MEDIUM confidence)
- https://zod.dev/api — Zod v4 discriminated union syntax [CITED]
- https://zod.dev/error-formatting — `z.prettifyError()` usage [CITED]
- https://vitest.dev/config/environment — Vitest 4 jsdom environment config [CITED]
- https://vite.dev/guide/ — Vite scaffolding/vanilla-ts template confirmation [CITED]
- https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html — localStorage trust-boundary guidance [CITED]
- https://janmonschke.com/simple-frontend-data-migration/ — schemaVersion wrapper pattern [CITED]

### Tertiary (LOW confidence)
- None — all findings in this document were either verified via direct tool/registry query or cited from official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all 5 core package versions verified live against npm registry on research date
- Architecture: HIGH — carried forward from already-verified project-level ARCHITECTURE.md, confirmed still applicable, extended with concrete Zod schema patterns validated against actual `Lesson-1A.json` content
- Pitfalls: HIGH for the 3 phase-specific pitfalls (grounded in direct file inspection + locked D-03 decision); MEDIUM for carried-forward general patterns (WebSearch-corroborated)
- `single-choice`/`order-builder` schema shape: LOW/ASSUMED — explicitly flagged, no authoritative source exists (documented in Assumptions Log and Open Questions, not hidden)

**Research date:** 2026-07-02
**Valid until:** 30 days (stable stack, no fast-moving dependencies in this phase's scope — no LLM API surface touched until Phase 3)

---
*Phase 1 research for: English Quest — Deterministic Core, Lesson Rendering & Persistence*
*Researched: 2026-07-02*
