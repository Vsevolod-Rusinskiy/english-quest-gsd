// Cloudflare Worker key-proxy for the English Quest LLM router (quick-260705-rl5).
//
// Purpose (see 260705-rl5-PLAN.md, STATE.md Blockers, 03-CONTEXT.md D-03):
// 1. Hold the real api.llmrouter.ru API key server-side only (env.LLM_API_KEY,
//    a Worker secret / .dev.vars value) so it is never bundled into the
//    browser's shipped JS.
// 2. Answer the CORS preflight (OPTIONS) the router itself rejects with 401 —
//    a CORS-compliant server must answer OPTIONS without requiring auth. This
//    is the structural fix for the diagnosed CORS-preflight-401 blocker.
//
// This is a THIN reverse proxy only: no auth system, no rate limiting, no
// logging infra, no app logic (T-rl5-03, accepted risk for this diploma-MVP
// scope). It forwards POST /v1/messages verbatim to the upstream router,
// injecting the real key, and returns the upstream response untouched.

export interface Env {
  LLM_API_KEY: string;
  LLM_UPSTREAM_URL?: string;
}

const DEFAULT_UPSTREAM_URL = "https://api.llmrouter.ru";

// Headers the @anthropic-ai/sdk browser client sends that the CORS preflight
// must allow, plus content-type for the POST body itself.
const ALLOWED_REQUEST_HEADERS =
  "content-type, x-api-key, authorization, anthropic-version, anthropic-beta, anthropic-dangerous-direct-browser-access, x-stainless-arch, x-stainless-lang, x-stainless-os, x-stainless-package-version, x-stainless-retry-count, x-stainless-runtime, x-stainless-runtime-version, x-stainless-timeout";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": ALLOWED_REQUEST_HEADERS,
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. CORS preflight — answer it ourselves, without any auth check. This
    // is the exact fix for the router's "OPTIONS -> 401" behavior.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // 2. Forward POST .../v1/messages to the upstream router, server-to-server.
    if (request.method === "POST" && url.pathname.endsWith("/v1/messages")) {
      const upstreamBase = env.LLM_UPSTREAM_URL || DEFAULT_UPSTREAM_URL;
      const upstreamUrl = `${upstreamBase.replace(/\/$/, "")}/v1/messages`;

      const anthropicVersion =
        request.headers.get("anthropic-version") ?? "2023-06-01";
      const contentType =
        request.headers.get("content-type") ?? "application/json";

      const body = await request.text();

      const upstreamResponse = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "content-type": contentType,
          "anthropic-version": anthropicVersion,
          // The Worker is the sole key holder — inject the real key here.
          // Never forward any client-supplied auth header (T-rl5-04).
          "x-api-key": env.LLM_API_KEY,
          authorization: `Bearer ${env.LLM_API_KEY}`,
        },
        body,
      });

      const responseBody = await upstreamResponse.arrayBuffer();
      const responseHeaders = new Headers(corsHeaders());
      const upstreamContentType = upstreamResponse.headers.get("content-type");
      if (upstreamContentType) {
        responseHeaders.set("content-type", upstreamContentType);
      }

      return new Response(responseBody, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    // 3. Anything else is out of scope for this thin passthrough.
    return new Response("Not found", { status: 404 });
  },
};
