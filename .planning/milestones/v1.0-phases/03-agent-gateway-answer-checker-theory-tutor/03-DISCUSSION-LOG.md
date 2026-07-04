# Phase 3: Agent Gateway, Answer Checker & Theory Tutor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 3-Agent Gateway, Answer Checker & Theory Tutor
**Areas discussed:** LLM Provider & Key Handling (interactive, not auto), Agent Gateway Design, Answer Checker Integration, Theory Tutor Integration (auto)

**Mode:** Mixed — the key-handling question was raised interactively given its financial/security stakes; remaining implementation-detail areas were auto-resolved.

---

## LLM Provider & Key Handling (interactive)

**Initial question:** User has a Claude.ai/Claude Code monthly subscription, no separate Anthropic API key. Clarified: subscription billing is separate from API billing; API key must come from console.anthropic.com.

**User provided instead:** An existing key for a third-party router at `https://api.llmrouter.ru`, paid via their existing LLM access (not a new Anthropic account).

**Verification performed live (via curl, key never echoed to chat):**

| Test | Result |
|------|--------|
| `GET /v1/models` | 200, OpenAI-style list, includes `claude-haiku-4-5` |
| `POST /v1/messages` (`x-api-key`, `anthropic-version`) | 200, native Anthropic Messages API response shape |
| Forced strict tool use (`tool_choice: {type:"tool"}`) | 200, exact requested JSON schema returned |

**Conclusion:** `@anthropic-ai/sdk` works against this router unmodified — only `baseURL` changes.

**Key-handling architecture:**

| Option | Description | Selected |
|--------|-------------|----------|
| Direct browser call, key in `.env` → build | Simple, zero extra infra; scoped risk if publicly deployed | ✓ |
| Proxy (Cloudflare Workers or equivalent) | Key never in browser; requires infra the user doesn't have set up | |

**Selection:** Direct browser call (recommended for this project's scope)
**Notes:** User explicitly confirmed understanding: safe for local dev / in-person defense demo; NOT safe to deploy `dist/` publicly without switching to a proxy first. `.env` already created and gitignored; user filled in the real key directly (never typed into chat in usable form).

---

## Agent Gateway Design (auto)

Single shared `callAgent()` used by both agents (and later Phase 4's 3 more). One retry, no backoff. 8s timeout per attempt (not spec'd numerically, chosen as a reasonable ceiling). Zod-validates response before trusting it (defense in depth beyond strict tool use). Records `source`/failure per RELY-03.

---

## Answer Checker Integration (auto)

`checkTextInput`'s `isCorrect: false` becomes the Answer Checker trigger (not immediately final). `CheckResult` extended with `errorType`/`confidence`/`hintRu` per SPEC.md §8.1. Only `text-input` triggers it — other types stay fully deterministic (Phase 2 territory, unchanged).

---

## Theory Tutor Integration (auto)

Round 1 "не понятно" → core shows pre-written `explanationLevels[1]` (simple), no agent call. Rounds 2-3 → call Theory Tutor; fallback re-serves the same pre-written level (no new text fabricated on failure). After `maxSimplifyRounds` (3) → soft transition to practice regardless.

---

## Claude's Discretion

- Exact module layout for `callAgent()` and per-agent Zod schemas.
- `.env` variable naming — executor reads the user's actual `.env` rather than inventing new names.

## Deferred Ideas

- Cloudflare Workers proxy — only if/when public deployment is wanted.
- Progress Advisor, Reward Advisor, Parent Report Generator — Phase 4.
