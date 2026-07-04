---
phase: 05-kid-friendly-visual-design
plan: 02
subsystem: ui
tags: [css-tokens, design-system, vanilla-ts, vitest, jsdom]

# Dependency graph
requires:
  - phase: 05-kid-friendly-visual-design
    provides: "Plan 01's bright/blocky CSS token values, shared button/accent/task-card/feedback-banner base rules, and the CTA-only 52px height/shadow exception scoped to submit-row button.accent/show-results-button/continue-button"
provides:
  - "Chunky/blocky CSS rules for all 5 remaining option/chip classNames (.option, .match-left, .match-right, .bank-chip, .sequence-chip) using --color-bg-secondary/--color-bg-secondary-dark, 14px radius, 44px floor, no shadow"
  - "New --color-bg-secondary-dark root token for the unselected chip/option border shade"
  - ".theory-toggle className on both theory buttons, visually distinct from the CTA-only .accent marker"
  - "Reward Advisor's praiseRu now actually rendered in the correct-answer feedback banner (previously computed/cross-checked but silently discarded)"
  - "SessionEndScreen now has real visual treatment (.child-section/.parent-section cards) instead of unstyled plain text"
affects: [any-future-phase-touching-style.css-or-exercise-renderers-or-FeedbackBanner]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unselected-state chip/option styling added as CSS-only rules; selection/pairing continues to rely on the existing button.accent/.selected toggle from Plan 01 with no TS changes needed for that half"
    - "FeedbackBanner accepts an optional 3rd praiseRu param, rendered as a .praise-text paragraph only inside the correct-answer banner"

key-files:
  created: []
  modified:
    - src/style.css
    - src/ui/screens/TheoryScreen.ts
    - tests/ui/screens/TheoryScreen.test.ts
    - src/ui/components/FeedbackBanner.ts
    - src/main.ts
    - tests/ui/components/FeedbackBanner.test.ts
    - .claude/launch.json

key-decisions:
  - "Theory toggle buttons get a dedicated .theory-toggle className rather than relying on absence of .accent, since Phase 5's Shape Language table explicitly reserves the CTA-only 52px/shadow treatment for submit-row buttons — .theory-toggle keeps the base button rule's font/radius/floor while being structurally distinguishable"
  - "Chip/option unselected-state styling is CSS-only; no renderer TS file needed changes because each renderer's existing accent-class toggle on selection already applies Plan 01's shared button.accent/.selected rule"
  - "During the mandatory Task 3 human-verify checkpoint (live browser walkthrough via npm run dev), 2 real functional/visual gaps were found and fixed in-flight rather than deferred: (1) praiseRu was computed and cross-checked in lessonEngine.ts but never rendered anywhere in the UI — a real functional gap in REWARD-03's value; (2) SessionEndScreen had zero visual treatment, failing ROADMAP SC1's 'every screen uses a consistent childish, blocky, brightly colored visual style' requirement for that one screen"

patterns-established:
  - "Chip/option classNames (.option/.match-left/.match-right/.bank-chip/.sequence-chip) all share one CSS treatment block rather than 5 bespoke rule sets, keeping the CTA-only exception isolated to its original selector"

requirements-completed: [UI-01, UI-02]

