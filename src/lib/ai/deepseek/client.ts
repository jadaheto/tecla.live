import { z } from "zod";
import { serverConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { DeepSeekMessage, DeepSeekToolCall } from "@/features/ai/types";

const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const CompletionSchema = z.object({
  id: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z.array(ToolCallSchema).optional(),
        }),
        finish_reason: z.string().optional(),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional().default(0),
      completion_tokens: z.number().optional().default(0),
    })
    .optional(),
});

export class DeepSeekError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, status = 502, retryable = true) {
    super(message);
    this.name = "DeepSeekError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export interface DeepSeekToolDefinition {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface DeepSeekCompletion {
  message: {
    content: string;
    toolCalls: DeepSeekToolCall[];
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
  finishReason: string;
}

function endpoint(): string {
  const base = serverConfig.deepseekBaseUrl.replace(/\/+$/, "");
  return `${base}/chat/completions`;
}

function mapHttpError(status: number): DeepSeekError {
  if (status === 401 || status === 403) {
    return new DeepSeekError(
      "DEEPSEEK_AUTH_ERROR",
      "La clave de DeepSeek no es válida o no tiene permisos.",
      502,
      false,
    );
  }
  if (status === 402) {
    return new DeepSeekError(
      "DEEPSEEK_BALANCE",
      "DeepSeek no tiene saldo disponible. TECLA AI puede seguir en modo texto manual.",
      503,
      false,
    );
  }
  if (status === 429) {
    return new DeepSeekError(
      "DEEPSEEK_RATE_LIMITED",
      "DeepSeek está recibiendo demasiadas solicitudes. Intenta de nuevo en unos segundos.",
      429,
      true,
    );
  }
  if (status === 400) {
    return new DeepSeekError(
      "DEEPSEEK_BAD_REQUEST",
      "La solicitud a DeepSeek no es válida.",
      500,
      false,
    );
  }
  return new DeepSeekError(
    "DEEPSEEK_UNAVAILABLE",
    "El cerebro de TECLA AI no está disponible en este momento.",
    503,
    true,
  );
}

export async function createDeepSeekCompletion(input: {
  messages: DeepSeekMessage[];
  tools: DeepSeekToolDefinition[];
  maxOutputTokens: number;
}): Promise<DeepSeekCompletion> {
  if (!serverConfig.deepseekApiKey) {
    throw new DeepSeekError(
      "DEEPSEEK_NOT_CONFIGURED",
      "DeepSeek aún no está configurado. Añade DEEPSEEK_API_KEY para activar la conversación.",
      503,
      false,
    );
  }

  const body = {
    model: serverConfig.deepseekModel,
    messages: input.messages,
    tools: input.tools.length > 0 ? input.tools : undefined,
    tool_choice: input.tools.length > 0 ? "auto" : undefined,
    temperature: 0.35,
    max_tokens: input.maxOutputTokens,
    stream: false,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(endpoint(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serverConfig.deepseekApiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(35_000),
        cache: "no-store",
      });

      if (!response.ok) {
        const error = mapHttpError(response.status);
        if (response.status >= 500 && attempt === 0) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 400));
          continue;
        }
        throw error;
      }

      const parsed = CompletionSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new DeepSeekError(
          "DEEPSEEK_INVALID_RESPONSE",
          "DeepSeek devolvió una respuesta inesperada.",
          502,
          true,
        );
      }

      const choice = parsed.data.choices[0];
      if (!choice) {
        throw new DeepSeekError(
          "DEEPSEEK_EMPTY_RESPONSE",
          "DeepSeek no devolvió una respuesta.",
          502,
          true,
        );
      }

      return {
        message: {
          content: choice.message.content?.trim() ?? "",
          toolCalls: choice.message.tool_calls ?? [],
        },
        usage: {
          promptTokens: parsed.data.usage?.prompt_tokens ?? 0,
          completionTokens: parsed.data.usage?.completion_tokens ?? 0,
        },
        finishReason: choice.finish_reason ?? "stop",
      };
    } catch (error) {
      if (error instanceof DeepSeekError) throw error;
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }
    }
  }

  logger.warn("deepseek.request_failed", { error: lastError });
  throw new DeepSeekError(
    "DEEPSEEK_UNREACHABLE",
    "No pudimos conectar con DeepSeek. Intenta de nuevo en un momento.",
    503,
    true,
  );
}
