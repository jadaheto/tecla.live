import { z } from "zod";
import { getClientIp, jsonError, jsonOk } from "@/lib/api-response";
import { getSessionClaims } from "@/lib/auth/session";
import { recordProviderUsage, usageSessionId } from "@/lib/ai/usage/ledger";
import { serverConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
]);

const DeepgramSchema = z.object({
  metadata: z
    .object({
      duration: z.number().optional().default(0),
    })
    .optional(),
  results: z.object({
    channels: z
      .array(
        z.object({
          alternatives: z
            .array(
              z.object({
                transcript: z.string(),
                confidence: z.number().optional().default(0),
              }),
            )
            .min(1),
        }),
      )
      .min(1),
  }),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const claims = await getSessionClaims();

  if (!serverConfig.deepgramApiKey) {
    return jsonError(
      "DEEPGRAM_NOT_CONFIGURED",
      "La voz todavía no está configurada. Puedes escribirle a TECLA AI.",
      503,
      false,
    );
  }

  const key = claims ? `user:${claims.userId}` : `ip:${ip}`;
  const limit = consumeRateLimit(
    `ai-stt:${key}`,
    claims ? serverConfig.limits.sttRateLimit : 8,
    60_000,
  );
  if (!limit.ok) {
    return jsonError(
      "RATE_LIMITED",
      "Demasiados intentos de voz. Espera un momento o escribe tu orden.",
      429,
      true,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_AUDIO_BYTES) {
    return jsonError("AUDIO_TOO_LARGE", "El audio es demasiado largo. Graba una orden más corta.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("INVALID_AUDIO", "No pudimos leer el audio.", 400);
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 20) {
    return jsonError("INVALID_AUDIO", "No recibimos audio para transcribir.", 400);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonError("AUDIO_TOO_LARGE", "El audio es demasiado largo. Graba una orden más corta.", 413);
  }

  const mimeType = (audio.type || "audio/webm").split(";")[0]?.trim() ?? "audio/webm";
  if (!ACCEPTED_TYPES.has(mimeType)) {
    return jsonError(
      "UNSUPPORTED_AUDIO",
      "Ese formato de audio no es compatible. Usa el micrófono del navegador.",
      415,
    );
  }

  const params = new URLSearchParams({
    model: serverConfig.deepgramModel,
    language: "es",
    smart_format: "true",
    punctuate: "true",
    filler_words: "false",
  });

  try {
    const response = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${serverConfig.deepgramApiKey}`,
        "Content-Type": mimeType,
        Accept: "application/json",
      },
      body: await audio.arrayBuffer(),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
      cache: "no-store",
    });

    if (!response.ok) {
      // Deepgram explica el rechazo en JSON (err_code/err_msg); se registra sin audio ni transcripción.
      let providerCode: string | null = null;
      let providerMessage: string | null = null;
      try {
        const detail = (await response.json()) as { err_code?: unknown; err_msg?: unknown; message?: unknown };
        providerCode = typeof detail.err_code === "string" ? detail.err_code.slice(0, 60) : null;
        const text = typeof detail.err_msg === "string" ? detail.err_msg : typeof detail.message === "string" ? detail.message : null;
        providerMessage = text ? text.slice(0, 160) : null;
      } catch {
        // cuerpo no JSON
      }
      logger.warn("ai.stt_provider_error", {
        status: response.status,
        providerCode,
        providerMessage,
        mimeType,
        bytes: audio.size,
      });
      if (response.status === 400) {
        return jsonError(
          "AUDIO_NOT_UNDERSTOOD",
          "No se entendió el audio grabado. Intenta de nuevo hablando un poco más cerca del micrófono.",
          422,
          true,
        );
      }
      if (response.status === 401 || response.status === 403) {
        return jsonError("DEEPGRAM_AUTH_ERROR", "La clave de Deepgram no es válida.", 503, false);
      }
      if (response.status === 429) {
        return jsonError(
          "DEEPGRAM_RATE_LIMITED",
          "El servicio de voz está ocupado. Intenta de nuevo o escribe tu orden.",
          429,
          true,
        );
      }
      return jsonError(
        "DEEPGRAM_UNAVAILABLE",
        "No pudimos transcribir el audio. Intenta de nuevo o escribe tu orden.",
        503,
        true,
      );
    }

    const parsed = DeepgramSchema.safeParse(await response.json());
    if (!parsed.success) {
      logger.warn("ai.stt_invalid_response");
      return jsonError(
        "DEEPGRAM_INVALID_RESPONSE",
        "No pudimos interpretar la transcripción. Intenta de nuevo o escribe.",
        502,
        true,
      );
    }

    const durationSeconds = parsed.data.metadata?.duration ?? 0;
    await recordProviderUsage({
      userId: claims?.userId ?? null,
      sessionId: usageSessionId({ ip, userId: claims?.userId }),
      provider: "deepgram",
      operation: "speech_to_text",
      inputUnits: durationSeconds,
      outputUnits: 0,
    });

    if (durationSeconds > serverConfig.limits.maxAudioSeconds + 3) {
      return jsonError(
        "AUDIO_TOO_LONG",
        `La orden supera el máximo de ${serverConfig.limits.maxAudioSeconds} segundos. Intenta con una frase más corta.`,
        413,
        false,
      );
    }

    const alternative = parsed.data.results.channels[0]?.alternatives[0];
    const transcript = (alternative?.transcript ?? "").trim().slice(0, 2000);

    logger.info("ai.stt_completed", {
      durationSeconds: Math.round(durationSeconds * 10) / 10,
      hasTranscript: transcript.length > 0,
    });

    return jsonOk({
      transcript,
      confidence: alternative?.confidence ?? 0,
      durationSeconds,
    });
  } catch (error) {
    logger.warn("ai.stt_failed", { error });
    return jsonError(
      "DEEPGRAM_UNAVAILABLE",
      "No pudimos transcribir el audio. Intenta de nuevo o escribe tu orden.",
      503,
      true,
    );
  }
}
