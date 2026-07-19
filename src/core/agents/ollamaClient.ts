// Local Ollama backend for the Agent Gateway (Variant B: native
// structured-outputs path, behind the VITE_LLM_BACKEND=ollama flag). This is
// an OPTIONAL, dev-only alternative to anthropicClient for running the 5 agents
// against a local model while the hosted provider is unavailable — the
// Anthropic path stays the default and is untouched.
//
// It implements the SAME narrow AgentClient DI seam callAgent.ts already
// depends on (`messages.create(params, options) -> { content }`), so callAgent
// needs zero backend-specific branching. The mapping is:
//
//   Anthropic strict tool-use  ->  Ollama structured outputs
//   params.tools[0].input_schema (JSON Schema from z.toJSONSchema)  ->  `format`
//   the returned tool_use.input  <-  the JSON parsed from message.content
//
// Ollama constrains decoding to the schema (far more reliable on a small local
// model than free-form tool calling), and `think: false` suppresses Qwen3's
// <think> blocks that would otherwise pollute the JSON. Any error (network,
// non-2xx, empty/invalid JSON) throws, so callAgent's existing
// retry-once-then-deterministic-fallback path handles it exactly as it does an
// Anthropic failure — the lesson never breaks.
import type { AgentClient, AgentResponse } from "./callAgent";

export interface OllamaClientConfig {
  baseUrl: string;
  model: string;
  // Injectable for tests; defaults to the global fetch at call time.
  fetchImpl?: typeof fetch;
}

interface OllamaChatMessage {
  role: string;
  content: string;
}

interface OllamaCreateParams {
  system?: string;
  messages?: OllamaChatMessage[];
  tools?: Array<{ name: string; input_schema?: unknown }>;
  temperature?: number;
}

interface OllamaCreateOptions {
  timeout?: number;
}

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

// Backend-specific glue: nudge the model to emit only the JSON object. The
// `format` schema already constrains decoding, but restating it in the prompt
// measurably improves adherence on small models (Ollama's own guidance).
const JSON_ONLY_INSTRUCTION =
  "Respond ONLY with a single JSON object matching the required schema. " +
  "Do not add any text, explanation, or markdown before or after the JSON.";

export function createOllamaClient(config: OllamaClientConfig): AgentClient {
  const chatUrl = `${config.baseUrl.replace(/\/$/, "")}/api/chat`;

  const create = async (
    params: OllamaCreateParams,
    options?: OllamaCreateOptions,
  ): Promise<AgentResponse> => {
    const fetchImpl = config.fetchImpl ?? globalThis.fetch;
    const tool = params.tools?.[0];
    if (!tool || tool.input_schema === undefined) {
      throw new Error("ollamaClient: missing tools[0].input_schema (nothing to constrain output to)");
    }

    const systemContent = [params.system, JSON_ONLY_INSTRUCTION]
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .join("\n\n");

    const messages: OllamaChatMessage[] = [
      { role: "system", content: systemContent },
      ...(params.messages ?? []),
    ];

    // Honor callAgent's per-attempt timeout via AbortController (the Ollama
    // HTTP API has no timeout option of its own).
    const controller = new AbortController();
    const timeoutId =
      options?.timeout != null
        ? setTimeout(() => controller.abort(), options.timeout)
        : undefined;

    let res: Response;
    try {
      res = await fetchImpl(chatUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          messages,
          // Structured outputs: constrain the response to the agent's schema.
          format: tool.input_schema,
          stream: false,
          think: false, // suppress Qwen3 <think> reasoning in the output
          // Deterministic by default (0); callers that want variety (Theory
          // Tutor's repeated re-explanations) pass a higher temperature.
          options: { temperature: params.temperature ?? 0 },
        }),
        signal: controller.signal,
      });
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }

    if (!res.ok) {
      throw new Error(`ollamaClient: HTTP ${res.status} from ${chatUrl}`);
    }

    const data = (await res.json()) as OllamaChatResponse;
    if (data.error) {
      throw new Error(`ollamaClient: Ollama error: ${data.error}`);
    }

    const content = data.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("ollamaClient: empty message content");
    }

    // The core still safeParses this input via Zod downstream — we only parse
    // it into an object here and shape it like an Anthropic tool_use block so
    // callAgent's existing extraction (filter type==="tool_use", read .input)
    // works unchanged. JSON.parse throwing on malformed output correctly
    // routes to callAgent's fallback.
    const input: unknown = JSON.parse(content);

    return {
      content: [{ type: "tool_use", name: tool.name, input }],
    };
  };

  return { messages: { create } };
}

// Default instance wired from env (dev-only; only consumed when
// VITE_LLM_BACKEND=ollama — see agentClient.ts).
export const ollamaClient = createOllamaClient({
  baseUrl: import.meta.env.VITE_OLLAMA_BASE_URL ?? "http://localhost:11434",
  model: import.meta.env.VITE_OLLAMA_MODEL ?? "qwen3.5:4b",
});
