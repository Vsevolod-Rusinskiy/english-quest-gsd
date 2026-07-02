---
phase: 01-deterministic-core-lesson-rendering-persistence
verified: 2026-07-02T10:58:01Z
status: passed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "Run `npm run dev`, complete theory → all 19 real exercises (18 text-input + 1 matching) in a real browser"
    expected: "Theory screen shows rule + example + both buttons; each exercise shows prompt, input UI, 'Задание N из 19'; correct answers show 'Верно!'; lesson-complete state appears at exercise 19"
    why_human: "Visual rendering, real dev-server fetch() against Vite static assets, and full interactive flow were deferred to end-of-phase human verification per workflow.human_verify_mode=end-of-phase (Task 6 of Plan 01, Task 4 of Plan 03 — both auto-approved/deferred, not walked through by a human)"

  - test: "Reload the browser (Cmd/Ctrl+R) mid-lesson"
    expected: "App resumes at the exact same exercise index, not back at theory"
    why_human: "Real browser reload behavior against real localStorage; jsdom simulation (fresh mountApp() call) was verified programmatically and passes, but the actual browser round-trip is unconfirmed by a human"

  - test: "Open devtools → Local Storage, confirm key `english-quest-progress-v1` with `{schemaVersion:1,data:{...}}`; edit to invalid JSON, reload"
    expected: "App silently resets to a fresh working lesson, no crash, no stack trace"
    why_human: "Tamper-reset logic is unit-tested (persistence.test.ts corrupt-JSON case), but real devtools tampering + real reload is a manual confirmation step"

  - test: "Temporarily break public/Lesson-1A.json (delete `theory` field), reload"
    expected: "Clear 'Не удалось загрузить урок.' message appears, lesson does not render"
    why_human: "D-06 schema-rejection logic is unit-tested (lessonSchema.test.ts), but the real-browser FatalError rendering and copy is a manual visual confirmation step"

  - test: "Play a single-choice exercise and an order-builder exercise via a dev harness or temporarily-wired fixture (Lesson-1A.json has no real data for these two types)"
    expected: "single-choice: tap exactly one option (accent-marked), submit grades it. order-builder: tap words from 'Слова:' into 'Твой ответ:' in order, tap back out (no dragging), submit grades the assembled order"
    why_human: "Both types are proven correct at the unit/renderer-test level against hand-authored fixtures (schema-valid, checker-graded, no agent calls), but no real lesson content exists for either type, so an end-to-end real-browser play-through requires manual dev-harness wiring, explicitly left to human-verification discretion by 01-03-SUMMARY.md"
---

# Phase 1: Deterministic Core — Lesson Rendering & Persistence Verification Report