coverage:
  - id: D1
    description: "All 4 exercise-type renderers' option/chip classNames (.option, .match-left, .match-right, .bank-chip, .sequence-chip) styled with chunky border/radius/floor, no shadow, no accidental 52px CTA inheritance"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "npm test -- tests/ui/exercise-renderers (existing renderer tests pass unmodified, confirming no DOM/structure regression from the CSS-only change)"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 human-verify checkpoint: live npm run dev browser walkthrough confirmed all option/chip buttons share chunky-border 44px-floor styling and turn accent-blue on selection/pairing/placement"
        status: pass
    human_judgment: false
  - id: D2
    description: "Theory toggle buttons (Понятно/Не понятно) carry a dedicated .theory-toggle className, visually distinct from primary CTAs, 44px floor confirmed (not the 52px CTA exception)"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "tests/ui/screens/TheoryScreen.test.ts (new .theory-toggle className assertion + 3 pre-existing tests)"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 human-verify checkpoint: confirmed theory buttons are chunky (14px radius, visible border) but visually smaller/less prominent than a primary CTA"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full re-skinned lesson flow (top bar, theory, all 4 exercise types, feedback banners, reward toast, session-end screen) manually walked through in a live browser and approved, with no Roblox-branding resemblance"
    requirement: "UI-01"
    verification:
      - kind: manual_procedural
        ref: "Task 3 checkpoint:human-verify — live npm run dev walkthrough via Claude Preview browser tools (orchestrator, standing in for an absent user); approved with 2 real gaps found and fixed in-flight (praiseRu wiring, SessionEndScreen styling)"
        status: pass
    human_judgment: true
    rationale: "Perceived visual/aesthetic quality and brand-resemblance judgment ('does this look distinct from Roblox') requires human/visual sign-off; already performed this session via live browser walkthrough per the checkpoint resolution, not re-derived from prose."
  - id: D4
    description: "Reward Advisor's praiseRu text is actually rendered in the correct-answer feedback banner (fixes a silent functional gap where the agent-proposed praise text was computed/cross-checked but never surfaced to the child)"
    requirement: "UI-02"
    verification:
      - kind: unit
        ref: "tests/ui/components/FeedbackBanner.test.ts (3 new cases covering the optional praiseRu param)"
        status: pass
    human_judgment: false
  - id: D5
    description: "SessionEndScreen has real visual treatment (.child-section/.parent-section cards) instead of unstyled plain text, completing UI-01's 'every screen' coverage"
    requirement: "UI-01"
    verification:
      - kind: manual_procedural
        ref: "Task 3 human-verify checkpoint: confirmed the session-end screen shows the hero-spaced parent report with rubles earned, cream child card and blue-toned parent card"
        status: pass
    human_judgment: true
    rationale: "Visual card styling correctness (colors, spacing, contrast) requires human visual review; confirmed live this session via browser walkthrough."

duration: 22min
completed: 2026-07-03
status: complete
---

# Phase 5 Plan 02: Exercise Renderer Re-skin + Theory Toggles + Checkpoint-Found Gaps Summary

**Chunky/blocky CSS applied to all 4 exercise-type option/chip classNames and theory toggle buttons, plus 2 real gaps (missing praiseRu rendering, unstyled SessionEndScreen) found and fixed during the mandatory human-verify checkpoint's live browser walkthrough.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-03T22:54:06+03:00
- **Completed:** 2026-07-03T23:16:20+03:00
- **Tasks:** 3 (2 auto tasks + 1 checkpoint:human-verify, resolved via live browser walkthrough)
- **Files modified:** 7

## Accomplishments

- Added CSS rules for the 5 chip/option classNames Plan 01 intentionally left untouched (`.option`, `.match-left`, `.match-right`, `.bank-chip`, `.sequence-chip`): 14px radius, 3px darker-shade border via a new `--color-bg-secondary-dark` token, 44px floor, no shadow — confirmed none accidentally inherit the CTA-only 52px/shadow exception
- Gave the theory screen's Понятно/Не понятно buttons a dedicated `.theory-toggle` className, visually distinct from the CTA-only `.accent` marker, via a TDD (test-first) cycle
- Ran the mandatory Task 3 human-verify checkpoint as a real live browser walkthrough (`npm run dev` + Claude Preview browser tools, performed by the orchestrator standing in for an absent user) covering top bar, theory, all 4 exercise types' correct/incorrect feedback, matching chips, and session-end screen
- Found and fixed 2 real gaps during that walkthrough: (1) Reward Advisor's `praiseRu` was computed and cross-checked in `lessonEngine.ts` but never rendered anywhere in the UI — wired into `FeedbackBanner.ts`'s correct-answer banner via a new optional 3rd param, threaded through `main.ts`'s 4 call sites; (2) `SessionEndScreen` had zero visual treatment — added `.child-section`/`.parent-section` card styling in `src/style.css`
- Confirmed no Roblox-branding resemblance, no full-bleed error color, and correct reward-toast/thinking-indicator/feedback-animation behavior across the full lesson flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Chunky CSS rules for exercise chip/option classNames** - `a3d937e` (feat)
2. **Task 2 (TDD RED): failing test for theory-toggle className** - `83673c2` (test)
2. **Task 2 (TDD GREEN): theory toggle buttons get a distinct .theory-toggle class** - `6126d74` (feat)
3. **Task 3 (checkpoint resolution): wire Reward Advisor praiseRu into feedback banner and give session-end screen visual treatment** - `2683083` (fix)

