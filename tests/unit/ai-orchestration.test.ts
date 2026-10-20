import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  completion: vi.fn(),
  serverTool: vi.fn(),
  budget: vi.fn(),
  usage: vi.fn(),
}));

vi.mock("@/lib/ai/deepseek/client", () => ({
  createDeepSeekCompletion: mocks.completion,
  DeepSeekError: class DeepSeekError extends Error {},
}));

vi.mock("@/lib/ai/tools/execute-server-tool", () => ({
  executeServerTool: mocks.serverTool,
}));

vi.mock("@/lib/ai/usage/ledger", () => ({
  checkAiBudget: mocks.budget,
  recordProviderUsage: mocks.usage,
}));

import { AiBudgetExceededError, runAiChat } from "@/lib/ai/orchestration/chat";

const request = {
  messages: [{ role: "user" as const, content: "Busca un video y reprodúcelo." }],
  context: { pathname: "/", screen: "Inicio" },
};

function completion(input: {
  content?: string;
  toolCalls?: Array<{ id: string; name: string; args: string }>;
}) {
  return {
    message: {
      content: input.content ?? "",
      toolCalls: (input.toolCalls ?? []).map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.args },
      })),
    },
    usage: { promptTokens: 100, completionTokens: 20 },
    finishReason: "tool_calls",
  };
}

beforeEach(() => {
  mocks.completion.mockReset();
  mocks.serverTool.mockReset();
  mocks.usage.mockReset().mockResolvedValue(0);
  mocks.budget.mockReset().mockResolvedValue({ allowed: true, spendUsd: 0, budgetUsd: 10 });
  mocks.serverTool.mockResolvedValue({
    ok: true,
    content: JSON.stringify({ results: [{ videoId: "dQw4w9WgXcQ" }] }),
  });
});

describe("TECLA AI orchestration", () => {
  it("returns a direct answer without tool calls", async () => {
    mocks.completion.mockResolvedValueOnce(completion({ content: "Hola, soy TECLA AI." }));
    const result = await runAiChat({
      request,
      userId: null,
      sessionId: "guest:test",
    });
    expect(result.content).toBe("Hola, soy TECLA AI.");
    expect(result.pendingActions).toHaveLength(0);
    expect(mocks.usage).toHaveBeenCalledOnce();
  });

  it("executes server tools and defers client actions", async () => {
    mocks.completion.mockResolvedValueOnce(
      completion({
        toolCalls: [
          {
            id: "call_search",
            name: "search_youtube",
            args: JSON.stringify({ query: "tecnología", limit: 3 }),
          },
          {
            id: "call_play",
            name: "play_youtube",
            args: JSON.stringify({ videoId: "dQw4w9WgXcQ", title: "Video" }),
          },
        ],
      }),
    );

    const result = await runAiChat({
      request,
      userId: null,
      sessionId: "guest:test",
    });

    expect(mocks.serverTool).toHaveBeenCalledOnce();
    expect(mocks.serverTool.mock.calls[0]?.[0]).toBe("search_youtube");
    expect(result.pendingActions).toHaveLength(1);
    expect(result.pendingActions[0]).toMatchObject({
      toolCallId: "call_play",
      name: "play_youtube",
    });
    expect(result.toolExchange?.assistantToolCalls).toHaveLength(2);
    expect(result.toolExchange?.toolResults).toHaveLength(1);
    expect(result.toolExchange?.toolResults[0]?.toolCallId).toBe("call_search");
  });

  it("passes invalid tool arguments back to the model without executing them", async () => {
    mocks.completion
      .mockResolvedValueOnce(
        completion({
          toolCalls: [
            {
              id: "bad",
              name: "play_youtube",
              args: JSON.stringify({ videoId: "../etc/passwd" }),
            },
          ],
        }),
      )
      .mockResolvedValueOnce(completion({ content: "Ese identificador no es válido." }));

    const result = await runAiChat({
      request,
      userId: null,
      sessionId: "guest:test",
    });

    expect(result.content).toContain("identificador");
    expect(mocks.serverTool).not.toHaveBeenCalled();
    const secondMessages = mocks.completion.mock.calls[1]?.[0]?.messages ?? [];
    const toolMessage = secondMessages.find(
      (message: { role: string }) => message.role === "tool",
    );
    expect(toolMessage?.content).toContain("INVALID_ARGUMENTS");
  });

  it("stops at the configured tool step limit", async () => {
    mocks.completion.mockResolvedValue(
      completion({
        toolCalls: [
          {
            id: "call",
            name: "search_youtube",
            args: JSON.stringify({ query: "algo" }),
          },
        ],
      }),
    );

    const result = await runAiChat({
      request,
      userId: null,
      sessionId: "guest:test",
    });
    expect(result.stepLimited).toBe(true);
    expect(result.pendingActions).toHaveLength(0);
    expect(mocks.completion).toHaveBeenCalledTimes(4);
  });

  it("refuses to call the model when the budget is exhausted", async () => {
    mocks.budget.mockResolvedValue({ allowed: false, spendUsd: 10, budgetUsd: 10 });
    await expect(
      runAiChat({ request, userId: null, sessionId: "guest:test" }),
    ).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(mocks.completion).not.toHaveBeenCalled();
  });

  it("passes consent-based memory into the system prompt", async () => {
    mocks.completion.mockResolvedValueOnce(completion({ content: "Listo." }));
    await runAiChat({
      request: {
        ...request,
        context: {
          ...request.context,
          memory: [{ key: "musica", value: "vallenato" }],
        },
      },
      userId: null,
      sessionId: "guest:test",
    });
    const messages = mocks.completion.mock.calls[0]?.[0]?.messages ?? [];
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("vallenato");
    expect(messages[0]?.content).toContain("memoria");
  });
});