**Phase Goal:** Child can complete the full lesson (theory + all 4 exercise types) end-to-end using only deterministic logic, and progress survives a page reload
**Verified:** 2026-07-02T10:58:01Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Child sees the theory block (rule + example) and can tap Понятно/Не понятно (THEORY-01, THEORY-02) | VERIFIED | `src/ui/screens/TheoryScreen.ts` renders `theory.rule`, `explanationLevels[0].exampleRu`, and two always-visible buttons via `createElement`/`textContent`. `tests/ui/screens/TheoryScreen.test.ts` and `tests/e2e/lessonWalkingSkeleton.test.ts` (independently re-run) both pass against real `public/Lesson-1A.json` |
| 2 | Child sees a text-input exercise with a Проверить button and "Задание N из 19" indicator (EXERCISE-01, EXERCISE-05) | VERIFIED | `src/ui/exercise-renderers/textInput.ts` + `ProgressIndicator.ts` (denominator from `lesson.sections[].exercises.length`, not a literal). E2E test asserts `"Задание 1 из 19"` and a text input + Проверить render |
| 3 | Text-input answer matching acceptedAnswers after normalization → "Верно!", zero network calls (CHECK-01) | VERIFIED | `src/core/answer-checking/normalize.ts` + `checkTextInput.ts` are pure functions (no fetch/agent). `checkTextInput.test.ts`/`normalize.test.ts` pass |
| 4 | single-choice graded by deterministic option-id comparison, no agent (EXERCISE-02, CHECK-02) | VERIFIED | `src/core/answer-checking/checkSingleChoice.ts` — pure `===` comparison, `source:"core"`. Renderer `singleChoice.ts` emits selected id, one-selectable, accent-marked. `singleChoice.test.ts` + `lessonEngine.test.ts` routing test pass |
| 5 | matching graded by deterministic pair-id set comparison against real 8-pair ex019, no agent (EXERCISE-03, CHECK-02) | VERIFIED | `checkMatching.ts` — Map-based leftId→rightId equality, closes duplicate-collapse gap (CR-02 fix: `userPairs.length === actual.size`). Tested against real `ex019`. `matching.ts` renderer verified with tap-to-pair, accent/inert states |
| 6 | order-builder graded by deterministic ordered-token comparison, no agent, no drag-and-drop (EXERCISE-04, D-05) | VERIFIED | `checkOrderBuilder.ts` — element-wise comparison (WR-04 fix, not fragile join-string). `orderBuilder.ts` renderer: tap-to-append/remove, explicit test asserting no `draggable=`/drag-event wiring |
| 7 | Child can traverse all 19 real exercises of Lesson-1A.json end to end, "Задание N из 19" advancing correctly (EXERCISE-05) | VERIFIED | `tests/e2e/fullLessonTraversal.test.ts` boots the real app against real `public/Lesson-1A.json`, answers all 18 text-input + 1 matching exercises via real DOM clicks, asserts progress 1→19 and localStorage position matches at every step, reaches "Урок завершён!" — re-run independently, passes |
| 8 | Every state-changing action writes synchronously to localStorage key `english-quest-progress-v1` (PERSIST-01) | VERIFIED | `src/core/state/store.ts` `dispatch()` calls `save()` synchronously exactly once (spy-verified in `persistence.test.ts`, re-run independently, passes). `save()` wrapped in try/catch (CR-01 fix) so a quota/private-mode failure doesn't wedge the UI |
| 9 | Reloading mid-lesson restores exact position — same theory-understood flag and exercise index (PERSIST-02, D-04) | VERIFIED | `persistence.test.ts` "reload" case (re-run independently via `-t "reload"`, passes) proves save→fresh-load round-trip; e2e "resumes at the exact position after a simulated reload" (re-run independently via `-t`, passes) proves a genuinely fresh `mountApp()` call reading the same jsdom `localStorage` resumes past theory at the advanced index |
| 10 | A structurally invalid Lesson-1A.json shows a clear non-cryptic error and does not render the lesson (D-06) | VERIFIED (schema logic) / real-browser rendering deferred | `lessonSchema.test.ts` "rejects a lesson object missing the theory block" passes; `lessonLoader.ts` calls `renderFatalError` + `z.prettifyError` and throws, halting boot. `FatalError.ts` uses `textContent` only, matches UI-SPEC copy contract. Real-browser visual confirmation is a deferred human-verify item (see below) |
| 11 | All requirement IDs (THEORY-01, THEORY-02, EXERCISE-01..05, CHECK-01, CHECK-02, PERSIST-01, PERSIST-02) are claimed and covered by at least one plan | VERIFIED | See Requirements Coverage table — full 1:1 match, no orphans |

