# Walking Skeleton — English Quest

**Phase:** 1
**Generated:** 2026-07-02

## Capability Proven End-to-End

A child opens the app, sees the theory block (rule + example), marks it "Понятно", answers the first real `text-input` exercise from `Lesson-1A.json` and gets an instant deterministic "Верно!", sees "Задание N из 19" — and after a browser reload mid-lesson, resumes at the exact same position. No network call, no AI, no backend.

This exercises the full stack: Vite scaffold → `fetch('/Lesson-1A.json')` → Zod validation (fail-loudly, D-06) → StateStore → LessonEngine orchestration → deterministic answer checking → synchronous `localStorage` persistence → reload-resume.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript 6.0.x | Types pin the lesson JSON schema and core state; the deterministic core is the most heavily-graded part and must be type-checked + unit-testable (D-01). |
| Build tool | Vite 6.4.x (pinned — NOT 8.x) | De-facto static-TS bundler; instant HMR, trivial `vite build` to any static host. Vite 8's Rolldown internals are weeks old and higher-risk for a time-boxed build (RESEARCH.md Pitfall 2). Pin `^6.4.0` explicitly. |
| UI framework | None — vanilla TS + plain DOM APIs | One lesson flow, ~5 screen states, single `localStorage` key. A framework would hide the core/agent boundary the thesis must demonstrate (D-01, ARCHITECTURE Anti-Pattern 1). |
| Rendering | `createElement` / `textContent` only, never `innerHTML` | Lesson-JSON-derived (and future agent-derived) text is a stored-XSS surface; `textContent` is the ASVS V5 mitigation. Banned repo-wide. |
| Validation | Zod 4.4.x `z.discriminatedUnion` | Lesson JSON is untrusted input; `safeParse` at load (D-06) and on every `localStorage` read (Pattern 2). Same Zod pattern is reused for agent-response validation in Phase 3. |
| Data layer | `localStorage`, single key `english-quest-progress-v1`, blob `{schemaVersion:1, data}` | Only storage tier this project has (no backend). Versioned wrapper enables graceful reset/migration and defends against tampered blobs (D-03, PERSIST-01). |
| Persistence timing | Synchronous write after every state-changing dispatch, no debounce | A young child may close the tab mid-exercise; the last action must never be lost (D-03). `save()` is called only from `StateStore.dispatch()`, never from raw input listeners (Pitfall 3). |
| Persisted scope | Includes current lesson position (theory-understood flag + exercise index), not just cross-session stats | "Restores exactly where the child left off" (D-04, PERSIST-02) is stricter than SPEC.md's enumerated history fields. |
| Answer checking | Pure deterministic functions, `{isCorrect, source:"core"}`, no fuzzy/edit-distance | Exact normalize+compare for text-input (CHECK-01); id/pair-set/ordered-token compare for the others (CHECK-02). Fuzzy matching would mask the grammar errors the lesson teaches (Anth-Pattern). |
| order-builder interaction | Tap-to-append / tap-to-remove word bank, NO drag-and-drop | Drag is failure-prone for a young child on unknown devices; it is an interaction-mechanics choice locked now, Phase 5 only restyles (D-05, Pattern 3). |
| Testing | Vitest 4.1.x + jsdom 29.x | Vite-native runner; jsdom for DOM-touching render tests. Core has zero I/O and is fully unit-testable in isolation. |
| Directory layout | `src/core/**` (zero DOM/LLM awareness) vs `src/ui/**` (reads state, emits events, never writes state) + `src/main.ts` boot | Makes the deterministic-core / rendering boundary legible in code (ARCHITECTURE Component Responsibilities). See RESEARCH.md "Recommended Project Structure". |
| Lesson delivery | `Lesson-1A.json` copied to `public/`, loaded via `fetch()` | `fetch()` exercises the runtime fail-loud boundary D-06 requires (a bundled import failure would be a build error, not the runtime error state). |

## Stack Touched in Phase 1

- [x] Project scaffold — Vite vanilla-TS, ESLint + Prettier, Vitest + jsdom, `package.json` scripts (Plan 01-01 Task 1)
- [x] Routing — screen-state routing (theory ↔ exercise) driven by `LessonEngine` + restored position (no URL router needed for one lesson flow) (Plan 01-01 Tasks 4-5)
- [x] Storage — one real write (`save()` on every dispatch) AND one real read (`load()` restoring exact position on boot) to `localStorage` (Plan 01-01 Task 3)
- [x] UI — real interactive elements wired to the engine: theory buttons, text-input + Проверить (Plan 01-01), plus single-choice/matching/order-builder (Plan 01-03)
- [x] Local full-stack run — `npm run dev` serves the working lesson; `npm run build` produces a deployable static bundle (documented run command in lieu of a hosted dev deploy, per no-backend constraint)

## Out of Scope (Deferred to Later Slices)

Explicit, to prevent later phases re-litigating Phase 1's minimalism:

- **Any LLM/agent call** — Answer Checker, Theory Tutor, Progress Advisor, Reward Advisor, Parent Report Generator are Phases 3-4. Phase 1 has zero agents and must not pre-build an agent-shaped abstraction.
- **The "не понятно → simpler explanation" loop** — Theory Tutor (Phase 3). Phase 1's Не понятно button simply advances to practice (THEORY-02 literal).
- **Progress/topic FSM, review queue, rewards/rubles ledger** — Phase 2 (PROGRESS-*, REWARD-*). Phase 1 persists only enough position/attempt state to drive the progress indicator and reload-resume; the reward/review containers exist in the schema (so PERSIST-01's enumerated fields are all present) but carry no logic.
- **Personalization, difficulty guardrails, parent report** — Phase 4.
- **Kid-friendly Roblox-inspired visual identity** — Phase 5 (UI-01, UI-02). Phase 1 ships baseline-legible, functionally-styled screens only (see 01-UI-SPEC scope boundary). No mascots, animations, brand palette, ruble balance chrome, or bilingual visual hierarchy.
- **Real image assets for matching** — rendered as `imagePrompt` text placeholders in Phase 1.
- **Multiple lessons / content pipeline, multi-student, backend/sync, API-key proxy** — out of the v1 milestone entirely.

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions (the `StateStore`, versioned persistence adapter, `LessonEngine`, fail-loudly loader, and no-framework/no-innerHTML rules are contracts, not scratchpads):

- **Phase 2:** Progress tracking (per-topic mastery FSM), same-session review queue, and the fixed-rule rubles/reward ledger — all deterministic, extending the `ProgressState` schema and `StateStore` dispatch handlers. No agents.
- **Phase 3:** Agent Gateway shared trust boundary + Answer Checker (ambiguous text-input) + Theory Tutor (simpler explanation), each reusing the Phase 1 Zod-validation pattern and each with a deterministic fallback.
- **Phase 4:** Progress Advisor, Reward Advisor, Parent Report Generator — session/lesson-end agents through the same gateway, core-guardrailed, template fallback.
- **Phase 5:** Kid-friendly visual skin (UI-01/UI-02) over the already-correct data flow — restyles the Phase 1 DOM structure without changing interaction mechanics.
