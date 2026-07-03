# Phase 4: Progress Advisor, Reward Advisor & Parent Report - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 4-Progress Advisor, Reward Advisor & Parent Report
**Areas discussed:** Reward Advisor: когда вызывается, Сценарий конца сессии, difficultyMode — что он реально делает, wordStats — стоит ли строить

---

## Reward Advisor: когда вызывается

| Option | Description | Selected |
|--------|-------------|----------|
| Один раз в конце сессии | Один LLM-вызов на весь rewardHistory сессии; дешевле, проще архитектурно | |
| Live на каждое начисление | Как Answer Checker — вызов после каждого ответа, реальное время | ✓ |

**User's choice:** Live на каждое начисление (не рекомендованный дефолт).

**Notes:** Follow-up — вызывается ли на КАЖДОЕ начисление (включая honest_attempt +1₽) или только на значимые причины:

| Option | Description | Selected |
|--------|-------------|----------|
| Только значимые (first_try_correct, correct_after_hint, streak_bonus, weak_topic_closed) | Меньше LLM-запросов | |
| Абсолютно на каждое (включая honest_attempt) | До 19+ вызовов за урок | ✓ |

Where does praise text render:

| Option | Description | Selected |
|--------|-------------|----------|
| В той же feedback-баннере | Без нового UI-элемента | ✓ |
| Отдельный элемент (тост/бейдж) | Больше UI-работы | |

Batching when multiple reward events fire on one answer:

| Option | Description | Selected |
|--------|-------------|----------|
| 1 вызов на ответ | Все события этого ответа одним списком агенту, одна фраза похвалы | ✓ |
| 1 вызов на каждую награду | Несколько параллельных/последовательных LLM-вызовов на один клик | |

---

## Сценарий конца сессии

| Option | Description | Selected |
|--------|-------------|----------|
| Заменить "Урок завершён!" одним экраном | Рекомендация Progress Advisor + отчёт родителю вместе, один экран | ✓ |
| Добавить блоки под "Урок завершён!" | Сообщение остаётся, снизу добавляются блоки | |
| Два разных экрана (ребёнок/родитель) | Больше UI-работы, требует навигации | |

Progress Advisor vs Parent Report — один вызов или два:

| Option | Description | Selected |
|--------|-------------|----------|
| Два отдельных вызова | Сохраняет "5 независимых агентов" из SPEC §6/§8 | ✓ |
| Один совмещённый вызов | Дешевле по LLM-запросам, но нарушает архитектурный принцип | |

Call order — sequential (SPEC §8.4 implies Parent Report needs Progress Advisor's final recommendation as input):

| Option | Description | Selected |
|--------|-------------|----------|
| Да, последовательно | Progress Advisor резолвится первым (agent или fallback), его итог идёт в Parent Report | ✓ |
| Нет, параллельно | Быстрее, но расходится со SPEC §8.4's stated input | |

Loading UX while both calls run:

| Option | Description | Selected |
|--------|-------------|----------|
| Краткий thinking-экран | Как в Phase 3 — отключённые кнопки + thinking cue | ✓ |
| Немо, без индикатора | Проще, но риск ощущения "зависания" | |

**User's choice:** Combined screen, two separate sequential agent calls, thinking-screen during the wait.
**Notes:** When asked "any remaining open questions on this area?", user turned the question back ("а у тебя остались какие-то незакрытые вопросы?") — Claude confirmed no further gaps and moved to the next area.

---

## difficultyMode — что он реально делает

| Option | Description | Selected |
|--------|-------------|----------|
| Только вычисляется и хранится | Ядро ведёт защитные правила и хранит значение, но на текущий урок не влияет (нет easy/challenge контента в MVP) | ✓ |
| Должно видимо на что-то влиять | Требует придумывать неспецифицированную механику — риск scope creep | |

Follow-up — timing given only 1 lesson exists in MVP:

| Option | Description | Selected |
|--------|-------------|----------|
| Считается только в конце сессии | Честно соответствует "меняется только между уроками" при 1 уроке в MVP | ✓ |
| Считать внутри сессии тоже (после каждого ответа) | Нарушает букву SPEC, но показывает "живую" динамику | |

**User's choice:** Compute-and-store only, calculated once at session end.

---

## wordStats — стоит ли строить

| Option | Description | Selected |
|--------|-------------|----------|
| Да, построить | SPEC §8.2 явно называет wordStats отдельным входом для Progress Advisor | ✓ |
| Нет, достаточно topicStats/exerciseTypeStats | Отклонение от SPEC §8.2, но осознанное (данных мало — 10 слов, каждое 1 раз) | |

Keying/update rule:

| Option | Description | Selected |
|--------|-------------|----------|
| Петля по всем targetWords[] | Как D-01 в Phase 2 для topicImpact — не ломается при 2+ словах в будущем | ✓ |
| Только первое слово | Проще, но теряет данные при заданиях с несколькими словами | |

**User's choice:** Build wordStats, loop over all targetWords[] entries (mirrors Phase 2's topicImpact pattern).

---

## Claude's Discretion

- Exact TypeScript shape/module layout for `wordStats`, `exerciseTypeStats`, `StudentProfileSchema` extensions.
- `confidenceScore` formula is fixed by SPEC.md §12 — implementation only, no product decision.
- Visual/structural implementation of the end-of-session screen (D-05 only fixes it's one combined screen).
- `exerciseTypeStats` shape — no gray area surfaced.

## Deferred Ideas

- Full easy/normal/challenge content variants for `difficultyMode` to visibly act on — requires new lesson content authoring, out of MVP scope.
- REPORT-03 (cross-lesson trend) — not a Phase 4 requirement, `lessonHistory` stays untyped.
