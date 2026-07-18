import { describe, it, expect, vi } from "vitest";
import * as z from "zod";
import { createOllamaClient } from "../../../src/core/agents/ollamaClient";
import { callAgent } from "../../../src/core/agents/callAgent";

// Builds a fake fetch returning a given Ollama /api/chat payload, and records
// the request it was called with.
function fakeFetch(payload: unknown, ok = true, status = 200) {
  const calls: Array<{ url: string; body: any }> = [];
  const impl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    return {
      ok,
      status,
      json: async () => payload,
    } as unknown as Response;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const schema = z.object({
  isCorrect: z.boolean(),
  errorType: z.enum(["typo", "unknown"]),
  hintRu: z.string(),
});

const baseParams = {
  model: "claude-haiku-4-5",
  system: "You are the Answer Checker.",
  messages: [{ role: "user", content: "Judge: expected 'x', got 'y'." }],
  tools: [
    {
      name: "answer_checker",
      description: "check",
      strict: true,
      input_schema: z.toJSONSchema(schema),
    },
  ],
  tool_choice: { type: "tool", name: "answer_checker" },
};

describe("ollamaClient", () => {
  it("POSTs to /api/chat with the configured model, the schema as `format`, think:false, and maps the JSON reply to a tool_use block", async () => {
    const reply = { isCorrect: false, errorType: "typo", hintRu: "Опечатка." };
    const { impl, calls } = fakeFetch({ message: { content: JSON.stringify(reply) } });
    const client = createOllamaClient({
      baseUrl: "http://localhost:11434",
      model: "qwen3.5:4b",
      fetchImpl: impl,
    });

    const res = await client.messages.create(baseParams);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://localhost:11434/api/chat");
    expect(calls[0].body.model).toBe("qwen3.5:4b"); // env model, NOT params.model
    expect(calls[0].body.format).toEqual(baseParams.tools[0].input_schema);
    expect(calls[0].body.think).toBe(false);
    expect(calls[0].body.stream).toBe(false);
    // System prompt is preserved and the user message is forwarded.
    expect(calls[0].body.messages[0].role).toBe("system");
    expect(calls[0].body.messages[0].content).toContain("You are the Answer Checker.");
    expect(calls[0].body.messages).toContainEqual({
      role: "user",
      content: "Judge: expected 'x', got 'y'.",
    });

    expect(res.content).toHaveLength(1);
    expect(res.content[0].type).toBe("tool_use");
    expect(res.content[0].input).toEqual(reply);
  });

  it("throws on a non-2xx response", async () => {
    const { impl } = fakeFetch({}, false, 500);
    const client = createOllamaClient({ baseUrl: "http://x", model: "m", fetchImpl: impl });
    await expect(client.messages.create(baseParams)).rejects.toThrow(/HTTP 500/);
  });

  it("throws on empty content and on invalid JSON content", async () => {
    const empty = fakeFetch({ message: { content: "" } });
    const c1 = createOllamaClient({ baseUrl: "http://x", model: "m", fetchImpl: empty.impl });
    await expect(c1.messages.create(baseParams)).rejects.toThrow(/empty message content/);

    const bad = fakeFetch({ message: { content: "not json {" } });
    const c2 = createOllamaClient({ baseUrl: "http://x", model: "m", fetchImpl: bad.impl });
    await expect(c2.messages.create(baseParams)).rejects.toThrow();
  });

  it("throws when there is no tools[0].input_schema to constrain output", async () => {
    const { impl } = fakeFetch({ message: { content: "{}" } });
    const client = createOllamaClient({ baseUrl: "http://x", model: "m", fetchImpl: impl });
    await expect(
      client.messages.create({ ...baseParams, tools: [] }),
    ).rejects.toThrow(/input_schema/);
  });

  it("plugs into callAgent: a valid reply yields source:'agent', a failure falls back to core", async () => {
    const good = fakeFetch({
      message: { content: JSON.stringify({ isCorrect: true, errorType: "unknown", hintRu: "" }) },
    });
    const okClient = createOllamaClient({ baseUrl: "http://x", model: "m", fetchImpl: good.impl });
    const fallback = { isCorrect: false, errorType: "unknown" as const, hintRu: "fallback" };

    const okResult = await callAgent({
      schema,
      toolName: "answer_checker",
      toolDescription: "check",
      systemPrompt: "sys",
      userContent: "u",
      fallback,
      client: okClient,
    });
    expect(okResult.source).toBe("agent");
    expect(okResult.failed).toBe(false);

    const bad = fakeFetch({}, false, 503);
    const badClient = createOllamaClient({ baseUrl: "http://x", model: "m", fetchImpl: bad.impl });
    const fbResult = await callAgent({
      schema,
      toolName: "answer_checker",
      toolDescription: "check",
      systemPrompt: "sys",
      userContent: "u",
      fallback,
      client: badClient,
    });
    expect(fbResult.source).toBe("core");
    expect(fbResult.failed).toBe(true);
    expect(fbResult.data).toEqual(fallback);
  });
});
