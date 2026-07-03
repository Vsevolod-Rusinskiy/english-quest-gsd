// Agent Gateway tests (RELY-01, RELY-02, D-06, D-07). Uses a STUBBED client
// (constructor-injected, shaped like { messages: { create: vi.fn() } }) —
// never the real @anthropic-ai/sdk network path. Proves: validate -> retry
// exactly once -> fallback, for both transport errors and Zod-validation
// failures (D-06 treats both as retry-eligible), plus exact call-count
// assertions locking the "exactly one retry" semantics.
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as z from "zod";
import { callAgent, type AgentClient, type AgentResponse } from "../../../src/core/agents/callAgent";

const ResponseSchema = z.object({
  verdict: z.enum(["ok", "bad"]),
  note: z.string(),
});

function toolUseMessage(input: unknown): AgentResponse {
  return {
    content: [{ type: "tool_use", id: "toolu_1", name: "report_thing", input }],
  };
}

type CreateMock = ReturnType<typeof createMock>;
function createMock() {
  return vi.fn<(params: unknown, options?: unknown) => Promise<AgentResponse>>();
}

function fakeClient(create: CreateMock): AgentClient {
  return { messages: { create } };
}

describe("callAgent (RELY-01, RELY-02, D-06)", () => {
  const fallback = { verdict: "bad" as const, note: "fallback" };

  beforeEach(() => {
    localStorage.clear();
  });

  it("success first try -> returns { source: 'agent', failed: false, data } parsed from tool_use.input, calling create exactly once", async () => {
    const create = createMock().mockResolvedValueOnce(toolUseMessage({ verdict: "ok", note: "great" }));

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
    const create = createMock()
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
    const create = createMock().mockRejectedValueOnce(timeoutError).mockRejectedValueOnce(timeoutError);

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
    const create = createMock()
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

  it("response contains two tool_use blocks (ambiguous/spoofed) both attempts -> rejected, returns fallback rather than trusting the first block (CR-01)", async () => {
    const twoBlocks: AgentResponse = {
      content: [
        { type: "tool_use", id: "toolu_1", name: "report_thing", input: { verdict: "ok", note: "legit" } },
        { type: "tool_use", id: "toolu_2", name: "report_thing", input: { verdict: "bad", note: "injected" } },
      ],
    };
    const create = createMock().mockResolvedValueOnce(twoBlocks).mockResolvedValueOnce(twoBlocks);

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

  it("both attempts fail -> logs both errors via console.error before returning fallback, so a real bug stays diagnosable (CR-03)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const create = createMock()
      .mockRejectedValueOnce(new Error("boom 1"))
      .mockRejectedValueOnce(new Error("boom 2"));

    await callAgent({
      schema: ResponseSchema,
      toolName: "report_thing",
      toolDescription: "Report a thing",
      systemPrompt: "system",
      userContent: "user",
      fallback,
      client: fakeClient(create),
    });

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
  });
});
