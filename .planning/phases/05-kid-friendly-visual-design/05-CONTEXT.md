# Phase 5: Kid-Friendly Visual Design - Context

**Gathered:** 2026-07-03 (autonomous run — no user available; recommended defaults auto-selected for every grey area, consistent with `workflow.mode=yolo`/`--auto` semantics used throughout this session)
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase re-skins every existing screen (theory, all 4 exercise types, feedback banner, review pass, session-end/parent report) with the kid-friendly, blocky, Roblox-inspired visual identity SPEC.md §15/ROADMAP's Phase 5 goal describes — WITHOUT any Roblox branding, logos, or assets. Structural layout, interaction mechanics, and copy contracts were already locked in `01-UI-SPEC.md` (Phase 1) and are NOT re-derived here — this phase only changes the visual skin (color, typography, spacing scale usage, shape language, motion) applied to the existing DOM structure. No new screens, no new interaction mechanics, no new requirements beyond UI-01/UI-02.

</domain>

<decisions>
## Implementation Decisions

### Color Palette

- **D-01:** Bright, saturated, primary-color-forward palette (blues/yellows/greens/reds at high saturation — think playful-blocky-game aesthetic, not pastel/muted) — matches "яркий" (bright) from SPEC.md §15 literally, and is the most common interpretation of "Roblox-inspired" without copying Roblox's actual brand colors/logo/assets (which remain explicitly excluded).
- **D-02:** Extend Phase 1's existing 60/30/10 token structure (`--color-bg`, `--color-bg-secondary`, `--color-accent`, `--color-error`, `--color-success`) rather than inventing a new token system — swap the VALUES (white/gray/neutral-blue → bright saturated equivalents), keep the semantic ROLES identical, so no code beyond CSS custom-property values and component classNames needs to change for the color layer.
- **D-03:** Keep exactly 2 functional signal colors (success green, error red) distinct from the primary brand accent — non-punitive tone for errors (ROADMAP SC4) means error red is used sparingly (banner border/icon only, never a harsh full-bleed red), consistent with Phase 1's existing restraint.

### Shape Language & Components

