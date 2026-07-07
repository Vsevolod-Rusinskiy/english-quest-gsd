---
phase: quick-260707-hby
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/ui/exercise-renderers/textInput.ts
  - src/ui/exercise-renderers/singleChoice.ts
  - src/ui/exercise-renderers/matching.ts
  - src/ui/exercise-renderers/orderBuilder.ts
  - src/style.css
  - public/Lesson-1A.json
  - tests/ui/exercise-renderers/textInput.test.ts
autonomous: true
requirements:
  - QUICK-260707-HBY
must_haves:
  truths:
    - "A two-blank text-input exercise renders one inline input per blank with the printed interior words (e.g. 'usually') visible between the inputs, in reading order."
    - "Correctly filling only the missing words in a two-blank exercise is accepted by the existing deterministic checkTextInput (no false rejection)."
    - "Single-blank text-input exercises (15 of 18) render and behave exactly as before — one input below the prompt."
    - "The Russian instruction line reads as a subtle gray hint (smaller/lighter, WCAG AA >= 4.5:1 on the cream bg) in all 4 exercise renderers, while the English task line stays full-weight."
  artifacts:
    - src/ui/exercise-renderers/textInput.ts
    - src/style.css
    - public/Lesson-1A.json
  key_links:
    - "textInput.ts onSubmit(rawAnswer: string) contract stays identical → main.ts and lessonEngine unchanged."
    - ".instruction-ru CSS rule applied via className 'instruction-line instruction-ru' on the RU line in all 4 renderers."
    - "Multi-blank reconstruction string → normalize() → matches acceptedAnswers in checkTextInput (unchanged)."
---

<objective>
Fix a live-found correctness bug and apply a paired styling change.

