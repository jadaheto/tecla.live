import { getClientIp, jsonError, jsonOk } from "@/lib/api-response";
import { CURATED_GROUP_LABELS, getCuratedVoices, getKittVoiceId } from "@/lib/ai/elevenlabs/curated-voices";
import { getElevenLabsVoiceName } from "@/lib/ai/elevenlabs/voices";
import { serverConfig } from "@/lib/env";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Voces públicas de TECLA AI: la predeterminada del servidor y las curadas
 * por ELEVENLABS_VOICES. No requiere sesión ni cuenta de ElevenLabs.
 */
export async function GET(request: Request) {
  if (!serverConfig.elevenLabsApiKey || !serverConfig.elevenLabsVoiceId) {
    return jsonError("ELEVENLABS_NOT_CONFIGURED", "La voz de TECLA AI no está configurada.", 503, false);
  }
  const limit = consumeRateLimit(`ai-voices-public:${getClientIp(request)}`, 20, 60_000);
  if (!limit.ok) {
    return jsonError("RATE_LIMITED", "Espera un momento antes de volver a consultar.", 429, true);
  }
  const curated = getCuratedVoices();
  const defaultVoiceName = await getElevenLabsVoiceName(serverConfig.elevenLabsVoiceId);
  return jsonOk({
    defaultVoiceId: serverConfig.elevenLabsVoiceId,
    defaultVoiceName,
    curated,
    kittVoiceId: getKittVoiceId(),
    groups: CURATED_GROUP_LABELS,
    source: process.env.ELEVENLABS_VOICES?.trim() ? "env" : "fallback",
  });
}
