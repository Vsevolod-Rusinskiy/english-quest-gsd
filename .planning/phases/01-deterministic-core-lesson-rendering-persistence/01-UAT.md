---
status: testing
phase: 01-deterministic-core-lesson-rendering-persistence
source: [01-VERIFICATION.md]
started: 2026-07-02T11:00:00Z
updated: 2026-07-02T11:00:00Z
---

## Current Test

number: 1
name: Run `npm run dev`, complete theory → all 19 real exercises (18 text-input + 1 matching) in a real browser
expected: |
  Theory screen shows rule + example + both buttons; each exercise shows prompt, input UI, "Задание N из 19";
  correct answers show "Верно!"; lesson-complete state appears at exercise 19
awaiting: user response

## Tests

### 1. Full lesson playable in a real browser
expected: Theory screen shows rule + example + both buttons; each exercise shows prompt, input UI, "Задание N из 19"; correct answers show "Верно!"; lesson-complete state appears at exercise 19
result: [pending]

### 2. Reload the browser (Cmd/Ctrl+R) mid-lesson
expected: App resumes at the exact same exercise index, not back at theory
result: [pending]

### 3. localStorage tamper-reset
expected: Open devtools → Local Storage, confirm key `english-quest-progress-v1` with `{schemaVersion:1,data:{...}}`; edit to invalid JSON, reload — app silently resets to a fresh working lesson, no crash, no stack trace
result: [pending]

### 4. D-06 fail-loudly on broken lesson data
expected: Temporarily break `public/Lesson-1A.json` (delete `theory` field), reload — clear "Не удалось загрузить урок." message appears, lesson does not render
result: [pending]

### 5. single-choice and order-builder playable (no real lesson data for these types)
expected: Play a single-choice exercise and an order-builder exercise via a dev harness or temporarily-wired fixture. single-choice: tap exactly one option (accent-marked), submit grades it. order-builder: tap words from "Слова:" into "Твой ответ:" in order, tap back out (no dragging), submit grades the assembled order
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
