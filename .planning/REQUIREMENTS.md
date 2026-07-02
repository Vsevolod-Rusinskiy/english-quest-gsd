# Requirements: English Quest

**Defined:** 2026-07-02
**Core Value:** Проверить механику обучения целиком: детерминированная проверка ответов + LLM-агенты там, где нужна интерпретация, персонализация по прогрессу, повторение слабых тем, начисление бонусов — без единого «сломанного» состояния, даже если агент недоступен.

## v1 Requirements

Requirements for initial release (single lesson `Lesson-1A.json`). Each maps to roadmap phases.

### Theory (THEORY)

- [ ] **THEORY-01**: Ребёнок видит блок теории (правило + пример) перед началом упражнений урока
- [ ] **THEORY-02**: Ребёнок может отметить теорию как «понятно» или «не понятно»
- [ ] **THEORY-03**: При «не понятно» ребёнок получает более простое объяснение (Theory Tutor или заранее написанный fallback-уровень), максимум `maxSimplifyRounds` раз, затем мягкий переход к практике

### Exercises (EXERCISE)

- [ ] **EXERCISE-01**: Ребёнок проходит упражнения типа `text-input` с вводом текстового ответа
- [ ] **EXERCISE-02**: Ребёнок проходит упражнения типа `single-choice`
- [ ] **EXERCISE-03**: Ребёнок проходит упражнения типа `matching` (картинка → слово)
- [ ] **EXERCISE-04**: Ребёнок проходит упражнения типа `order-builder`
- [ ] **EXERCISE-05**: Ребёнок видит индикатор прогресса по уроку («задание N из 19»)

### Answer Checking (CHECK)

- [ ] **CHECK-01**: Ядро нормализует текстовый ответ (нижний регистр, trim, схлопывание пробелов, удаление финальной пунктуации) и точно сравнивает с `acceptedAnswers`
- [ ] **CHECK-02**: Для `single-choice`/`matching`/`order-builder` ядро детерминированно сравнивает выбор/сборку с ожидаемым результатом без вызова агента
- [ ] **CHECK-03**: При неоднозначном `text-input` ответе (нет точного совпадения) вызывается агент Answer Checker и возвращает вердикт и типизированную ошибку (`errorType`)
- [ ] **CHECK-04**: При недоступности/сбое Answer Checker — один повтор, затем детерминированный fallback (строгое сравнение, `errorType: unknown`)

### Progress & Weak Topics (PROGRESS)

- [ ] **PROGRESS-01**: Ядро ведёт счётчики попыток/правильных/ошибок/серий по каждому упражнению
- [ ] **PROGRESS-02**: Ядро ведёт статус каждой темы по машине состояний (Не изучено → В процессе → Повторить → Выучено) на основе пороговых правил ошибок/успехов
- [ ] **PROGRESS-03**: При 2+ ошибках по теме тема получает статус «Повторить», связанные задания добавляются в `reviewQueue`
- [ ] **PROGRESS-04**: Ребёнок может пройти задания из `reviewQueue` в той же сессии

### Personalization (PERSONAL)

- [ ] **PERSONAL-01**: Агент Progress Advisor даёт рекомендацию следующего фокуса, сложности (easy/normal/challenge) и совет по завершению сессии на основе `topicStats`/`wordStats`/`exerciseTypeStats`
- [ ] **PERSONAL-02**: Ядро применяет защитные правила смены сложности (не прыгать easy→challenge напрямую, менять только между уроками, вверх после 3 правильных подряд, вниз после 2 ошибок) независимо от совета агента
- [ ] **PERSONAL-03**: При недоступности Progress Advisor ядро использует только пороговые правила без персонализации

### Rewards (REWARD)

- [ ] **REWARD-01**: Ядро начисляет фиксированные суммы рублей по правилам (`honest_attempt`, `first_try_correct`, `correct_after_hint`, `fixed_mistake`, `streak_bonus`, `weak_topic_closed`) с лимитами на упражнение
- [ ] **REWARD-02**: Ядро ведёт леджер начислений `rewardHistory` (`rewardEventId`, `reason`, `amount`, `attemptNumber`, `createdAt`)
- [ ] **REWARD-03**: Агент Reward Advisor предлагает причины начисления и текст похвалы; ядро проверяет предложение и начисляет сумму само
- [ ] **REWARD-04**: При недоступности Reward Advisor ядро само применяет reward-правила без текста похвалы от агента

### Parent Report (REPORT)

- [ ] **REPORT-01**: После урока родитель видит короткий отчёт: сколько пройдено, сколько верно, что даётся трудно, что повторить, сколько рублей, одна рекомендация
- [ ] **REPORT-02**: Отчёт формируется агентом Parent Report Generator; при недоступности агента используется шаблонный отчёт из тех же полей

### Persistence (PERSIST)

- [ ] **PERSIST-01**: Прогресс (`studentProfile`, `lessonHistory`, статистика, `currentRewards`, `rewardHistory`, `reviewQueue`) сохраняется в `localStorage` под ключом `english-quest-progress-v1`
- [ ] **PERSIST-02**: Прогресс переживает перезагрузку страницы браузера

### Agent Reliability (RELY)

