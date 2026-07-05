# english-quest-gsd

English Quest — interactive grammar learning app built with Vite, TypeScript, and Vitest.

## LLM proxy

Browser LLM calls go through a Cloudflare Worker key-proxy (`worker/`), not
directly to the third-party router. This keeps the real API key out of the
shipped JS bundle and fixes a CORS preflight rejection the router returns for
direct browser requests.

**Local dev (two processes):**

1. Copy `worker/.dev.vars.example` to `worker/.dev.vars` and fill in the real
   router key (`LLM_API_KEY=...`). This file is gitignored.
2. In `worker/`, run `npm install` then `npm run dev` (`wrangler dev`). Note
   the printed local URL (default `http://127.0.0.1:8787`).
3. In the project root `.env`, set `VITE_LLM_BASE_URL` to that URL (see
   `.env.example`). `VITE_LLM_API_KEY` is no longer required in the browser.
4. Run `npm run dev` as usual — the app now talks to the local Worker, which
   forwards to the router with the real key injected server-side.

**Production:**

1. From `worker/`, run `wrangler login`, then `wrangler secret put LLM_API_KEY`
   to store the real key as a Cloudflare secret (never in git).
2. Run `wrangler deploy` to publish the Worker; note the `*.workers.dev` URL.
3. Set `VITE_LLM_BASE_URL` to that deployed URL and rebuild the app.

The API key is no longer present in the browser bundle, and this proxy is
what makes it safe to deploy `dist/` publicly.
