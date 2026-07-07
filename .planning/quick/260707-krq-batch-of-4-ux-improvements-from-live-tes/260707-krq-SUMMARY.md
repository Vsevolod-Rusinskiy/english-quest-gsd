---
phase: 260707-krq
plan: 01
subsystem: ui
tags: [web-audio, vanilla-ts, wcag, vitest, tdd]

requires:
  - phase: 260707-hby
    provides: ".inline-blank CSS + multi-blank inline input rendering pattern reused/extended for single-blank exercises"
provides:
  - "Synthesized coin-clink sound (Web Audio API, no external asset) on ruble award"
  - "Unified inline-blank rendering for ALL text-input exercises (single and multi-blank alike)"
  - "Escalating authored hints on wrong text-input answers (firstError -> secondError by attempt count)"
  - "Visual progress bar + correct-streak chip + compact topic-mastery summary in the top bar"
affects: [ui-polish, live-testing, gsd-verify-work]

tech-stack:
  added: []
  patterns:
    - "Module-scoped lazy singleton (AudioContext) with vi.resetModules()+dynamic re-import per test for isolation"
    - "Inline-blank rendering path generalized from blankCount>=2 to blankCount>=1, no-blank fallback at blankCount===0"
    - "Progress fill clamped via Math.max(0, Math.min(1, current/total)) to guarantee no overshoot across main/review/complete"

key-files:
  created:
    - src/ui/sound/coin.ts
    - src/ui/components/ProgressBar.ts
    - src/ui/components/StreakChip.ts
    - src/ui/components/TopicMasterySummary.ts
    - tests/ui/sound/coin.test.ts
    - tests/ui/components/ProgressBar.test.ts
    - tests/ui/components/StreakChip.test.ts
    - tests/ui/components/TopicMasterySummary.test.ts
  modified:
    - src/main.ts
    - src/ui/exercise-renderers/textInput.ts
    - src/style.css
    - tests/helpers/multiBlankAnswers.ts
    - tests/ui/exercise-renderers/textInput.test.ts
    - tests/main.test.ts

key-decisions:
  - "Agent hintRu dropped entirely from the feedback banner (not kept as a secondary line) per CONTEXT.md #3's explicit recommendation — authored escalating hint is the sole hint shown"
  - "Topic-mastery summary shipped as ONLY the 'освоено N / M тем' line, no per-topic chip row, per CONTEXT.md #4's 'first pass, unobtrusive' guidance"
  - "coin.ts test isolation required vi.resetModules() + dynamic re-import per test, since the module-scoped AudioContext singleton (by design) would otherwise leak a stubbed context across tests in the same file"

patterns-established:
  - "Web Audio synthesis wrapped entirely in try/catch with lazy singleton context — reusable pattern for any future sound effect"
  - "Progress-fraction clamp pattern for any future progress-style visual (Math.max(0, Math.min(1, ...)))"

requirements-completed: [UX-COIN-01, UX-INLINE-02, UX-HINT-03, UX-PROGRESS-04]

coverage:
  - id: D1
    description: "Synthesized coin-clink sound plays on ruble award; degrades silently (never throws) when AudioContext is unavailable/blocked"
    requirement: "UX-COIN-01"
    verification:
      - kind: unit
        ref: "tests/ui/sound/coin.test.ts#playCoinSound (5 tests: absent ctor, throwing ctor, throwing node graph, wires oscillator/gain+start/stop, lazy singleton reuse)"
        status: pass
    human_judgment: true
    rationale: "Actual audible sound quality (non-annoying, click-free 'cling') can only be judged by ear in a real browser — unit tests prove the code never throws and wires the correct Web Audio node graph, not how it sounds"
  - id: D2
    description: "All text-input exercises (including single-blank) render inline blanks, no separate box, no leftover '___' marker"
    requirement: "UX-INLINE-02"
    verification:
      - kind: unit
        ref: "tests/ui/exercise-renderers/textInput.test.ts (9 tests, including single-blank inline + no-blank fallback)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/fullLessonTraversal.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Wrong text-input answers show authored hint.firstError on attempt 1, hint.secondError on attempt 2+ (falling back to firstError when absent); agent hintRu no longer replaces it"
    requirement: "UX-HINT-03"
    verification:
      - kind: unit
        ref: "tests/main.test.ts#escalating authored hints on wrong text-input answers (UX-HINT-03) (3 tests: firstError, secondError escalation, firstError fallback)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Progress bar (clamped, no overshoot), streak chip (>=2 only), and topic-mastery summary render in the top bar across main/review/complete"
    requirement: "UX-PROGRESS-04"
    verification:
      - kind: unit
        ref: "tests/ui/components/ProgressBar.test.ts (7 tests), tests/ui/components/StreakChip.test.ts (4 tests), tests/ui/components/TopicMasterySummary.test.ts (3 tests)"
        status: pass
    human_judgment: true
    rationale: "Visual placement/kid-friendliness of the top-bar layout (progress bar + streak chip + topic summary all fitting cleanly) is a design judgment call best confirmed by a live browser look, not just DOM assertions"

