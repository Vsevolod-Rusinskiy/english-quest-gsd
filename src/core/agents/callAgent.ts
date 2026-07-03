// Agent Gateway: the single validated call path every agent uses (RELY-01,
// RELY-02, RELY-03, D-05, D-06, D-07). Validate -> retry-once -> fallback ->
// uniform result union. NEVER writes state directly; only proposes a value
// the core validates via Zod before returning source:"agent" — the caller
// (lessonEngine) decides what to do with the result, this module has zero
// knowledge of exercises, topics, or state writes.
import * as z from "zod";
import { anthropicClient } from "./anthropicClient";

// Minimal shape of the Anthropic client this gateway depends on — lets tests
// inject a plain stubbed object ({ messages: { create: vi.fn() } }) instead
// of the real SDK, so tests run offline with zero network/cost. `create` is
// typed loosely (any params in, a Promise of a tool_use-shaped response out)
// deliberately: this is a narrow DI seam, not a re-declaration of the full
// SDK surface, and must accept both vi.fn() mocks and the real SDK method.
export interface AgentContentBlock {
  type: string;
  input?: unknown;
  // Real SDK content blocks (and realistic test fixtures) carry additional
  // fields (id, name, text, ...) this gateway never reads — allow them
  // structurally rather than forcing every test fixture to an exact shape.
  [key: string]: unknown;
}

export interface AgentResponse {
  content: AgentContentBlock[];
}

export interface AgentClient {
  messages: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (params: any, options?: any) => Promise<AgentResponse>;
  };
}

export interface AgentCallResult<T> {
  data: T;
  source: "agent";
  failed: false;
}

export interface AgentFallbackResult<T> {
  data: T;
  source: "core";
  failed: true;
}

export interface CallAgentOptions<T> {
  schema: z.ZodType<T>;
  toolName: string;
  toolDescription: string;
  systemPrompt: string;
  userContent: string;
  fallback: T;
  // DI (RESEARCH.md Pattern 3/4) — defaults to the real anthropicClient;
  // tests inject a stub so no real network path is ever exercised.
  client?: AgentClient;
}

const MODEL = "claude-haiku-4-5"; // D-02
const TIMEOUT_MS = 8000; // D-07

export async function callAgent<T>(
  opts: CallAgentOptions<T>,
): Promise<AgentCallResult<T> | AgentFallbackResult<T>> {
  // Cast to the narrow AgentClient DI seam regardless of whether this is the
  // real anthropicClient or a test stub — callAgent only ever needs the
  // messages.create(params, options) -> {content} shape, never the SDK's
  // full typed surface (which is what causes overload-resolution mismatches
  // against a dynamically-built z.toJSONSchema() input_schema).
  const client: AgentClient = opts.client ?? (anthropicClient as unknown as AgentClient);

  const attempt = async (): Promise<T> => {
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 512, // narrow single-shot JSON output (RESEARCH.md A2) — well
        // above the largest of the 2 Phase 3 contracts (a few short fields +
        // one Russian hint sentence), sized for headroom without being
        // wastefully large for a short structured-output call.
        system: opts.systemPrompt,
        messages: [{ role: "user", content: opts.userContent }],
        tools: [
          {
            name: opts.toolName,
            description: opts.toolDescription,
            strict: true,
            input_schema: z.toJSONSchema(opts.schema as unknown as z.ZodObject<z.ZodRawShape>),
          },
        ],
        tool_choice: { type: "tool", name: opts.toolName },
      },
      { timeout: TIMEOUT_MS, maxRetries: 0 },
    );

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
    if (toolUseBlocks.length !== 1) {
      throw new Error(
        `Agent response contained ${toolUseBlocks.length} tool_use blocks, expected exactly 1`,
      );
    }
    const parsed = opts.schema.safeParse(toolUseBlocks[0].input);
    if (!parsed.success) {
      throw new Error(`Agent response failed schema validation: ${parsed.error.message}`);
    }
    return parsed.data;
  };

  try {
    const data = await attempt();
    return { data, source: "agent", failed: false };
  } catch (firstErr) {
    // D-06: exactly one immediate retry, no backoff — covers BOTH SDK/
    // transport errors AND Zod validation failures uniformly, since
    // attempt() throws for both cases the same way. Broad catch, no
    // `instanceof` narrowing (Pitfall 4) — a router-shape mismatch must
    // resolve to fallback, not escape as an uncaught exception.
    try {
      const data = await attempt();
      return { data, source: "agent", failed: false };
    } catch (secondErr) {
      // Logged (not swallowed silently) so a genuine code defect — as
      // opposed to a transient network blip — stays diagnosable in
      // production instead of looking identical to a normal fallback.
      console.error("Agent Gateway: both attempts failed", firstErr, secondErr);
      return { data: opts.fallback, source: "core", failed: true };
    }
  }
}
