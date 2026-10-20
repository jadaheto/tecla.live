import { z } from "zod";
import { getClientIp, jsonError, jsonOk, readJson } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { DeepSeekError } from "@/lib/ai/deepseek/client";
import { AiBudgetExceededError, runAiChat } from "@/lib/ai/orchestration/chat";
import { usageSessionId } from "@/lib/ai/usage/ledger";
import { serverConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ToolCallSchema = z
  .object({
    id: z.string().max(80),
    type: z.literal("function"),
    function: z.object({
      name: z.string().max(60),
      arguments: z.string().max(4000),
    }),
  })
  .strict();

const ToolResultSchema = z
  .object({
    toolCallId: z.string().max(80),
    name: z.string().max(60),
    ok: z.boolean(),
    content: z.string().max(8000),
  })
  .strict();

const ContextSchema = z
  .object({
    pathname: z.string().max(200),
    screen: z.string().max(80),
    selectedTitle: z.string().max(160).optional(),
    selectedKind: z.string().max(40).optional(),
    player: z
      .object({
        kind: z.string().max(30).optional(),
        title: z.string().max(160).optional(),
        isPlaying: z.boolean().optional(),
        positionSeconds: z.number().min(0).max(86_400).optional(),
        durationSeconds: z.number().min(0).max(86_400).optional(),
      })
      .strict()
      .optional(),
    capabilities: z
      .object({
        microphone: z.boolean().optional(),
        fullscreen: z.boolean().optional(),
        webSpeech: z.boolean().optional(),
      })
      .strict()
      .optional(),
    memory: z
      .array(
        z
          .object({
            key: z.string().max(40),
            value: z.string().max(160),
          })
          .strict(),
      )
      .max(12)
      .optional(),
  })
  .strict();

const RequestSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().min(1).max(4000),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    context: ContextSchema,
    toolExchange: z
      .object({
        assistantContent: z.string().max(4000),
        assistantToolCalls: z.array(ToolCallSchema).max(8),
        toolResults: z.array(ToolResultSchema).max(8),
      })
      .strict()
      .optional(),
  })
  .strict();

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const claims = await getActiveSessionClaims();

  const minuteLimit = claims
    ? serverConfig.limits.chatRateLimit
    : serverConfig.limits.guestRateLimit;

  const minute = consumeRateLimit(
    `ai-chat:${claims ? `user:${claims.userId}` : `ip:${ip}`}`,
    minuteLimit,
    60_000,
  );
  if (!minute.ok) {
    return jsonError(
      "RATE_LIMITED",
      "Estás enviando órdenes muy rápido. Espera un momento.",
      429,
      true,
      { "Retry-After": String(minute.retryAfterSeconds) },
    );
  }

  if (!claims) {
    const hourly = consumeRateLimit(`ai-chat-hour:${ip}`, 80, 60 * 60_000);
    if (!hourly.ok) {
      return jsonError(
        "GUEST_LIMIT_REACHED",
        "Alcanzaste el límite de invitado para TECLA AI. Crea una cuenta o intenta más tarde.",
        429,
        true,
        { "Retry-After": String(hourly.retryAfterSeconds) },
      );
    }
  }

  if (!serverConfig.deepseekApiKey) {
    return jsonError(
      "DEEPSEEK_NOT_CONFIGURED",
      "TECLA AI todavía no está configurado. Añade DEEPSEEK_API_KEY en el servidor para activar la conversación.",
      503,
      false,
    );
  }

  const parsed = RequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(
      "INVALID_CHAT_REQUEST",
      parsed.error.issues[0]?.message ?? "La solicitud de TECLA AI no es válida.",
      400,
    );
  }

  const sessionId = usageSessionId({ ip, userId: claims?.userId });

  try {
    const result = await runAiChat({
      request: parsed.data,
      userId: claims?.userId ?? null,
      userName: null,
      sessionId,
    });

    logger.info("ai.chat_completed", {
      authenticated: Boolean(claims),
      pendingActions: result.pendingActions.length,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    });

    return jsonOk(result);
  } catch (error) {
    if (error instanceof AiBudgetExceededError) {
      return jsonError(
        "AI_BUDGET_EXCEEDED",
        "Se alcanzó el presupuesto mensual configurado para TECLA AI. Puedes seguir usando los controles manuales.",
        429,
        false,
      );
    }
    if (error instanceof DeepSeekError) {
      logger.warn("ai.chat_provider_error", { code: error.code, status: error.status });
      return jsonError(error.code, error.message, error.status, error.retryable);
    }
    logger.error("ai.chat_unexpected", { error });
    return jsonError(
      "AI_UNAVAILABLE",
      "TECLA AI no está disponible en este momento. El resto de TECLA LIVE sigue funcionando.",
      503,
      true,
    );
  }
}