- **D-04:** "Blocky" = large border-radius (12-16px, not fully pill-shaped/circular) on buttons/cards/chips, thick borders (2-4px) in a darker shade of the element's own color (a common "chunky game UI" technique), and generous padding — no skeuomorphism, no gradients/shadows beyond a subtle flat drop-shadow for depth on primary buttons.
- **D-05:** No icon library or third-party asset package — this project's architecture is deliberately vanilla TS/CSS with zero UI framework/registry dependencies (Phase 1's `01-UI-SPEC.md` "Registry Safety" section, still binding). Icons/decorative elements are either: (a) plain CSS shapes (circles, squares, simple triangles), or (b) a small curated set of standard Unicode emoji (✓, ✗, 💰/₽ symbol, 💡) already usable with zero asset pipeline — no custom SVG illustration set, no mascot character (avoids both scope creep and any risk of accidentally resembling Roblox branding).
- **D-06:** Buttons: large touch targets (Phase 1 already established 44×44px minimum; this phase can go larger, e.g. 48-56px height for primary CTAs) with fully-rounded corners relative to blockiness (D-04's 12-16px radius, not circular) and a visible "pressed" state (slight vertical shift + border-color change) for tactile feedback on tap — pure CSS `:active`, no JS/animation library needed.

### Typography

- **D-07:** Replace the Phase 1 system-font stack with a single rounded/friendly display-adjacent web-safe-first choice — since this project has zero network dependency for fonts today (Phase 1 deliberately chose system fonts to avoid a new dependency), stay consistent: use a bold system-adjacent stack for headings (`-apple-system`/`Segoe UI`/Roboto, already available, just heavier weights + larger sizes) rather than introducing a webfont load (avoids a new external dependency/network risk for a diploma-defense demo scenario, mirrors D-03 from Phase 3's "don't add a new dependency without a clear need" precedent). If a genuinely rounded font (e.g. a bundled local `@font-face` file) is trivial to add without new runtime dependencies, the executor may do so at their discretion — not required.
- **D-08:** Keep Phase 1's size/line-height ratios (Body 16/1.5, Label 14/1.2, Heading 20/1.2, Display 28/1.2) as the FLOOR — this phase may increase sizes for a punchier kid-friendly feel (e.g. Display up to 32-36px) but must not go below Phase 1's baseline (keeps text reflow/layout assumptions from Phase 1-4 intact).

### Motion & Waiting States

- **D-09:** Lightweight CSS-only motion (transitions/keyframe animations, no JS animation library) — a short bounce/scale-in on correct-answer feedback, a gentle shake on incorrect (not punitive — small, brief, calm per ROADMAP SC4), and a simple pulsing/rotating "thinking" indicator (CSS `@keyframes`, no spinner GIF/library) for all 5 agent-call waiting states (ROADMAP SC3) — reuses the SAME thinking-indicator component/class across Answer Checker, Theory Tutor, Progress Advisor, Reward Advisor, Parent Report Generator waits, rather than 5 bespoke ones.
- **D-10:** Reward/rubles: a brief "+N ₽" toast/badge animation when a reward event fires (rather than only a static number update) — small scope addition within Phase 5's "reward" mention in ROADMAP SC1, not a new requirement (REWARD-01/02/03/04 already fully implemented in Phase 2/4; this phase only adds the VISUAL celebration of an already-decided reward event, never invents new reward logic).

### Screen Coverage & Priority

- **D-11:** All screens get the skin in one pass (not phased/prioritized within this phase) — theory, all 4 exercise-type renderers (text-input/single-choice/matching/order-builder), feedback banner, progress indicator, top bar, session-end screen (Progress Advisor recommendation + Parent Report). ROADMAP's SC1 explicitly lists all of these together as one success criterion, not a partial-coverage MVP within Phase 5 itself (Phase 5 IS the whole-MVP's "MVP mode" polish pass, not something to slice further).
- **D-12:** Deferred UI polish items from `01-UAT.md` (feedback banner not clearing on exercise-advance; progress indicator overshooting to "N+1 из N" at lesson-complete) — both explicitly deferred to Phase 5 in STATE.md's Blockers/Concerns — are IN SCOPE for this phase to fix, since they are pre-existing bugs this phase's screen rework will touch anyway, not new scope.

### Claude's Discretion

- Exact hex values within the "bright saturated" palette direction (D-01) — left to planner/executor/ui-researcher informed by standard bright-kids-app color theory (high-saturation blue/yellow/green/red family), avoiding anything resembling Roblox's actual brand red/white logo mark.
- Whether `style.css` grows in place or splits into per-component CSS files — implementation detail, no architectural principle at stake (project has no CSS bundler-imposed convention yet).
- Precise animation timing/easing curves — executor's call, informed by "calm, non-punitive, brief" framing above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specification
- `SPEC.md` §15 (visual style and lesson screen literal spec — the source of "детский, блочный, яркий, Roblox-вдохновлённый, без бренда")
- `.planning/REQUIREMENTS.md` — UI-01, UI-02 (the only 2 requirements this phase satisfies)

### Phase 1 Artifacts (dependency — structural contract, NOT re-derived)
- `.planning/phases/01-deterministic-core-lesson-rendering-persistence/01-UI-SPEC.md` — the existing design contract this phase evolves (spacing scale, typography ratios, color token structure, structural layout, copywriting contract, registry-safety "no framework" constraint) — read in full before making any visual decision, since this phase's job is to change VALUES within this established structure, not invent a new one
- `src/style.css` — current baseline CSS implementing 01-UI-SPEC.md literally; this phase's changes land here (or successor files)

### Cross-Phase UI Touchpoints (dependency — screens/components this phase re-skins)
- `src/ui/screens/TheoryScreen.ts`, `src/ui/screens/ExerciseScreen.ts`, `src/ui/screens/SessionEndScreen.ts` (Phase 4)
- `src/ui/components/FeedbackBanner.ts`, `src/ui/components/ProgressIndicator.ts`, `src/ui/components/FatalError.ts`
- `src/ui/exercise-renderers/{textInput,singleChoice,matching,orderBuilder}.ts`
- `src/main.ts` — top-bar rendering, thinking-cue wiring for all 5 agent calls (Phase 3/4 async handlers)

### Deferred UI Bugs In Scope for This Phase
- `.planning/phases/01-deterministic-core-lesson-rendering-persistence/01-UAT.md` Gaps section — feedback banner not clearing on exercise-advance (Gap 1), progress indicator overshoot at lesson-complete (Gap 2)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/style.css` (175 lines) — already has a spacing scale, typography roles, and color token structure per `01-UI-SPEC.md`; this phase EXTENDS these tokens' values rather than replacing the system.
- Existing pure-CSS-only, zero-framework, zero-icon-library discipline (Phase 1-4) — this phase must not introduce a UI framework, icon package, or animation library; everything is achievable in plain CSS per D-05/D-09.

### Established Patterns
- `createElement`/`textContent` only, zero `innerHTML` (all phases, security-relevant pattern — grep-verified clean in Phase 3 verification) — MUST continue in this phase's DOM changes.
- Component-per-file under `src/ui/` (screens/ vs components/ vs exercise-renderers/) — this phase's visual changes stay within this existing file organization, no restructuring needed.

### Integration Points
- Every existing render function in `src/ui/` is a re-skin target; none need new props/data — this phase is CSS + minor className/structure additions only, not a data-flow change. Async "thinking" UI states already exist functionally (Phase 3/4 disabled-buttons + cue text pattern in `main.ts`) — this phase only needs to make that cue VISUALLY on-brand (D-09), not change its trigger logic.

</code_context>

<specifics>
## Specific Ideas

No specific mockups/references were provided (autonomous run, no user available). The "Roblox-inspired without Roblox branding" direction comes directly from SPEC.md §15's literal wording, interpreted per D-01/D-04 above as: bright saturated colors + large rounded-but-blocky (not fully round) shapes + chunky borders + tactile button press states — a generic "blocky playful game UI" aesthetic, not any Roblox-specific visual asset, wordmark, or color scheme.

</specifics>

<deferred>
## Deferred Ideas

- Custom mascot character / branded illustration set — explicitly excluded by "no Roblox branding/logos/assets" and by this project's "no asset pipeline" architecture; a generic blocky/color aesthetic achieves the goal without needing custom art.
- Bundled custom webfont — Claude's Discretion (D-07), not required; default is to stay within the existing system-font, zero-new-dependency approach unless trivial to add.

### Reviewed Todos (not folded)

None — no pending todos matched this phase.

</deferred>

---

*Phase: 5-Kid-Friendly Visual Design*
*Context gathered: 2026-07-03*