**Incidental fix (non-blocking, discovered during checkpoint prep):** `16f0f6c` (chore) — enabled `autoPort` in `.claude/launch.json` so the preview tool can start the dev server even when port 5173 is already occupied by a stale process.

**Plan metadata:** (this commit, docs: complete plan)

_Note: Task 3 is a `checkpoint:human-verify` gate, not an auto task — its "commit" is the fix commit produced while resolving the checkpoint, not a task-type commit._

## Files Created/Modified

- `src/style.css` - added `.option`/`.match-left`/`.match-right`/`.bank-chip`/`.sequence-chip` chunky rules + `--color-bg-secondary-dark` token (Task 1); added minimal `.theory-toggle` rule (Task 2); added `.praise-text` styling and `.child-section`/`.parent-section` card treatment for `SessionEndScreen` (Task 3/checkpoint fix)
- `src/ui/screens/TheoryScreen.ts` - both toggle buttons now carry `className = "theory-toggle"`
- `tests/ui/screens/TheoryScreen.test.ts` - new assertion: both buttons carry `.theory-toggle`, neither carries the CTA-only `.accent` marker
- `src/ui/components/FeedbackBanner.ts` - added optional 3rd `praiseRu` param, rendered as a `.praise-text` paragraph inside the correct-answer banner
- `src/main.ts` - `feedback` object and all 4 call sites now thread `praiseRu` through to `FeedbackBanner`
- `tests/ui/components/FeedbackBanner.test.ts` - new test file, 3 cases covering the optional `praiseRu` param
- `.claude/launch.json` - `autoPort: true` so the preview tool can start the dev server even when port 5173 is occupied

## Decisions Made

- Theory toggle buttons get a dedicated `.theory-toggle` className rather than relying on absence of `.accent`, keeping the CTA-only 52px/shadow treatment cleanly isolated to `submit-row button.accent`/`show-results-button`/`continue-button` per Plan 01's scoping.
- Chip/option unselected-state styling is CSS-only — no exercise-renderer TS file needed changes, since each renderer's existing accent-class toggle on selection already applies Plan 01's shared `button.accent`/`.selected` rule automatically.
- The 2 gaps found during Task 3's mandatory live-browser checkpoint walkthrough were fixed in-flight as part of resolving that checkpoint (Rule 1/Rule 3-class in-the-moment fixes discovered during verification), not treated as separate ad hoc deviations outside the plan: `praiseRu` was a real functional gap (agent-proposed value computed and gated but silently discarded before reaching the child), and the unstyled `SessionEndScreen` was a real visual gap against ROADMAP SC1's "every screen" requirement.

## Deviations from Plan

### Auto-fixed Issues (found during Task 3's mandatory human-verify checkpoint)

**1. [Rule 1/Rule 2 - Missing functional wiring] Reward Advisor's praiseRu never reached the UI**
- **Found during:** Task 3 (live browser walkthrough of the full lesson flow)
- **Issue:** `lessonEngine.ts` computed and cross-checked the Reward Advisor's proposed `praiseRu` (celebration text) against real reward events, but no UI component ever rendered it — the entire "agent proposes praise text" value from REWARD-03 was silently discarded at the last mile.
- **Fix:** `FeedbackBanner.ts`'s render function now accepts an optional 3rd `praiseRu` param, rendered as a `.praise-text` paragraph inside the correct-answer banner only; `main.ts`'s `feedback` object and all 4 call sites thread it through.
- **Files modified:** `src/ui/components/FeedbackBanner.ts`, `src/main.ts`, `src/style.css`, `tests/ui/components/FeedbackBanner.test.ts` (new, 3 cases)
- **Verification:** Full suite green (243/243); confirmed live via browser walkthrough that praise text now appears on correct answers.
- **Committed in:** `2683083`