- [ ] **RELY-01**: Ответ любого из 5 агентов не считается доверенным, пока ядро не проверит валидность JSON и допустимость значений (единая точка валидации, не 5 разных реализаций)
- [ ] **RELY-02**: При сбое агента (битый JSON, таймаут, недоступность) — один повтор, затем детерминированный fallback; урок не прерывается
- [ ] **RELY-03**: В событиях фиксируется источник данных (`core`/`agent`) и факт сбоя — для отладки

### Visual Design (UI)

- [ ] **UI-01**: Экран урока использует детский, блочный, яркий стиль с крупными скруглёнными кнопками (Roblox-вдохновлённый, без брендинга/логотипов/ассетов Roblox)
- [ ] **UI-02**: Экран урока показывает верхнюю панель (название, баланс рублей, прогресс), заголовок урока и карточку задания с инструкцией RU+EN

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Content Pipeline

- **CONTENT-01**: Поддержка нескольких уроков помимо `Lesson-1A.json` (контентный пайплайн)
- **CONTENT-02**: Переключатель утверждения контента взрослым (`requiresAdultApproval`) — актуально только когда появится контентный пайплайн

### Extended Parent View

- **REPORT-03**: Короткий кросс-урочный тренд для родителя на основе `lessonHistory` (не полноценный дашборд)

### Engagement

- **ENGAGE-01**: Лёгкая ежедневная серия (streak-lite) в приложении, без пуш-уведомлений — только если проявится многодневное использование

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Голос, аудио, speaking, микрофон | Не входит в MVP — отдельная техническая поверхность (SPEC.md §2, §16) |
| Listening, reading как отдельный режим | Не входит в MVP — текстовые типы упражнений достаточны для проверки механики |
| Автоматический разбор PDF учебника, импорт Test Book | Данные урока уже готовы вручную (`Lesson-1A.json`); авто-парсинг — отдельная большая задача |
| Полная спейс-репетиция (SM-2/FSRS, многодневные интервалы) | Нужны многодневные данные, которых MVP (одна сессия) не генерирует; текущий same-session `reviewQueue` покрывает цель |
| Магазин/аватары за рубли | Не относится к проверке механики обучения — цели MVP; валюта без магазина допустима для MVP |
| Лидерборды / соревнования / лиги | Требуют бэкенда и нескольких пользователей — конфликтует с single-student, no-backend ограничением |
| Несколько учеников / профилей | `studentId` фиксирован как `primary` в MVP; мультипрофильность требует бэкенда |
| Генерация новых заданий (Exercise Generator) | Отдельная и более крупная задача (авторинг + QA контента), чем проверка готовых ответов |
| Мультиагентная оркестрация сложнее текущей | 5 независимых агентов-функций, вызываемых ядром в фиксированных точках — осознанный архитектурный предел MVP |
| Серверная часть / бэкенд / синхронизация между устройствами | MVP работает полностью локально в браузере (`localStorage`) |
| Богатый родительский дашборд (графики, многоурочные тренды, mastery heatmaps) | Требует многоурочной истории; с одним уроком дашборд был бы одной точкой данных, выданной за график |

## Traceability

Populated during roadmap creation — see `.planning/ROADMAP.md`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEORY-01 | Phase 1 | Pending |
| THEORY-02 | Phase 1 | Pending |
| THEORY-03 | Phase 3 | Pending |
| EXERCISE-01 | Phase 1 | Pending |
| EXERCISE-02 | Phase 1 | Pending |
| EXERCISE-03 | Phase 1 | Pending |
| EXERCISE-04 | Phase 1 | Pending |
| EXERCISE-05 | Phase 1 | Pending |
| CHECK-01 | Phase 1 | Pending |
| CHECK-02 | Phase 1 | Pending |
| CHECK-03 | Phase 3 | Pending |
| CHECK-04 | Phase 3 | Pending |
| PROGRESS-01 | Phase 2 | Pending |
| PROGRESS-02 | Phase 2 | Pending |
| PROGRESS-03 | Phase 2 | Pending |
| PROGRESS-04 | Phase 2 | Pending |
| PERSONAL-01 | Phase 4 | Pending |
| PERSONAL-02 | Phase 4 | Pending |
| PERSONAL-03 | Phase 4 | Pending |
| REWARD-01 | Phase 2 | Pending |
| REWARD-02 | Phase 2 | Pending |
| REWARD-03 | Phase 4 | Pending |
| REWARD-04 | Phase 4 | Pending |
| REPORT-01 | Phase 4 | Pending |
| REPORT-02 | Phase 4 | Pending |
| PERSIST-01 | Phase 1 | Pending |
| PERSIST-02 | Phase 1 | Pending |
| RELY-01 | Phase 3 | Pending |
| RELY-02 | Phase 3 | Pending |
| RELY-03 | Phase 3 | Pending |
| UI-01 | Phase 5 | Pending |
| UI-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 32 total (note: this section previously stated "30 total" — recount at roadmap creation found 32 distinct requirement IDs actually listed above; all 32 are mapped below)
- Mapped to phases: 32/32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-02*
*Last updated: 2026-07-02 after roadmap creation (traceability populated)*
