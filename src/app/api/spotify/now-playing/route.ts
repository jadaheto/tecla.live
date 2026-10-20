import { jsonError, jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { getSpotifyNowPlaying, SpotifyError, spotifyConfigured } from "@/lib/integrations/spotify";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const claims = await getActiveSessionClaims();
  if (!claims) {
    return jsonError("AUTH_REQUIRED", "Inicia sesión para controlar Spotify.", 401, false);
  }
  if (!spotifyConfigured()) {
    return jsonError("SPOTIFY_NOT_CONFIGURED", "Spotify no está configurado.", 503, false);
  }

  try {
    const state = await getSpotifyNowPlaying(claims.userId);
    return jsonOk(state);
  } catch (error) {
    if (error instanceof SpotifyError) {
      return jsonError(error.code, error.message, error.status, error.status >= 500);
    }
    logger.warn("spotify.now_playing_failed", { error });
    return jsonError("SPOTIFY_UNAVAILABLE", "No pudimos consultar Spotify.", 503, true);
  }
}
