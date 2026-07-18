// Backend selector for the Agent Gateway's default client. Anthropic (via the
// Cloudflare Worker key-proxy) stays the default; setting VITE_LLM_BACKEND=ollama
// swaps in the local Ollama structured-outputs client instead (Variant B,
// dev-only). callAgent.ts consumes `defaultAgentClient` and never needs to know
// which backend is active — both satisfy the same AgentClient DI seam, and both
// are covered by the identical validate -> retry -> deterministic-fallback path.
import type { AgentClient } from "./callAgent";
import { anthropicClient } from "./anthropicClient";
import { ollamaClient } from "./ollamaClient";

export const defaultAgentClient: AgentClient =
  import.meta.env.VITE_LLM_BACKEND === "ollama"
    ? ollamaClient
    : (anthropicClient as unknown as AgentClient);