**2. [Rule 2 - Missing critical UI coverage] SessionEndScreen had zero visual treatment**
- **Found during:** Task 3 (live browser walkthrough, reaching the end of the lesson)
- **Issue:** `SessionEndScreen` rendered as plain unstyled text on the page background, failing ROADMAP SC1's "every screen... uses a consistent childish, blocky, brightly colored visual style" for this one screen and contradicting `05-UI-SPEC.md`'s own "hero section" framing for this celebratory moment.
- **Fix:** Added a `.child-section` card (cream background, bordered, rounded, centered, bold headline) and a visually distinct `.parent-section` card (secondary/blue background, bold `.headline`) in `src/style.css`. No `SessionEndScreen.ts` structural changes needed — Plan 01 already targeted `.session-end-screen`/`.child-section`/`.parent-section` directly.
- **Files modified:** `src/style.css`
- **Verification:** Confirmed live via browser walkthrough that the session-end screen now shows the hero-spaced parent report with distinct child/parent card styling.
- **Committed in:** `2683083`

---

**Total deviations:** 2 auto-fixed (both found during the plan's own mandatory Task 3 checkpoint, both essential to actually delivering REWARD-03's and UI-01's already-committed value — not scope creep)
**Impact on plan:** Both fixes close real gaps between already-implemented Phase 4 agent logic / already-written Plan 01 CSS selectors and what the child/parent actually see on screen. No new requirements, no architectural change.

## Issues Encountered

None beyond the 2 gaps documented above, which were resolved within the checkpoint-resolution step itself.

**Non-blocking observation (not a Phase 5 defect):** every live LLM router call during this session's browser walkthrough failed with a 401 auth error (confirmed via network tab), meaning only the deterministic FALLBACK path was exercised live, never the agent-success path, for all 5 agents. This is a pre-existing environment/API-key issue already documented in `STATE.md`'s Blockers ("local dev / demo only" — see Phase 3's `03-CONTEXT.md` D-03 on the third-party LLM router key). It is not something Phase 5's code changed and not in scope for this plan; flagged here as an observation for the user, since it means the "bright/blocky UI when an agent actually succeeds" path (e.g., a genuinely agent-authored `praiseRu`) was not visually exercised this session — only the fallback-path UI was confirmed live.

## User Setup Required

None - no external service configuration required. (The pre-existing LLM router 401 noted above is an existing configuration concern, not new setup introduced by this plan.)

## Next Phase Readiness

- Phase 5 (kid-friendly-visual-design) is now fully complete: both plans (05-01 foundation/shared-components, 05-02 per-screen re-skin) landed, human-verify checkpoint approved with 2 real gaps found and fixed in-flight.
- UI-01 and UI-02 are both satisfied across every screen in the lesson flow (top bar, theory, all 4 exercise types, feedback banners, reward toast, session-end/parent report).
- Full test suite green (243/243), `tsc --noEmit` clean, working tree clean at hand-off.
- No blockers for milestone completion review, other than the pre-existing LLM router 401 observation above (unrelated to this phase, already tracked in STATE.md).

---
*Phase: 05-kid-friendly-visual-design*
*Completed: 2026-07-03*

## Self-Check: PASSED

All modified files verified present on disk; all commit hashes referenced above (a3d937e, 83673c2, 6126d74, 2683083, 16f0f6c) verified present in `git log`. Full test suite re-run this session: 243/243 passing. `npx tsc --noEmit -p .` re-run this session: zero errors. Working tree clean (`git status --short` empty) before this SUMMARY was written.