Bug: text-input exercises with MULTIPLE "___" blanks render as a single input box, but the
expected answer string bundles in words already printed between the blanks (e.g. "usually").
A child who correctly fills only the two blanks ("don't have" for "They ___ usually ___ a big
meal") is falsely rejected. Fix: render ONE inline input per blank so each gap is filled in
context with the printed interior words visible between the inputs, then reconstruct the same
single answer string the deterministic checker already expects — keeping checkTextInput,
normalize, lessonEngine, and main.ts's onSubmit contract untouched.

Styling (user PS): render the Russian instruction line as a subtle gray hint (smaller/lighter,
not equal-weight black) across all 4 exercise renderers.

Purpose: Remove a false-rejection that punishes correct answers on the 3 two-blank exercises;
make the RU line read as a subordinate hint under the English task line.
Output: Multi-blank inline rendering + reconstruction in textInput.ts, a lesson-DATA addition
for ex004, a shared .instruction-ru gray-hint style wired into all 4 renderers, and extended tests.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@./.claude/CLAUDE.md
@src/ui/exercise-renderers/textInput.ts
@src/ui/exercise-renderers/renderExercise.ts
@src/ui/exercise-renderers/singleChoice.ts
@src/ui/exercise-renderers/matching.ts
@src/ui/exercise-renderers/orderBuilder.ts
@src/core/answer-checking/normalize.ts
@src/core/answer-checking/checkTextInput.ts
@public/Lesson-1A.json
@src/style.css
@tests/ui/exercise-renderers/textInput.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Render one inline input per blank in textInput.ts (multi-blank), reconstruct the single answer string on submit</name>
  <files>src/ui/exercise-renderers/textInput.ts</files>
  <action>
Modify renderTextInput so a text-input exercise with 2+ blanks renders inline inputs, and a
1-or-0-blank exercise keeps the CURRENT single-input-below-prompt behavior byte-for-byte.

Split the prompt: compute `parts = exercise.prompt.split("___")`. Then `blankCount = parts.length - 1`.
`parts[0]` is text before the first blank, `parts[parts.length - 1]` is text after the last blank,
and `parts[1..blankCount-1]` are the interior segments printed BETWEEN consecutive blanks.

Branch on blankCount:

- If blankCount <= 1: keep the existing code path unchanged — the prompt paragraph with
  exercise.prompt, one input below it, submit disabled until input.value.trim() is non-empty,
  submitButton click calls onSubmit(input.value), and queueMicrotask(() => input.focus()) on
  the single input. Do NOT alter single-blank layout, disabled logic, focus behavior, or the
  onSubmit value. 15 of 18 exercises are single-blank and must be untouched.

- If blankCount >= 2: build an inline prompt. Create the same prompt `<p>` element, but instead
  of setting its textContent to the whole prompt, interleave printed segments and inputs in
  reading order: append a text node (or span) for parts[0], then for i from 0 to blankCount-1
  append inline input[i], and after each input[i] (except when i is the last) append a text node
  for parts[i+1] (the interior segment following that blank), then finally append a text node for
  parts[parts.length - 1] (the trailing segment after the last blank). Give each inline input a
  class such as "inline-blank" so it can be styled distinctly from the single-input layout; keep
  input.type = "text". Store the inputs in an array `blankInputs` in blank order.

  Submit gating (multi-blank): the submit button is disabled until EVERY blank input has a
  non-empty trimmed value. Attach an "input" listener to each blank input that recomputes
  submitButton.disabled = blankInputs.some(inp => inp.value.trim().length === 0).

  Reconstruction on submit (multi-blank): build the raw answer by interleaving the blank input
  VALUES with the INTERIOR printed segments only — NOT parts[0] and NOT parts[last]:
  rawAnswer = blankInputs[0].value + parts[1] + blankInputs[1].value + parts[2] + ...
  + parts[blankCount-1] + blankInputs[blankCount-1].value. Concretely: start with the first
  blank's value, then for i from 1 to blankCount-1 append parts[i] followed by blankInputs[i].value.
  Pass this single reconstructed string to onSubmit(rawAnswer) — identical single-string contract
  as today. normalize() collapses whitespace, so raw interior spacing (leading/trailing spaces in
  parts[i]) is fine and must NOT be trimmed away manually.

  Focus: focus the FIRST blank input on render via queueMicrotask(() => blankInputs[0].focus()),
  mirroring the current single-input focus.

Reconstruction sanity (verify against real data during implementation):
- ex003 "They ___ usually ___ a big meal..." with blanks ["don't","have"], parts[1]=" usually "
  → "don't" + " usually " + "have" = "don't usually have" → normalize → matches acceptedAnswers.
- ex002 "___ you usually ___ late? (get up)" with blanks ["Do","get up"], parts[1]=" you usually "
  → "Do you usually get up" → normalize → matches "do you usually get up".
- ex004 "What ___ you ___ tonight? (do)" with blanks ["are","doing"], parts[1]=" you "
  → "are you doing" → normalize → "are you doing" (added to ex004 data in Task 2).

createElement / textContent / appendChild / text nodes only — NO innerHTML (project convention).
Keep the "Проверить" button below the prompt in both branches. Do NOT touch checkTextInput,
normalize, lessonEngine, or the onSubmit(rawAnswer: string) signature.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>blankCount>=2 exercises render inline inputs with interior words between them and reconstruct to the checker-accepted string; blankCount<=1 exercises are byte-for-byte unchanged; onSubmit still takes a single reconstructed string; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 2: Add ex004's reconstructed answer to lesson data + wire the RU-hint gray style across all 4 renderers</name>
  <files>public/Lesson-1A.json, src/style.css, src/ui/exercise-renderers/textInput.ts, src/ui/exercise-renderers/singleChoice.ts, src/ui/exercise-renderers/matching.ts, src/ui/exercise-renderers/orderBuilder.ts</files>
  <action>
Two coordinated edits: a lesson-DATA addition and a shared RU-hint style.

DATA (public/Lesson-1A.json): For exercise eq-1a-ex004 ("What ___ you ___ tonight? (do)"), add
the string "are you doing" to its answerCheck.acceptedAnswers array, KEEPING the existing
"what are you doing". This makes the multi-blank reconstruction ("are you doing") accepted. This
is a lesson-DATA addition, NOT a schema change — do not alter the lesson-json-v1 shape. Do NOT
touch ex002 or ex003 answer sets (their reconstructions already match) and do NOT touch any other
exercise.

STYLE (src/style.css):
- Add a muted-gray palette token to :root alongside the existing color tokens (near --color-text
  at ~line 30): `--color-muted: #6b6b6b;`. Include a short comment noting it is the RU-hint gray
  and that #6b6b6b measures 5.03:1 against --color-bg (#fff8e7), passing WCAG AA (>= 4.5:1) — this
  ratio was computed, not eyeballed. (Do NOT put the literal token name inside any renderer .ts
  comment that a negative grep might match — this note lives only in CSS.)
- Add an `.instruction-ru` rule after the existing `.instruction-line` rule (~line 199). It makes
  the RU line a subtle hint: `color: var(--color-muted);` and a smaller size (e.g.
  `font-size: 14px;`). Because .instruction-ru is applied ALONGSIDE .instruction-line (both classes
  on the same element), .instruction-ru only overrides color/size; the RU line stays first (on top)
  and visually subordinate to the full-weight English task line.

RENDERERS (all 4): In textInput.ts, singleChoice.ts, matching.ts, orderBuilder.ts, change the RU
instruction line's className from "instruction-line" to "instruction-line instruction-ru". Leave
the English instruction line as just "instruction-line". Each renderer already builds
instructionRuLine and instructionEnLine identically, so this is a one-line className change per
file. The RU line stays appended FIRST (before the EN line) in every renderer — do not reorder.
  </action>
  <verify>
    <automated>node -e "const l=require('./public/Lesson-1A.json'); const ex=l.sections.flatMap(s=>s.exercises).find(e=>e.id==='eq-1a-ex004'); if(!ex.answerCheck.acceptedAnswers.includes('are you doing')||!ex.answerCheck.acceptedAnswers.includes('what are you doing')) process.exit(1); console.log('ex004 accepted OK');"</automated>
  </verify>
  <done>eq-1a-ex004.acceptedAnswers contains both "are you doing" and "what are you doing"; :root has --color-muted #6b6b6b with a WCAG note; .instruction-ru rule exists; all 4 renderers give the RU line class "instruction-line instruction-ru" while the EN line keeps "instruction-line"; RU line stays first.</done>
</task>

<task type="auto">
  <name>Task 3: Extend textInput tests for multi-blank reconstruction + single-blank invariance, then run full gate</name>
  <files>tests/ui/exercise-renderers/textInput.test.ts</files>
  <action>
Extend the existing textInput.test.ts (keep its 2 current tests green — do not weaken the existing
"instructionRu then instructionEn ... before the prompt" and "no innerHTML" assertions; note the
RU line now carries an extra class "instruction-ru", so if any assertion checks exact className
equality, update it to assert the element still matches .instruction-line and additionally carries
.instruction-ru — querySelectorAll('.instruction-line') still returns both lines).

Add tests driven by the REAL Lesson-1A.json data (load it as the existing fixture does):

1. Multi-blank reconstruction — for each of the 3 two-blank exercises (eq-1a-ex002, eq-1a-ex003,
   eq-1a-ex004): render via renderTextInput, capture the reconstructed onSubmit argument by
   passing an onSubmit spy, locate the inline blank inputs (e.g. inputs with class "inline-blank"),
   assert there are exactly 2 of them, set their .value to the two missing words a child would type
   (ex002 → "Do","get up"; ex003 → "don't","have"; ex004 → "are","doing"), click the "Проверить"
   button, and assert the captured string, when passed through checkTextInput for that exercise,
   yields isCorrect === true. Import checkTextInput and normalize (or just checkTextInput) to prove
   the reconstruction is accepted end-to-end by the UNCHANGED deterministic checker. This is the
   core regression guard for the false-rejection bug.

2. Interior words visible — for one two-blank exercise (ex003), assert the rendered container's
   textContent includes the interior printed segment "usually" (the words that stay visible between
   the inputs).

3. Single-blank invariance — for a one-blank exercise (e.g. the first text-input, "He ___ at home
   today. (work)"): assert it renders exactly ONE input (querySelectorAll('input') length === 1),
   the submit button is disabled initially and enabled after typing a non-empty value, and clicking
   submit calls onSubmit with the raw typed value verbatim (no reconstruction applied). This guards
   the 15 untouched single-blank exercises.

Use the jsdom-style DOM the existing tests rely on; keep imports consistent with the current file
(vitest describe/it/expect, TextInputExerciseSchema for parsing raw fixture exercises).

Then run the FULL gate before marking done: `npx vitest run` (all existing 264 tests plus the new
ones must pass) and `npx tsc --noEmit` (clean). If any pre-existing unrelated test fails, do not
mask it — report it.
  </action>
  <verify>
    <automated>npx vitest run && npx tsc --noEmit</automated>
  </verify>
  <done>New tests prove each of the 3 two-blank exercises reconstructs to a checkTextInput-accepted string, that interior words stay visible, and that single-blank behavior/onSubmit-verbatim is unchanged; full vitest suite green; tsc --noEmit clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| child input (blank fields) → renderer → onSubmit string → deterministic core | Untrusted free-text crosses here; reconstruction concatenates values and printed segments before the core normalizes/checks. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-hby-01 | Tampering | textInput.ts inline rendering (child input) | low | mitigate | createElement/textContent/text-node only — no innerHTML; child input is inserted as input.value / text nodes, never parsed as markup, so no DOM-injection path is introduced. |
| T-hby-02 | Tampering | onSubmit reconstruction string | low | mitigate | Reconstructed string flows through the UNCHANGED normalize() + checkTextInput deterministic path; the core still owns the correctness verdict — the renderer cannot bypass or fabricate acceptance. |
| T-hby-SC | Tampering | npm/pip/cargo installs | n/a | accept | No new dependencies added — pure edits to existing TS/CSS/JSON and a test file; no install tasks, so the package legitimacy gate does not apply. |
</threat_model>

<verification>
- `npx tsc --noEmit` clean.
- `npx vitest run` — all pre-existing tests (264) stay green; new multi-blank + single-blank tests pass.
- Manual data check: eq-1a-ex004.acceptedAnswers includes both "are you doing" and "what are you doing".
- Reconstruction of ex002/ex003/ex004 (missing-words-only child input) is accepted by checkTextInput.
- Single-blank exercises render one input and submit the raw value verbatim (no reconstruction).
- RU instruction line carries class "instruction-line instruction-ru" in all 4 renderers; EN line keeps "instruction-line"; RU line stays first.
- No innerHTML anywhere in textInput.ts.
- Untouched: checkTextInput.ts, normalize.ts, lessonEngine.ts, main.ts onSubmit contract, agent files, lesson-json-v1 schema shape.
</verification>

<success_criteria>
- Two-blank exercises render one inline input per blank with interior printed words (e.g. "usually") visible between inputs, in reading order.
- A child filling ONLY the two missing words is accepted (false-rejection bug closed) for ex002, ex003, ex004.
- The 15 single-blank exercises are byte-for-byte unchanged in layout, focus, disabled logic, and onSubmit value.
- The RU instruction line reads as a subtle gray hint (>= 4.5:1 WCAG AA on #fff8e7) across all 4 renderers; EN task line stays full-weight; RU stays on top.
- Full test suite green; tsc --noEmit clean.
</success_criteria>

<output>
Create `.planning/quick/260707-hby-multi-blank-text-input-exercises-render-/260707-hby-SUMMARY.md` when done.
</output>
