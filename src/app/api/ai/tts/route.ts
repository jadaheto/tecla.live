import { z } from "zod";
import { getClientIp, jsonError, readJson } from "@/lib/api-response";
import { getSessionClaims } from "@/lib/auth/session";
import { recordProviderUsage, usageSessionId } from "@/lib/ai/usage/ledger";
import { serverConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getElevenLabsVoices } from "@/lib/ai/elevenlabs/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z
  .object({
    text: z.string().trim().min(1).max(1000),
    voiceId: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{6,40}$/)
      .optional(),
  })
  .strict();

function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#>`~]/g, " ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, serverConfig.limits.maxTtsChars);
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const claims = await getSessionClaims();

  if (!serverConfig.elevenLabsApiKey || !serverConfig.elevenLabsVoiceId) {
    return jsonError(
      "ELEVENLABS_NOT_CONFIGURED",
      "La voz de TECLA AI no está configurada. Puedes leer la respuesta en pantalla.",
      503,
      false,
    );
  }

  const key = claims ? `user:${claims.userId}` : `ip:${ip}`;
  const limit = consumeRateLimit(
    `ai-tts:${key}`,
    claims ? serverConfig.limits.ttsRateLimit : 8,
    60_000,
  );
  if (!limit.ok) {
    return jsonError(
      "RATE_LIMITED",
      "Demasiadas respuestas de voz. Espera un momento.",
      429,
      true,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError("INVALID_TEXT", "El texto para la voz no es válido.", 400);
  }

  const text = cleanForSpeech(parsed.data.text);
  if (!text) {
    return jsonError("EMPTY_TEXT", "No hay texto para convertir en voz.", 400);
  }

  let voiceId = serverConfig.elevenLabsVoiceId;
  if (parsed.data.voiceId && parsed.data.voiceId !== serverConfig.elevenLabsVoiceId) {
    const voices = await getElevenLabsVoices().catch(() => []);
    const selected = voices.find((voice) => voice.id === parsed.data.voiceId);
    if (!selected) {
      return jsonError(
        "VOICE_NOT_ALLOWED",
        "Esa voz no está disponible en la cuenta configurada.",
        400,
        false,
      );
    }
    voiceId = selected.id;
  }

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        voiceId,
      )}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": serverConfig.elevenLabsApiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: serverConfig.elevenLabsModelId,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.15,
            use_speaker_boost: true,
          },
        }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]),
        cache: "no-store",
      },
    );

    if (!upstream.ok || !upstream.body) {
      logger.warn("ai.tts_provider_error", { status: upstream.status });
      if (upstream.status === 401 || upstream.status === 403) {
        return jsonError("ELEVENLABS_AUTH_ERROR", "La clave de ElevenLabs no es válida.", 503, false);
      }
      if (upstream.status === 429) {
        return jsonError(
          "ELEVENLABS_RATE_LIMITED",
          "La voz está ocupada. La respuesta sigue disponible en texto.",
          429,
          true,
        );
      }
      return jsonError(
        "ELEVENLABS_UNAVAILABLE",
        "No pudimos generar la voz. La respuesta sigue disponible en texto.",
        503,
        true,
      );
    }

    await recordProviderUsage({
      userId: claims?.userId ?? null,
      sessionId: usageSessionId({ ip, userId: claims?.userId }),
      provider: "elevenlabs",
      operation: "text_to_speech",
      inputUnits: text.length,
      outputUnits: 0,
    });

    logger.info("ai.tts_completed", { characters: text.length });
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logger.warn("ai.tts_failed", { error });
    return jsonError(
      "ELEVENLABS_UNAVAILABLE",
      "No pudimos generar la voz. Puedes leer la respuesta en pantalla.",
      503,
      true,
    );
  }
}