duration: 9min
completed: 2026-07-07
status: complete
---

# Quick Task 260707-krq: Batch of 4 UX Improvements Summary

**Synthesized Web Audio coin-clink on reward, unified inline-blank text-input rendering, escalating authored hints by attempt count, and a top-bar progress bar + streak chip + topic-mastery summary — all four live-test findings from CONTEXT.md, TDD RED->GREEN per task.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-07T12:03:46Z
- **Completed:** 2026-07-07T12:12:39Z
- **Tasks:** 5
- **Files modified:** 15 (4 new components + 1 new sound module + 4 new test files + 6 modified source/test files)

## Accomplishments

- **UX-COIN-01:** `src/ui/sound/coin.ts` synthesizes a two-note bell-like "cling" via the Web Audio API (no external asset), lazily creates/reuses one `AudioContext`, and degrades silently (never throws) when the API is unavailable, blocked, or any node-graph call fails. Wired into `main.ts`'s existing `rewardsDelta > 0` branch alongside the reward toast.
- **UX-INLINE-02:** `textInput.ts`'s inline-per-blank rendering path now drives `blankCount >= 1` (was `>= 2`), so single-blank exercises (e.g. ex005) render one inline input inside the sentence flow instead of the old inconsistent separate-box-below layout. The no-blank fallback (`blankCount === 0`) still renders safely. Reconstruction contract (`onSubmit(rawAnswer)`, `checkTextInput`) unchanged.
- **UX-HINT-03:** Wrong text-input answers now show the AUTHORED hint (`exercise.hint.firstError` on attempt 1, `exercise.hint.secondError` on attempt 2+, falling back to `firstError` when `secondError` is absent) as the primary hint. The agent's `result.hintRu` no longer replaces it — dropped from the banner entirely per CONTEXT.md #3's explicit recommendation.
- **UX-PROGRESS-04:** Three new components — `ProgressBar.ts` (clamped fill fraction, never overshoots 100% across main/review/complete, ARIA `progressbar` attributes), `StreakChip.ts` (chip only for `currentCorrectStreak >= 2`), `TopicMasterySummary.ts` ("освоено N / M тем" from `topicStats`, safe zero-state) — all mounted in `main.ts`'s existing top-bar block alongside the pre-existing "Задание N из 19" text indicators (kept, not removed).

## Task Commits

Each task followed RED (failing test) -> GREEN (implementation) TDD, committed atomically:

1. **Task 1: Synthesized coin-clink sound on ruble award (UX-COIN-01)**
   - `18d283f` test: add failing test for synthesized coin-clink sound
   - `0e9982f` feat: synthesized coin-clink sound on ruble award (UX-COIN-01)
2. **Task 2: Unify all text-input blanks to inline rendering (UX-INLINE-02)**
   - `3dcb5eb` test: migrate single-blank test to inline-blank contract
   - `53889a4` style: unify all text-input blanks to inline rendering (UX-INLINE-02)
3. **Task 3: Escalating authored hints on wrong answers (UX-HINT-03)**
   - `8844eab` test: add failing tests for escalating authored hints
   - `8c15ff4` feat: escalating authored hints on wrong answers (UX-HINT-03)
4. **Task 4: Progress bar + streak chip components with state guarding (UX-PROGRESS-04)**
   - `1159409` test: add failing tests for ProgressBar + StreakChip components
   - `23e5f7d` feat: progress bar + streak chip in top bar (UX-PROGRESS-04)
5. **Task 5: Compact topic-mastery summary + integration and full-suite green (UX-PROGRESS-04)**
   - `6b49ecd` test: add failing tests for TopicMasterySummary component
   - `265995e` feat: compact topic-mastery summary in top bar (UX-PROGRESS-04)

