import { jsonError, jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { getElevenLabsVoiceName, getElevenLabsVoices } from "@/lib/ai/elevenlabs/voices";
import { CURATED_GROUP_LABELS, getCuratedVoices } from "@/lib/ai/elevenlabs/curated-voices";
import { serverConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const claims = await getActiveSessionClaims();
  if (!claims) {
    return jsonError(
      "AUTH_REQUIRED",
      "Inicia sesión para consultar las voces autorizadas.",
      401,
      false,
    );
  }
  if (!serverConfig.elevenLabsApiKey) {
    return jsonError("ELEVENLABS_NOT_CONFIGURED", "ElevenLabs no está configurado.", 503, false);
  }

  const limit = consumeRateLimit(`ai-voices:user:${claims.userId}`, 10, 60_000);
  if (!limit.ok) {
    return jsonError("RATE_LIMITED", "Espera un momento antes de volver a consultar.", 429, true);
  }

  // La lista de la cuenta es opcional: si ElevenLabs falla, Ajustes sigue mostrando las voces curadas.
  let voices: Awaited<ReturnType<typeof getElevenLabsVoices>> = [];
  let accountVoicesError: string | null = null;
  try {
    voices = await getElevenLabsVoices();
  } catch (error) {
    accountVoicesError = error instanceof Error ? error.message : "ELEVENLABS_VOICES_FAILED";
    logger.warn("elevenlabs.voices_route_failed", { error: accountVoicesError });
  }
  const defaultVoiceName =
    voices.find((voice) => voice.id === serverConfig.elevenLabsVoiceId)?.name ??
    (await getElevenLabsVoiceName(serverConfig.elevenLabsVoiceId));
  return jsonOk({
    voices,
    accountVoicesError,
    defaultVoiceId: serverConfig.elevenLabsVoiceId || null,
    defaultVoiceName,
    curated: getCuratedVoices(),
    groups: CURATED_GROUP_LABELS,
  });
}
