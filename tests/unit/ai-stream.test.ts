import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { splitSentences } from "@/features/ai/stream-client";
import { buildGreeting } from "@/features/ai/greeting";

function sseBody(chunks: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

describe("DeepSeek streaming", () => {
  beforeAll(() => {
    process.env.DEEPSEEK_API_KEY ||= "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("delivers text deltas and rebuilds tool calls from the SSE stream", async () => {
    const { createDeepSeekCompletion } = await import("@/lib/ai/deepseek/client");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          sseBody([
            { choices: [{ delta: { content: "Hecho, " } }] },
            { choices: [{ delta: { content: "señor." } }] },
            {
              choices: [
                {
                  delta: {
                    tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "search_", arguments: '{"que' } }],
                  },
                },
              ],
            },
            { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "youtube", arguments: 'ry":"x"}' } }] }, finish_reason: "tool_calls" }] },
            { choices: [], usage: { prompt_tokens: 12, completion_tokens: 7 } },
          ]),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
      ),
    );
    const deltas: string[] = [];
    const result = await createDeepSeekCompletion({
      messages: [{ role: "user", content: "hola" }],
      tools: [],
      maxOutputTokens: 100,
      onTextDelta: (text) => deltas.push(text),
    });
    expect(deltas).toEqual(["Hecho, ", "señor."]);
    expect(result.message.content).toBe("Hecho, señor.");
    expect(result.message.toolCalls).toEqual([
      { id: "call_1", type: "function", function: { name: "search_youtube", arguments: '{"query":"x"}' } },
    ]);
    expect(result.finishReason).toBe("tool_calls");
    expect(result.usage).toEqual({ promptTokens: 12, completionTokens: 7 });
    const call = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const init = call?.[1] as { body: string };
    expect(JSON.parse(init.body)).toMatchObject({ stream: true, stream_options: { include_usage: true } });
  });
});

describe("sentence splitting for voice", () => {
  it("returns complete sentences and keeps the unfinished tail", () => {
    const first = splitSentences("Hecho, señor. Reproduciendo «La Diabla» de Romeo Santos. ¿Algo");
    expect(first.sentences).toEqual(["Hecho, señor.", "Reproduciendo «La Diabla» de Romeo Santos."]);
    expect(first.rest).toBe(" ¿Algo");
    const second = splitSentences(first.rest + " más?");
    expect(second.sentences).toEqual(["¿Algo más?"]);
    expect(second.rest).toBe("");
    expect(splitSentences("sin puntuación todavía").sentences).toEqual([]);
  });
});

describe("startup greeting", () => {
  it("builds a local greeting with hour, weather and pending video", () => {
    const text = buildGreeting({
      hour: 20,
      persona: "jarvis",
      weather: { temperature: 25.4, label: "Nublado", location: "Sincelejo, Sucre, Colombia" },
      pendingTitle: "Romeo Santos - La Diabla (Letra)",
    });
    expect(text).toContain("Buenas noches, señor. Sistemas en línea.");
    expect(text).toContain("25 grados y nublado en Sincelejo.");
    expect(text).toContain("Dejó a medias «Romeo Santos - La Diabla (Letra)»");
    expect(buildGreeting({ hour: 9, persona: "copiloto", weather: null, pendingTitle: null })).toBe(
      "Buenos días. ¿Qué quieres escuchar?",
    );
  });
});
