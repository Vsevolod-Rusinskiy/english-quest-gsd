// Single Anthropic client instance against the Cloudflare Worker key-proxy
// (D-01, D-07; proxy added in quick-260705-rl5). This is the ONLY place the
// Anthropic client is constructed — callAgent.ts consumes this as its default
// injected client.
//
// The real api.llmrouter.ru API key no longer lives in the browser bundle.
// VITE_LLM_BASE_URL now points at the Worker (dev: local `wrangler dev`,
// e.g. http://127.0.0.1:8787; prod: the deployed *.workers.dev URL) — the SDK
// posts to `${baseURL}/v1/messages`, which the Worker serves as a reverse
// proxy, injecting the real key server-side only (see worker/src/index.ts).
// The Worker also answers the CORS preflight the router itself rejected with
// 401 (STATE.md Blockers, diagnosed 2026-07-04) — server-to-server forwarding
// sidesteps CORS entirely, resolving that blocker structurally.
//
// apiKey is now just a harmless placeholder: the SDK constructor requires a
// non-empty string, but whatever the browser sends here is never forwarded
// upstream (the Worker ignores any client-supplied auth header and injects
// its own secret). VITE_LLM_API_KEY is no longer required and, in the
// recommended setup, is absent from .env entirely — closing 03-CONTEXT.md
// D-03's client-bundled-key exposure.
//
// dangerouslyAllowBrowser: true is still required because this is still a
// browser-constructed client (it just no longer talks to the real upstream
// directly).
//
// maxRetries: 0 hands retry policy entirely to callAgent() (D-06: exactly one
// immediate retry, no backoff) — the SDK's own default retry/backoff behavior
// would otherwise silently multiply the number of attempts.
import Anthropic from "@anthropic-ai/sdk";

export const anthropicClient = new Anthropic({
  apiKey: import.meta.env.VITE_LLM_API_KEY ?? "proxied-via-worker",
  baseURL: import.meta.env.VITE_LLM_BASE_URL,
  dangerouslyAllowBrowser: true,
  maxRetries: 0,
});