_All 5 tasks were TDD (`tdd="true"`); each has a `test(...)` RED commit followed by a `feat`/`style` GREEN commit — gate sequence verified in git log._

**Plan metadata:** (docs commit handled by orchestrator, not included here)

## Files Created/Modified

- `src/ui/sound/coin.ts` - `playCoinSound()`: synthesized two-note cling via Web Audio API, lazy singleton context, try/catch degrade-silently
- `src/ui/components/ProgressBar.ts` - `renderProgressBar(current, total)`: clamped fill fraction, ARIA progressbar attributes
- `src/ui/components/StreakChip.ts` - `renderStreakChip(streak)`: null for streak < 2, "🔥 N" chip otherwise
- `src/ui/components/TopicMasterySummary.ts` - `renderTopicMasterySummary(topicStats)`: "освоено N / M тем" summary line
- `src/main.ts` - wired `playCoinSound()` into the reward-diff branch; hint computation inverted to authored-first with escalation; top-bar now mounts streak chip, progress bar (3 variants), and topic-mastery summary
- `src/ui/exercise-renderers/textInput.ts` - inline path guard changed from `blankCount <= 1` (single-box) / `>= 2` (inline) to `=== 0` (fallback) / `>= 1` (inline)
- `src/style.css` - new `.progress-bar`/`.progress-bar-fill`, `.streak-chip`, `.topic-mastery` rules with computed WCAG AA contrast ratios noted in comments
- `tests/helpers/multiBlankAnswers.ts` - `fillCorrectTextAnswer` now branches on actual blank count (1 inline blank + no MULTI_BLANK_ANSWERS entry -> single-input fill) instead of inferring multi-blank from any `.inline-blank` presence
- `tests/ui/sound/coin.test.ts`, `tests/ui/components/ProgressBar.test.ts`, `tests/ui/components/StreakChip.test.ts`, `tests/ui/components/TopicMasterySummary.test.ts` - new component test files
- `tests/ui/exercise-renderers/textInput.test.ts`, `tests/main.test.ts` - migrated/added tests for the new contracts

## Decisions Made

- Agent `hintRu` dropped entirely from the feedback banner rather than kept as a secondary line — CONTEXT.md #3 explicitly recommended this as the cleanest option, and the original live-test issue was a confusing agent hint replacing the reliable authored one.
- Topic-mastery summary shipped as only the "освоено N / M тем" summary line, no per-topic status-chip row, per CONTEXT.md #4's "keep it minimal and unobtrusive" first-pass guidance.
- `coin.test.ts` needed `vi.resetModules()` + dynamic re-import per test for true isolation, since the module-scoped `AudioContext` singleton (an intentional design choice per the plan) would otherwise leak a stubbed context from one test into the next within the same file.

## Deviations from Plan

None - plan executed exactly as written. One test-infrastructure adjustment was needed (not a deviation from the plan's functional requirements): the pre-existing `renderTextInput` instruction-line test asserted `promptIndex` via exact `textContent === exercise.prompt` equality, which no longer holds now that the prompt paragraph contains an inline `<input>` node in place of `"___"` (the input contributes no text, so `textContent` reads `"He  at home today..."` rather than `"He ___ at home today..."`). Fixed the lookup to match on the leading text segment instead — a direct, in-scope consequence of Task 2's UX-INLINE-02 change to the same renderer, not a new deviation.

## Issues Encountered

None beyond the test-isolation and prompt-lookup adjustments noted above, both resolved inline during their respective TDD GREEN steps.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four live-test UX findings (UX-COIN-01, UX-INLINE-02, UX-HINT-03, UX-PROGRESS-04) are shipped and covered by unit/e2e tests.
- Full vitest suite: 293/293 tests passing. `npx tsc --noEmit`: clean.
- Recommended next step: a live browser walkthrough to confirm the coin sound is pleasant (not annoying) and the new top-bar elements (progress bar + streak chip + topic-mastery summary) fit cleanly without crowding — flagged as `human_judgment: true` in the coverage block above (D1, D4) since these are audible/visual judgment calls beyond what DOM assertions can verify.

---
*Phase: 260707-krq*
*Completed: 2026-07-07*

## Self-Check: PASSED

All 14 claimed files verified present on disk; all 10 claimed task commits (5 RED + 5 GREEN) verified present in git log. Full vitest suite (293/293) and `npx tsc --noEmit` both clean at time of writing.
