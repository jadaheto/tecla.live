import { jsonError, jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { listSpotifyDevices, SpotifyError, spotifyConfigured } from "@/lib/integrations/spotify";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const claims = await getActiveSessionClaims();
  if (!claims) {
    return jsonError("AUTH_REQUIRED", "Inicia sesión para ver tus dispositivos de Spotify.", 401, false);
  }
  if (!spotifyConfigured()) {
    return jsonError("SPOTIFY_NOT_CONFIGURED", "Spotify no está configurado.", 503, false);
  }
  const limit = consumeRateLimit(`spotify-devices:${claims.userId}`, 30, 60_000);
  if (!limit.ok) {
    return jsonError("RATE_LIMITED", "Demasiadas consultas de dispositivos.", 429, true);
  }
  try {
    const devices = await listSpotifyDevices(claims.userId);
    return jsonOk({ devices });
  } catch (error) {
    if (error instanceof SpotifyError) {
      return jsonError(error.code, error.message, error.status, error.status >= 500);
    }
    logger.warn("spotify.devices_failed", { error });
    return jsonError("SPOTIFY_DEVICES_UNAVAILABLE", "No pudimos listar los dispositivos.", 503, true);
  }
}
