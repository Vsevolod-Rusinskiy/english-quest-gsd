/// <reference types="vite/client" />

// Typed import.meta.env for the LLM proxy config (Phase 3 D-01/D-03; updated
// quick-260705-rl5). VITE_LLM_BASE_URL now points at the Cloudflare Worker
// key-proxy, not api.llmrouter.ru directly. Vite only exposes VITE_-prefixed
// variables to client code; do not rename or add new keys here without
// updating .env to match.
interface ImportMetaEnv {
  readonly VITE_LLM_BASE_URL: string;
  // No longer required in the browser now that the Worker holds the real
  // router key server-side (see worker/src/index.ts). Retained as an
  // optional placeholder only for the SDK constructor's non-empty apiKey
  // requirement.
  readonly VITE_LLM_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
