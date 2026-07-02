// Agent Gateway tests (RELY-01, RELY-02, D-06, D-07). Uses a STUBBED client
// (constructor-injected, shaped like { messages: { create: vi.fn() } }) —
// never the real @anthropic-ai/sdk network path. Proves: validate -> retry
// exactly once -> fallback, for both transport errors and Zod-validation
// failures (D-06 treats both as retry-eligible), plus exact call-count
// assertions locking the "exactly one retry" semantics.
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as z from "zod";
import { callAgent, type AgentClient } from "../../../src/core/agents/callAgent";

const ResponseSchema = z.object({
  verdict: z.enum(["ok", "bad"]),
  note: z.string(),
});

function toolUseMessage(input: unknown) {
  return {
    content: [{ type: "tool_use", id: "toolu_1", name: "report_thing", input }],
  };
}

function fakeClient(create: ReturnType<typeof vi.fn>): AgentClient {
  return { messages: { create } };
}

describe("callAgent (RELY-01, RELY-02, D-06)", () => {
  const fallback = { verdict: "bad" as const, note: "fallback" };

  beforeEach(() => {
    localStorage.clear();
  });

  it("success first try -> returns { source: 'agent', failed: false, data } parsed from tool_use.input, calling create exactly once", async () => {
    const create = vi.fn().mockResolvedValueOnce(toolUseMessage({ verdict: "ok", note: "great" }));

    const result = await callAgent({
      schema: ResponseSchema,
      toolName: "report_thing",
      toolDescription: "Report a thing",
      systemPrompt: "system",
      userContent: "user",
      fallback,
      client: fakeClient(create),
    });

    expect(result).toEqual({ source: "agent", failed: false, data: { verdict: "ok", note: "great" } });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("malformed/non-tool_use response on attempt 1, valid on retry -> returns agent success (exactly one retry succeeded), calling create exactly twice", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ content: [{ type: "text", text: "oops, no tool_use" }] })
      .mockResolvedValueOnce(toolUseMessage({ verdict: "ok", note: "recovered" }));

    const result = await callAgent({
      schema: ResponseSchema,
      toolName: "report_thing",
      toolDescription: "Report a thing",
      systemPrompt: "system",
      userContent: "user",
      fallback,
      client: fakeClient(create),
    });

    expect(result).toEqual({
      source: "agent",
      failed: false,
      data: { verdict: "ok", note: "recovered" },
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("stubbed client throws a timeout-like error both attempts -> returns fallback (no throw escapes), calling create exactly twice", async () => {
    const timeoutError = new Error("Request timed out");
    const create = vi.fn().mockRejectedValueOnce(timeoutError).mockRejectedValueOnce(timeoutError);

    const result = await callAgent({
      schema: ResponseSchema,
      toolName: "report_thing",
      toolDescription: "Report a thing",
      systemPrompt: "system",
      userContent: "user",
      fallback,
      client: fakeClient(create),
    });

    expect(result).toEqual({ source: "core", failed: true, data: fallback });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("schema-valid JSON but wrong shape / wrong enum both attempts (Zod safeParse fails) -> returns fallback, calling create exactly twice", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(toolUseMessage({ verdict: "not-a-valid-enum-value", note: "x" }))
      .mockResolvedValueOnce(toolUseMessage({ verdict: "still-wrong", note: "y" }));

    const result = await callAgent({
      schema: ResponseSchema,
      toolName: "report_thing",
      toolDescription: "Report a thing",
      systemPrompt: "system",
      userContent: "user",
      fallback,
      client: fakeClient(create),
    });

    expect(result).toEqual({ source: "core", failed: true, data: fallback });
    expect(create).toHaveBeenCalledTimes(2);
  });
});