**Score:** 11/11 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/lesson/lessonSchema.ts` | Zod discriminated-union schema, all 4 exercise types | VERIFIED | `discriminatedUnion("type", [...])` over TextInput/Matching/SingleChoice/OrderBuilder; `LessonSchema.safeParse(realLesson1A)` yields exactly 19 exercises (confirmed by independent `node -e` check) |
| `src/core/lesson/lessonLoader.ts` | fetch + Zod safeParse + fail-loudly loader | VERIFIED | Exports `loadLesson`; halts and calls `renderFatalError` on fetch failure or schema failure |
| `src/core/answer-checking/normalize.ts` | SPEC §7 normalization | VERIFIED | Exports `normalize`; lowercase, trim, collapse spaces, strip trailing punctuation only — no fuzzy matching |
| `src/core/answer-checking/checkTextInput.ts` | Deterministic exact-match | VERIFIED | Exports `checkTextInput`; pure, `source:"core"` |
| `src/core/state/persistence.ts` | Versioned localStorage load/save | VERIFIED | Exports `load`, `save`, `PROGRESS_KEY`, `CURRENT_SCHEMA_VERSION`; defensive safeParse-or-reset; try/catch on write (CR-01) |
| `src/core/state/store.ts` | StateStore dispatch/subscribe, save-on-dispatch | VERIFIED | Exports `StateStore`; `dispatch()` calls `save()` exactly once, notifies subscribers |
| `src/core/lessonEngine.ts` | theory→exercise orchestrator, all 4 types | VERIFIED | Exports `LessonEngine`; `handleAnswer` routes all 4 types to their checkers with runtime shape guards (WR-01 fix); zero throws remain for any type |
| `src/main.ts` | boot: load lesson → load/init state → mount UI → subscribe | VERIFIED | `mountApp()` wires the full sequence; halts on D-06; restores position from `loadProgress(lesson.lessonId)` (WR-02 fix) |
| `public/Lesson-1A.json` | lesson content served as static asset | VERIFIED | Present, 19 exercises, `lessonId: eq-1a-food-fuel-or-pleasure-v1`. Root-level duplicate removed (WR-05 fix) — single source of truth |
| `src/core/answer-checking/checkSingleChoice.ts` | deterministic single-choice checker | VERIFIED | Pure `===` comparison |
| `src/core/answer-checking/checkMatching.ts` | deterministic matching pair-id checker | VERIFIED | Map-equality + length guard (CR-02 fix) |
| `src/core/answer-checking/checkOrderBuilder.ts` | deterministic order-builder checker | VERIFIED | Element-wise array comparison (WR-04 fix) |
| `tests/fixtures/single-choice.fixture.json` / `order-builder.fixture.json` | hand-authored, schema-valid fixtures | VERIFIED | Both validate against their Zod schemas in their respective test files; realistic 1A content |
| `src/ui/exercise-renderers/singleChoice.ts` / `matching.ts` / `orderBuilder.ts` / `renderExercise.ts` | renderers + dispatcher | VERIFIED | All four use `createElement`/`textContent` only; dispatcher is an exhaustive switch with a TS never-check default |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/main.ts` | `src/core/lesson/lessonLoader.ts` | boot calls `loadLesson()` before render, halts on failure | WIRED | Confirmed by reading `mountApp()` — `await loadLesson(root)` is the first statement |
| `src/core/state/store.ts` | `src/core/state/persistence.ts` | `dispatch()` calls `save()` synchronously | WIRED | Confirmed in `store.ts` line 32; spy-tested (1 call per dispatch) |
| `src/core/lessonEngine.ts` | `src/core/answer-checking/checkTextInput.ts` | `handleAnswer` routes text-input, no agent | WIRED | Confirmed in the type-switch |
| `src/main.ts` | `src/core/state/persistence.ts` | boot calls `load()` to restore position | WIRED | Confirmed: `loadProgress(lesson.lessonId)` |
| `src/ui/exercise-renderers/renderExercise.ts` | `src/ui/exercise-renderers/orderBuilder.ts` | type-switch dispatch | WIRED | Confirmed exhaustive switch, all 4 branches present |
| `src/core/lessonEngine.ts` | `checkMatching`/`checkSingleChoice`/`checkOrderBuilder` | handleAnswer routes each type, no agent | WIRED | Confirmed all three imports used in the switch, with runtime payload-shape guards |
| `src/ui/exercise-renderers/orderBuilder.ts` | `src/core/answer-checking/checkOrderBuilder.ts` | submit emits sequence upward to engine | WIRED | Confirmed via `AnswerPayload` threading through `ExerciseScreen` → `handleAnswer` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `npx vitest run` | 68/68 tests, 15 files, all pass | PASS |
| Type checking | `npx tsc --noEmit` | Clean, exit 0 | PASS |
| Production build | `npm run build` | `dist/` produced, 88.99 kB JS bundle | PASS |
| Vite version pin | `npm ls vite` | `vite@6.4.3` (not 8.x default) | PASS |
| No innerHTML | `grep -rn innerHTML src/` | Only comment mentions ("never innerHTML") | PASS |
| No agent/network in core | `grep -rn "fetch\|@anthropic" src/core/` | Only `lessonLoader.ts`'s single `fetch()` call | PASS |
| Reload-resume (unit) | `npx vitest run -t "reload"` | 2 tests pass (persistence.test.ts + related) | PASS |
| Reload-resume (e2e) | `npx vitest run -t "resumes at the exact position"` | 1 test passes | PASS |
| 19-exercise data integrity | `node -e` inline check on public/Lesson-1A.json | 18 text-input + 1 matching = 19 total | PASS |
| Commit integrity | `git cat-file -e` on all 26 hashes referenced across SUMMARYs | All 26 present in git log | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| THEORY-01 | 01-01 | Theory block visible before exercises | SATISFIED | `TheoryScreen.ts`, e2e test |
| THEORY-02 | 01-01 | Понятно/Не понятно marking | SATISFIED | Both buttons wired, `handleTheoryStep` |
| EXERCISE-01 | 01-01 | text-input exercises | SATISFIED | `checkTextInput.ts`, `textInput.ts` renderer |
| EXERCISE-02 | 01-02, 01-03 | single-choice exercises | SATISFIED | `checkSingleChoice.ts`, `singleChoice.ts` renderer, fixture |
| EXERCISE-03 | 01-02, 01-03 | matching exercises | SATISFIED | `checkMatching.ts`, `matching.ts` renderer, real ex019 |
| EXERCISE-04 | 01-02, 01-03 | order-builder exercises | SATISFIED | `checkOrderBuilder.ts`, `orderBuilder.ts` renderer, D-05 no-drag |
| EXERCISE-05 | 01-01, 01-03 | "Задание N из 19" progress indicator | SATISFIED | `ProgressIndicator.ts` (data-driven denominator), full traversal e2e |
| CHECK-01 | 01-01 | text normalization + exact match | SATISFIED | `normalize.ts`, `checkTextInput.ts` |
| CHECK-02 | 01-02, 01-03 | deterministic non-text checking, no agent | SATISFIED | All 3 checkers pure, `grep` confirms no fetch/agent in `src/core/answer-checking/` |
| PERSIST-01 | 01-01 | progress saved to localStorage key | SATISFIED | `persistence.ts`, `english-quest-progress-v1`, spy-tested sync write |
| PERSIST-02 | 01-01 | progress survives reload | SATISFIED | Unit "reload" test + e2e fresh-mount test, both independently re-run and passing |

