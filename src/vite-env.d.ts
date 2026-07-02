/// <reference types="vite/client" />

// Typed import.meta.env for the LLM router credentials (Phase 3, D-01/D-03).
// The user's .env already defines these two VITE_-prefixed keys — Vite only
// exposes VITE_-prefixed variables to client code; do not rename or add new
// keys here without updating .env to match.
interface ImportMetaEnv {
  readonly VITE_LLM_BASE_URL: string;
  readonly VITE_LLM_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
