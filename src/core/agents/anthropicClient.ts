// Single Anthropic client instance against the third-party LLM router (D-01,
// D-03, D-07). This is the ONLY place the Anthropic client is constructed —
// callAgent.ts consumes this as its default injected client.
//
// dangerouslyAllowBrowser: true is D-03's explicit, scoped, documented
// tradeoff: the router API key is bundled into the built JS at compile time
// via Vite's import.meta.env.VITE_* mechanism. This is accepted ONLY for
// local `npm run dev` use and in-person diploma defense demos — `dist/` must
// NOT be deployed to a public URL without first swapping to a proxy
// (Cloudflare Workers or equivalent). See 03-CONTEXT.md D-03, STATE.md
// Blockers. This is a deliberate boundary, not an oversight.
//
// maxRetries: 0 hands retry policy entirely to callAgent() (D-06: exactly one
// immediate retry, no backoff) — the SDK's own default retry/backoff behavior
// would otherwise silently multiply the number of attempts.
import Anthropic from "@anthropic-ai/sdk";

export const anthropicClient = new Anthropic({
  apiKey: import.meta.env.VITE_LLM_API_KEY,
  baseURL: import.meta.env.VITE_LLM_BASE_URL,
  dangerouslyAllowBrowser: true,
  maxRetries: 0,
});