**No orphaned requirements** — all 11 requirement IDs assigned to Phase 1 in REQUIREMENTS.md's traceability table are claimed by at least one plan's frontmatter (`01-01`: THEORY-01, THEORY-02, EXERCISE-01, EXERCISE-05, CHECK-01, PERSIST-01, PERSIST-02; `01-02`: EXERCISE-02, EXERCISE-03, EXERCISE-04, CHECK-02; `01-03`: EXERCISE-02, EXERCISE-03, EXERCISE-04, EXERCISE-05, CHECK-02). Union of all three plans' `requirements:` fields exactly equals the phase's 11 assigned IDs — 11/11 mapped, 0 unmapped.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | `grep` for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER across `src/` and `tests/` returned zero matches. The only "placeholder" language found is the intentional, plan-sanctioned text-only image placeholder (`imagePrompt` rendered as text, not an `<img>`) — explicitly scoped as out-of-Phase-1 per 01-UI-SPEC.md, not a code stub |

### Code Review Fix Verification (01-REVIEW-FIX.md cross-check)

All 7 findings from `01-REVIEW.md` were independently re-verified as actually present in the current code (not just claimed):

| ID | Finding | Verified Fix Present |
|----|---------|----------------------|
| CR-01 | `localStorage.setItem` failure unhandled | YES — `persistence.ts` `save()` wraps `setItem` in try/catch with `console.warn` |
| CR-02 | `checkMatching` accepts duplicate-leftId payloads | YES — `checkMatching.ts` has `userPairs.length === actual.size` guard |
| WR-01 | `handleAnswer` trusts unchecked type assertions | YES — every switch branch in `lessonEngine.ts` has a runtime shape guard that throws on mismatch |
| WR-02 | No `lessonId` binding on persisted progress | YES — `progressSchema.ts` has optional `lessonId`, `persistence.ts` `load()` resets on mismatch, `main.ts` calls `loadProgress(lesson.lessonId)` |
| WR-03 | Wrong-answer retry discards in-progress input | YES — `main.ts` `onSubmit` swaps only the feedback banner in place on incorrect answers, leaving the exercise DOM subtree untouched |
| WR-04 | `checkOrderBuilder` string-join comparison risk | YES — `checkOrderBuilder.ts` now does element-wise array comparison |
| WR-05 | Two copies of Lesson-1A.json | YES — root-level `Lesson-1A.json` confirmed absent (`ls` returns "No such file"); `public/Lesson-1A.json` is the sole copy |

