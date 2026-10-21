"use client";

import type { AiChatResponse } from "@/features/ai/types";
import { ApiError } from "@/lib/http";

/**
 * Llama a /api/ai/chat en modo SSE. Entrega el texto parcial por `onDelta` y
 * resuelve con la respuesta completa (misma forma que el JSON no streaming).
 * Si el servidor no responde con SSE, cae al JSON normal.
 */
export async function streamAiChat(
  body: unknown,
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<AiChatResponse> {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const payload = (await response.json().catch(() => null)) as
      | (AiChatResponse & { error?: { code?: string; message?: string; retryable?: boolean } })
      | null;
    if (!response.ok || !payload) {
      throw new ApiError({
        status: response.status,
        code: payload?.error?.code ?? "AI_UNAVAILABLE",
        message: payload?.error?.message ?? "TECLA AI no respondió.",
        retryable: payload?.error?.retryable ?? response.status >= 500,
      });
    }
    return payload;
  }

  const reader = response.body?.getReader();
  if (!reader) throw new ApiError({ status: 502, code: "AI_UNAVAILABLE", message: "TECLA AI no entregó datos.", retryable: true });
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AiChatResponse | null = null;
  let failure: { code: string; message: string } | null = null;

  const handleEvent = (raw: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    let data: unknown;
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      return;
    }
    if (event === "delta" && data && typeof data === "object" && "text" in data) {
      const text = (data as { text?: unknown }).text;
      if (typeof text === "string" && text) onDelta(text);
    } else if (event === "done") {
      result = data as AiChatResponse;
    } else if (event === "error") {
      const payload = data as { code?: string; message?: string };
      failure = { code: payload.code ?? "AI_UNAVAILABLE", message: payload.message ?? "TECLA AI falló." };
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf("\n\n");
    while (separator >= 0) {
      handleEvent(buffer.slice(0, separator));
      buffer = buffer.slice(separator + 2);
      separator = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) handleEvent(buffer);

  if (failure) {
    const fail = failure as { code: string; message: string };
    throw new ApiError({ status: 503, code: fail.code, message: fail.message, retryable: true });
  }
  if (!result) throw new ApiError({ status: 502, code: "AI_UNAVAILABLE", message: "TECLA AI cerró la conexión sin responder.", retryable: true });
  return result;
}

/**
 * Corta un texto en frases completas. Devuelve las frases, cuántos
 * caracteres del texto original quedaron consumidos y el resto pendiente.
 */
export function splitSentences(text: string): { sentences: string[]; consumed: number; rest: string } {
  const sentences: string[] = [];
  const pattern = /([^.!?\n]+[.!?]+["»)]?|[^\n]+\n)/g;
  let consumed = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const sentence = match[0].trim();
    if (sentence.length >= 2) sentences.push(sentence);
    consumed = match.index + match[0].length;
  }
  return { sentences, consumed, rest: text.slice(consumed) };
}