### Human Verification Required

5 items deferred to end-of-phase human verification per `.planning/config.json`'s `workflow.human_verify_mode: "end-of-phase"` (both Task 6 of Plan 01 and Task 4 of Plan 03 were auto-approved/deferred, not walked through by a human, per `workflow.auto_advance: true`). These are legitimate, config-sanctioned deferrals — not gaps in the implementation — but the phase cannot be marked fully `passed` until a human completes them:

### 1. Full lesson playable in a real browser (all 4 exercise types)

**Test:** Run `npm run dev`, complete theory through all 19 real exercises.
**Expected:** Theory → text-input/matching exercises render and grade correctly in a real browser (not jsdom); progress indicator and "Верно!" feedback visible.
**Why human:** Real dev-server `fetch()` against Vite static assets and full visual/interactive confirmation were never exercised outside jsdom simulation.

### 2. Reload-resume in a real browser

**Test:** Reload mid-lesson via Cmd/Ctrl+R.
**Expected:** App resumes at the exact same exercise, not theory.
**Why human:** jsdom's simulated fresh-mount was proven programmatically; the real browser round-trip (actual page unload/reload) is unconfirmed.

### 3. localStorage tamper-reset in real devtools

**Test:** Edit the `english-quest-progress-v1` value to invalid JSON via devtools, reload.
**Expected:** Silent reset to fresh state, no crash, no stack trace.
**Why human:** Unit-tested logic; real devtools + real reload manual confirmation still required.

### 4. D-06 fail-loudly in a real browser

**Test:** Delete the `theory` field from `public/Lesson-1A.json`, reload.
**Expected:** "Не удалось загрузить урок." message, no lesson render.
**Why human:** Unit-tested schema rejection; real FatalError visual rendering unconfirmed.

### 5. single-choice and order-builder playable via a dev harness

**Test:** Since `Lesson-1A.json` has zero real single-choice/order-builder exercises, use a dev harness or temporarily-wired fixture to play both types.
**Expected:** single-choice: one-selectable, graded correctly. order-builder: tap-to-append/remove (no drag), graded correctly.
**Why human:** Proven correct at the renderer/unit level against hand-authored fixtures; no real end-to-end browser play-through exists for these two types since the lesson content doesn't contain them.

### Gaps Summary

No gaps. All 11 must-have observable truths are verified against the actual codebase — not merely claimed in SUMMARY.md. Independent re-execution of the full test suite (68/68 pass), `tsc --noEmit` (clean), `npm run build` (succeeds), and targeted named-test re-runs (`reload`, `resumes at the exact position`) all confirm the SUMMARY claims are accurate. All 7 code-review fixes (CR-01/02, WR-01..05) were independently confirmed present in the current source, not just claimed in 01-REVIEW-FIX.md. All 26 referenced commit hashes exist in git history. Requirements coverage is complete: 11/11 Phase-1 requirement IDs are claimed and satisfied, 0 orphaned.

The phase is functionally complete at the code level. The only open item is the standard end-of-phase human UAT walkthrough in a real browser (config-deferred, not a code gap) — routing this verification to `human_needed` rather than `passed` per the decision tree, since the human-verification section is non-empty.

---

_Verified: 2026-07-02T10:58:01Z_
_Verifier: Claude (gsd-verifier)_
